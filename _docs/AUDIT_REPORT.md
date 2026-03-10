# System-Audit Bericht — UZH Brainstorming Webapp

*Audit durchgeführt am 2026-03-10. Alle Datei:Zeile-Referenzen beziehen sich auf den aktuellen Stand des `master`-Branches.*

---

## Executive Summary

**Gesamtbewertung: 7/10**

Die Architektur ist durchdacht und gut implementiert. Die Kernpipeline (Transkription → Metriken → Decision Engine → Interventionen) funktioniert korrekt in den meisten Szenarien. Die Multi-Layer-Deduplication, das Ownership-System und die Client-seitigen Fallbacks zeigen hohe Engineering-Qualität. Allerdings gibt es einen kritischen Kalibierungsfehler in der AudioWorklet-Pipeline, fehlende Authentifizierung auf allen API-Routen und mehrere Inkonsistenzen bei Timeouts/Retries.

### Top 5 kritischste Probleme

| # | Schwere | Problem | Datei |
|---|---------|---------|-------|
| 1 | **KRITISCH** | Keine Authentifizierung auf allen 29 API-Routen | Alle `app/api/` Routen |
| 2 | **KRITISCH** | Keine Supabase RLS-Policies, Service Role Key bypassed alles | `supabase/schema.sql`, `lib/supabase/server.ts` |
| 3 | **HOCH** | AudioWorklet-Buffergrösse (128 Samples) vs. ScriptProcessor-Kalibrierung (4096 Samples) — Silence-Gate greift 32x zu früh | `lib/transcription/useOpenAIRealtimeStream.ts:564-588` |
| 4 | **HOCH** | Embedding-Dimensionsmismatch bei Modellwechsel — stille Korruption aller semantischen Metriken | `lib/metrics/embeddingCache.ts:50` |
| 5 | **MITTEL** | Session-Staleness-Check nutzt `started_at` statt `last_heartbeat` — Sessions >1h werden fälschlich geschlossen | `app/api/session/route.ts:99` |

### Top 5 Quick Wins

| # | Fix | Impact | Aufwand |
|---|-----|--------|---------|
| 1 | AudioWorklet-Silence-Konstanten durch Buffergrösse teilen (÷32) | Verhindert verlorene Transkriptionen | 30 Min |
| 2 | Staleness-Check auf `last_heartbeat` statt `started_at` umstellen | Sessions >1h funktionieren | 15 Min |
| 3 | Embedding-Model-Name im Cache speichern, bei Wechsel invalidieren | Verhindert Metrik-Korruption | 1h |
| 4 | `isSubscribed` in useSupabaseChannel als State statt Ref | Health-Panel zeigt korrekten Status | 15 Min |
| 5 | TTS-Dedup-Set für Non-Owner-Peers (verhindert doppeltes Vorlesen) | Bessere UX bei Interventionen | 30 Min |

---

## 1. Transkriptions-Pipeline

### Korrektheit: 7/10

Die Architektur (Mic → PCM → Base64 → WebSocket → Transkript → DataChannel + Supabase) ist korrekt implementiert. Speaker-Zuordnung, Dedup, Halluzinationsfilter und Fallback-Logik funktionieren. Der kritische AudioWorklet-Kalibierungsfehler beeinträchtigt jedoch die Transkriptionsqualität in modernen Browsern erheblich.

### Gefundene Probleme

| # | Schwere | Datei:Zeile | Beschreibung |
|---|---------|-------------|--------------|
| T1 | **HOCH** | `useOpenAIRealtimeStream.ts:564-588` | AudioWorklet sendet 128-Sample-Buffers, aber `MAX_SILENT_CHUNKS_TO_SEND=60` und `KEEPALIVE_INTERVAL_CHUNKS=55` sind für 4096-Sample-Buffers kalibriert. Silence-Gate greift nach 0.32s statt 10s. Keepalive feuert alle 0.29s statt 9s. |
| T2 | MITTEL | `useOpenAIRealtimeStream.ts:53` | `NOISE_CALIBRATION_BUFFERS=12` ergibt mit AudioWorklet nur 64ms Kalibrierung statt 2s — unzuverlässige Noise-Floor-Schätzung |
| T3 | MITTEL | `useTranscriptionManager.ts:14` | `lastLocalSpeakingTimeRef` wird akzeptiert aber nie verwendet — kein Echo-Gate existiert. TTS-Ausgabe über Lautsprecher wird als lokale Sprache transkribiert |
| T4 | MITTEL | `useSupabaseChannel.ts:106,149` | `isSubscribed` nutzt Ref statt State — Health-Panel zeigt Supabase Realtime immer als disconnected |
| T5 | MITTEL | `transcription/token/route.ts:14` | Rate-Limit 10/min pro IP — bei 4 Teilnehmern hinter gleicher IP (Uni-Labor) + Reconnects schnell erschöpft |
| T6 | NIEDRIG | `useRealtimeSegments.ts:29,39` | `knownIdsRef` nicht mit DataChannel-IDs vorbelegt — unnötige Reducer-Dispatches (Dedup greift erst im Reducer) |
| T7 | NIEDRIG | `useTranscriptionManager.ts:191` | Kein Recovery-Pfad von Web Speech API Fallback zurück zu OpenAI Realtime |
| T8 | INFO | `useRealtimeSegments.ts:11,19` | `speakingTimeRef` Parameter ist Dead Code |

### Empfehlungen

1. **Sofort**: AudioWorklet-Konstanten anpassen — entweder Samples im Worklet zu 4096 akkumulieren, oder `MAX_SILENT_CHUNKS_TO_SEND` und `KEEPALIVE_INTERVAL_CHUNKS` durch `Math.ceil(4096/128) = 32` multiplizieren
2. **Sofort**: Echo-Gate implementieren mit `lastLocalSpeakingTimeRef` — Segmente unterdrücken wenn TTS aktiv
3. **Woche 1**: `isSubscribed` als React State statt Ref
4. **Woche 1**: Token-Rate-Limit auf 20-30/min erhöhen oder pro Session-ID statt IP limitieren

---

## 2. Metriken-Pipeline

### Korrektheit: 8/10

Partizipationsmetriken, Backchannel-Filterung, Cosine-Similarity, Novelty, Cluster-Konzentration und Exploration/Elaboration-Ratio sind alle korrekt implementiert. Alle Algorithmen sind durch Caps (MAX_SEGMENTS=30, NOVELTY_WINDOW=20) begrenzt — keine O(n²)-Probleme bei langen Sessions. Die Hysterese funktioniert korrekt. Der kritischste Fund ist die fehlende Dimensionsvalidierung im Embedding-Cache.

### Gefundene Probleme

| # | Schwere | Datei:Zeile | Beschreibung |
|---|---------|-------------|--------------|
| M1 | **HOCH** | `embeddingCache.ts:50` | `loadPersistedCache` validiert keine Embedding-Dimension. Bei Modellwechsel (z.B. text-embedding-3-small→large) enthält der Cache Vektoren unterschiedlicher Dimensionen. `cosineSimilarity` gibt 0 zurück → Novelty sprintet auf ~1.0, Cluster-Konzentration fällt auf ~0. Stille Korruption aller semantischen Metriken. |
| M2 | MITTEL | `LiveKitRoom.tsx:199-246`, `computeMetrics.ts:308-314` | Audio-basierte Sprechzeit ist kumulativ (gesamte Session), aber Text-basierter Fallback nutzt 180s-Window. Ein Sprecher der vor 10min dominant war, erscheint im Audio-Pfad immer noch dominant. |
| M3 | NIEDRIG | `semanticDynamics.ts:396,451-452` | Jaccard-Fallback nutzt hardcodierte Thresholds statt konfigurierbarer `EXPLORATION_COSINE_THRESHOLD`/`ELABORATION_COSINE_THRESHOLD` |
| M4 | NIEDRIG | `participation.ts:61,84` | Volume Share inkludiert Backchannels, Turn Share nicht — ein Teilnehmer der nur "ja" sagt hat Volume Share aber keine Turns |
| M5 | NIEDRIG | `inferConversationState.ts:103` | Hardcodierter Fluency-Baseline 6 Turns/Min — möglicherweise zu aggressiv für stille Denkphasen |
| M6 | NIEDRIG | `metricsService.ts:14` | Metrics-Snapshot-Persistierung mit 0 Retries — Netzwerkblip = verlorener Snapshot |
| M7 | SEHR NIEDRIG | `semanticDynamics.ts:121-124` | Centroid-Drift bei Greedy-Clustering — bei MAX_SEGMENTS=30 vernachlässigbar |

### Empfehlungen

1. **Sofort**: Embedding-Model-Name im localStorage-Cache speichern, bei Wechsel Cache invalidieren
2. **Woche 1**: Audio-Sprechzeit auf Window begrenzen oder zumindest optionalen Windowed-Modus implementieren
3. **Woche 2**: Jaccard-Fallback-Thresholds konfigurierbar machen

---

## 3. Decision Engine & Interventions

### Korrektheit: 8.5/10

Die Phasen-Maschine, das Ownership-System, Recovery-Evaluation, Fatigue-Detection, Client-seitige Fallbacks und Multi-Channel-Broadcasting sind alle korrekt implementiert. Die Intent-Mappings sind sauber und exhaustiv. Prompts sind qualitativ hochwertig mit bilingualer Unterstützung.

### Gefundene Probleme

| # | Schwere | Datei:Zeile | Beschreibung |
|---|---------|-------------|--------------|
| D1 | MITTEL | `config.ts:16` vs `types.ts:149` | `POST_CHECK_SECONDS` Default ist 180s, nicht 90s wie in Types/Doku. Voller Zyklus = 390s (6.5 Min) statt 300s (5 Min). Bei Szenario B mit Ally: 450s (7.5 Min). |
| D2 | NIEDRIG | `SessionContext.tsx:25-36` | Ownership-Transfer setzt Engine auf MONITORING zurück — Confirmation/Post-Check-Fortschritt geht verloren |
| D3 | NIEDRIG | `usePeerSync.ts:48-50` + `useRealtimeInterventions.ts:44` | Non-Owner-Peers hören Interventionen doppelt (LiveKit DataChannel + Supabase Realtime triggern beide TTS) |
| D4 | NIEDRIG | `ally/route.ts:40-41` | Ally-Route Guard erlaubt Requests ohne `scenario`-Feld |
| D5 | KOSMETISCH | `useDecisionLoop.ts:346-349` | Dead Code — `executeIntervention` gibt immer `success: true` zurück, else-Branch unerreichbar |

### Empfehlungen

1. **Sofort**: Doku-Inkonsistenz klären — POST_CHECK_SECONDS entweder auf 90s setzen oder Doku aktualisieren
2. **Woche 1**: TTS-Dedup-Set für Non-Owner implementieren (Intervention-ID tracken, TTS nur einmal triggern)
3. **Woche 1**: Bei Ownership-Transfer letzten Engine-State aus Supabase laden statt von MONITORING starten
4. **Woche 2**: Ally-Route Guard verschärfen: auch Requests ohne `scenario` ablehnen

---

## 4. Ideenextraktion

### Korrektheit: 8/10

Gut implementiert mit Multi-Layer-Deduplication (Prompt, Server-Filter, Reducer), exzellentem AbortController-Management (4 verschiedene Abort-Pfade) und korrekter Peer-Synchronisation via Supabase Realtime.

### Gefundene Probleme

| # | Schwere | Datei:Zeile | Beschreibung |
|---|---------|-------------|--------------|
| I1 | NIEDRIG | `useIdeaExtraction.ts:351` | Watermark rückt bei Extraktionsfehler nicht vor — bei partiellem Erfolg (LLM hat extrahiert, JSON-Parse schlägt fehl) werden dieselben Segmente erneut gesendet |
| I2 | NIEDRIG | `useIdeaExtraction.ts:229` | `maxRetries: 1` + 30s Stale-Timeout → Einzelversuch kann bis zu 60s dauern, Queue fällt zurück |
| I3 | INFO | `ideaService.ts:48-61` | `extractIdeas`-Funktion im Service ist Dead Code — Hook ruft API direkt auf |

### Empfehlungen

1. **Woche 2**: Extraktionsintervall von 4s auf 8-10s erhöhen — reduziert LLM-Kosten um ~50%
2. **Woche 2**: Watermark auch bei partiellem Erfolg vorrücken (Retry-bei-Fehler bleibt möglich durch eine separate Queue)

---

## 5. Session-Lifecycle

### Korrektheit: 7/10

Umfassendes Lifecycle-Management mit gutem Tab-Close-Handling (sendBeacon, visibilitychange, Effect-Cleanup). Export ist vollständig (10 Tabellen). Der kritischste Bug ist der Staleness-Check auf `started_at`.

### Gefundene Probleme

| # | Schwere | Datei:Zeile | Beschreibung |
|---|---------|-------------|--------------|
| S1 | **MITTEL** | `session/route.ts:99` | Staleness-Check nutzt `started_at` statt `last_heartbeat`. Eine aktive 65-Min-Session wird beim nächsten GET fälschlich als stale geschlossen. Heartbeat aktualisiert `last_heartbeat`, aber der Check ignoriert es. |
| S2 | NIEDRIG | `useSessionLifecycle.ts:287` + `page.tsx:282` | `endSession()` wird bei User-initiiertem Ende doppelt aufgerufen (handleEndSession + Lifecycle-Cleanup) |
| S3 | NIEDRIG | `useSessionLifecycle.ts:291` | Effect-Dependencies auf `[roomName]` mit eslint-disable — stale Closure für `participantName` im beforeunload-Handler |
| S4 | NIEDRIG | Kein server-seitiger Heartbeat-Reaper | Bei Browser-Crash bleibt Teilnehmer "aktiv" bis 1h-Staleness-Check |
| S5 | INFO | `session/export/route.ts:27` | Export filtert `is_deleted=false` — gelöschte Ideen fehlen im Export (möglicherweise relevant für Forschung) |

### Empfehlungen

1. **Sofort**: Staleness-Check auf `last_heartbeat` umstellen (`started_at` → `last_heartbeat`)
2. **Woche 1**: Server-seitigen Heartbeat-Reaper implementieren (Cron oder Supabase Function)
3. **Woche 2**: Export optional mit gelöschten Ideen ermöglichen

---

## 6. Effizienz & Performance

### Netzwerk-Budget (30-Min-Session, 4 Teilnehmer, Szenario B)

| Kategorie | Calls/30 Min | Calls/Stunde |
|-----------|-------------|--------------|
| Segment-Uploads | 200-400 | 400-800 |
| Embedding-Fetches | ~360 | ~720 |
| Idea-Extractions (LLM) | 225-450 | 450-900 |
| Rule-Checks (LLM) | ~120 | ~240 |
| Metrics-Snapshots | ~60 | ~120 |
| Heartbeats (4 Clients) | ~240 | ~480 |
| Decision-Owner Claims | ~180 | ~360 |
| Live-Summaries (LLM) | ~30 | ~60 |
| Model-Routing-Logs | ~600 | ~1200 |
| **Gesamt HTTP** | **~2.000-3.000** | **~4.000-6.000** |
| **Gesamt LLM-Calls** | **~600-1.000** | **~1.200-2.000** |

### Rendering-Hotspots

- **Monolithischer SessionContext**: Jedes `ADD_TRANSCRIPT_SEGMENT` (pro Äußerung) erzeugt neuen State → alle Consumer re-rendern. Komponenten die nur `config` oder `scenario` lesen, rendern bei jedem Segment unnecessarily.
  - `SessionContext.tsx:424-445`
  - **Mitigation**: `React.memo` auf `TranscriptFeed`, `useMemo` auf `IdeaBoard`, `dynamic()` Imports

### Berechnungs-Bottlenecks

- Alle Algorithmen korrekt begrenzt: MAX_SEGMENTS=30, NOVELTY_WINDOW=20
- MATTR-Diversity: Exzellente O(n) Sliding-Window-Implementierung
- Kein O(n²)-Problem bei >500 Segmenten — innere Loops arbeiten auf gecappten Windows
- Embedding-Fetches: Batch-Limit 50 pro API-Call, Cache verhindert Re-Fetches

### Empfehlungen (mit Impact)

| Empfehlung | Einsparung | Aufwand |
|-----------|-----------|---------|
| `EXTRACTION_TICK_MS` von 4s auf 8s erhöhen | ~50% weniger LLM-Calls für Extraktion (~225 Calls/30min) | 5 Min |
| SessionContext splitten (State vs. Config) | ~60% weniger Re-Renders für Config-Consumer | 2h |
| Model-Routing-Logs batchen (10er Gruppen) | ~90% weniger HTTP-Calls für Logging | 1h |

---

## 7. Robustheit

### Fehlerszenarien-Matrix

| Szenario | Transkription | Metriken | Interventionen | Ideen |
|----------|--------------|----------|----------------|-------|
| **Kurzer Netzausfall (5s)** | WebSocket Reconnect mit Backoff, Segmente buffered in DataChannel | Berechnung läuft lokal weiter | Ownership bleibt (10s Stale-Threshold) | Extraktion pausiert, retry |
| **Langer Netzausfall (60s)** | WebSocket Reconnect, Segmente während Ausfall verloren | Snapshots gehen verloren (0 Retries) | Ownership wechselt (>10s), Engine resettet auf MONITORING | Extraktion pausiert |
| **OpenAI API-Ausfall** | Web Speech API Fallback nach 10s | Jaccard-Fallback für Semantik | Client-Fallback-Texte für Interventionen | Extraktion pausiert |
| **Supabase-Ausfall** | Segmente via DataChannel an Peers, DB-Persist fehlt | Snapshots verloren, lokale Berechnung weiter | DB-Persist fehlt, DataChannel-Broadcast funktioniert | DB-Persist fehlt |
| **LiveKit-Ausfall** | Nur lokale Transkription, keine Peer-Sync via DataChannel | Unverändert (nutzt nur Supabase) | Kein DataChannel-Broadcast, nur Supabase Realtime | Unverändert |

### Race Conditions

| Szenario | Risiko | Mitigation |
|----------|--------|------------|
| Ownership-Wechsel während Intervention | NIEDRIG | Engine resettet auf MONITORING, Intervention bereits gefeuert und broadcast |
| Gleichzeitiger Segment-Upload | KEINE | Jeder Teilnehmer erzeugt eigene Segmente, DB-Upsert mit `ignoreDuplicates` |
| Metrics-Berechnung während Segment-Updates | NIEDRIG | Reducer erzeugt neue Arrays (kein In-Place-Mutation), ref-Snapshot ist stabil |
| Token-Refresh während aktiver WebSocket | KEINE | `connectWebSocket` hat Overlap-Guard mit Polling |

### Edge Cases

| Szenario | Verhalten | Problem? |
|----------|----------|----------|
| 1 Teilnehmer | Partizipationsmetriken alle 100%/0%, State-Inferenz defaultet zu HEALTHY | Kein Problem |
| >6 Teilnehmer | Funktioniert, aber UI nicht optimiert | NIEDRIG |
| Session >60 Min | **Auto-Close durch Staleness-Check** | **BUG (S1)** |
| Sehr schnelle Sprache | Segmente korrekt buffered, Metriken-Cap bei 30 | Kein Problem |
| 5+ Min Stille | STALLED_DISCUSSION erkannt, Intervention gefeuert | Korrekt |
| Sprachwechsel | OpenAI Whisper ist multilingual, aber Prompts sind DE/EN | Funktioniert teilweise |

---

## 8. Sicherheit

### Kritische Funde

| # | Schwere | Beschreibung |
|---|---------|--------------|
| SEC1 | **KRITISCH** | Keine Authentifizierung auf allen 29 API-Routen — jeder mit Serverzugang kann Daten lesen, schreiben, Session-Daten exportieren, Model-Routing ändern |
| SEC2 | **KRITISCH** | Keine Supabase RLS-Policies in `supabase/schema.sql`. Service Role Key (`server.ts:4-5`) bypassed alles. Anon Key im Browser hat direkten Zugriff auf alle Tabellen. |
| SEC3 | **HOCH** | `/api/sessions` listet ALLE Sessions ohne Auth — Daten-Enumeration |
| SEC4 | **HOCH** | `/api/model-routing` PUT akzeptiert unauthentifizierte Änderungen — Modelkonfiguration manipulierbar |
| SEC5 | MITTEL | Inkonsistente Session-Validierung: 13 Routen nutzen `validateSessionExists`, 12 nicht |
| SEC6 | MITTEL | Keine Input-Sanitisierung auf Free-Text-Feldern (Segmente, Ideen, Annotationen) |

### Positive Befunde

- UUIDs für Session-IDs (kryptographisch zufällig, nicht erratbar)
- `.env*` korrekt in .gitignore, keine hardcodierten Secrets
- LiveKit Webhook mit Signaturprüfung
- Rate-Limiting auf allen LLM-facing Routen
- `NEXT_PUBLIC_`-Prefixe korrekt nur für öffentliche Werte

### Empfehlungen

1. **Sofort**: Für Forschungskontext: Mindestens Bearer-Token-Auth auf alle Routen (einfacher API-Key im Header)
2. **Woche 1**: RLS-Policies in Supabase aktivieren (Session-basierter Zugriff)
3. **Woche 1**: `validateSessionExists` auf ALLE Routen ausweiten
4. **Woche 2**: Input-Validierung mit zod auf allen API-Routen

---

## 9. Konsistenz

### Inkonsistenzen

| Bereich | Problem | Dateien |
|---------|---------|---------|
| **Timeouts** | Werte über 15+ Dateien verstreut statt zentral in `lib/config/timeouts.ts` | WebSocket 10s, Heartbeat 30s, Departure 60s, Realtime 1s, Interim Throttle 150ms, etc. |
| **Retry-Counts** | 0, 1, 2, oder 3 Retries ohne klares Muster | `metricsService.ts:14` (0), `ideaService.ts:12` (1), apiClient Default (3) |
| **Error-Handling** | 5 verschiedene Patterns: console.error+JSON, silent swallow, warn+success, throw, return null | `rule-check/route.ts:54` gibt HTTP 200 mit `{violated: false, error: '...'}` zurück |
| **POST_CHECK_SECONDS** | Types.ts sagt 90s, config.ts setzt 180s | `types.ts:149` vs `config.ts:16` |
| **Realtime-Pattern** | `useLiveSummary.ts` erstellt eigenen Supabase-Channel statt `useSupabaseChannel` zu nutzen | `useLiveSummary.ts:120-134` |

### Dead Code

| Datei | Beschreibung |
|-------|-------------|
| `ideaService.ts:48-61` | `extractIdeas` wird nie aufgerufen |
| `useRealtimeSegments.ts:11,19` | `speakingTimeRef` Parameter wird nie verwendet |
| `useDecisionLoop.ts:346-349` | else-Branch unerreichbar (executeIntervention gibt immer success:true) |
| `SessionContext.tsx:402-422` | `exportSessionLog` client-seitig ist redundant mit Server-Export |
| `lib/logging/sessionLog.ts` | `buildEnhancedSessionLog` hat keine Imports |

### Empfehlungen

1. Alle Timeout/Intervall-Konstanten in `lib/config/timeouts.ts` zentralisieren
2. Retry-Strategie vereinheitlichen: 0 für Fire-and-Forget-Logging, 2 für Daten, 3 für kritische Ops
3. Error-Handling-Pattern standardisieren (throw für unerwartete, return null für erwartete Fehler)
4. Dead Code entfernen

---

## 10. Priorisierter Aktionsplan

### Sofort (Tag 1-2)

| # | Aktion | Impact |
|---|--------|--------|
| 1 | **AudioWorklet-Silence-Konstanten fixen** — `MAX_SILENT_CHUNKS_TO_SEND` und `KEEPALIVE_INTERVAL_CHUNKS` × 32 multiplizieren oder im Worklet auf 4096 buffern | Verhindert verlorene Transkriptionen in Chrome/Firefox |
| 2 | **Staleness-Check auf `last_heartbeat` umstellen** in `session/route.ts:99` | Sessions >1h funktionieren |
| 3 | **POST_CHECK_SECONDS-Inkonsistenz klären** — entweder config.ts auf 90s oder types.ts/Doku auf 180s | Konsistenz |
| 4 | **Embedding-Cache: Model-Name speichern** und bei Wechsel invalidieren | Verhindert stille Metrik-Korruption |

### Woche 1

| # | Aktion | Impact |
|---|--------|--------|
| 5 | Echo-Gate implementieren (TTS-active → Segmente unterdrücken) | Korrekte Speaker-Attribution bei Sprachausgabe |
| 6 | `isSubscribed` als React State statt Ref in useSupabaseChannel | Korrektes Health-Panel |
| 7 | TTS-Dedup-Set für Non-Owner-Peers | Keine doppelte Sprachausgabe |
| 8 | Bearer-Token-Auth auf alle API-Routen (einfacher API-Key) | Minimaler Zugriffsschutz |
| 9 | Noise-Kalibrierung: Mehr Buffers bei AudioWorklet (~400 statt 12) | Zuverlässigere Silence-Detection |

### Woche 2-3

| # | Aktion | Impact |
|---|--------|--------|
| 10 | Audio-Sprechzeit windowed machen (180s wie Text-Fallback) | Konsistente Partizipationsmetriken |
| 11 | Supabase RLS-Policies implementieren | Datenschutz |
| 12 | `validateSessionExists` auf alle Routen ausweiten | Konsistente Validierung |
| 13 | Timeouts in `lib/config/timeouts.ts` zentralisieren | Wartbarkeit |
| 14 | Input-Validierung mit zod auf API-Routen | Robustheit |
| 15 | `EXTRACTION_TICK_MS` auf 8s erhöhen | ~50% weniger LLM-Kosten |
| 16 | `useLiveSummary` auf `useSupabaseChannel` umstellen | Konsistentes Realtime-Pattern |

### Monat 2+

| # | Aktion | Impact |
|---|--------|--------|
| 17 | SessionContext aufteilen (State vs Config) | Rendering-Performance |
| 18 | Server-seitiger Heartbeat-Reaper (Cron) | Robustheit bei Browser-Crashes |
| 19 | Bei Ownership-Transfer letzten Engine-State aus DB laden | Nahtlosere Übergabe |
| 20 | Retry-Strategie und Error-Handling vereinheitlichen | Code-Qualität |
| 21 | Rate-Limiter auf persistent Storage (Redis) umstellen | Serverless-Kompatibilität |
| 22 | Dead Code aufräumen | Wartbarkeit |
