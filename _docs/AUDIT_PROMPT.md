# System-Audit Prompt — UZH Brainstorming Webapp

> Kopiere diesen Prompt in ein neues Claude-Gespräch (mit Zugriff auf die Codebase) oder nutze ihn als Eingabe für Claude Code.

---

## Prompt

Du bist ein erfahrener Software-Architekt und führst ein vollständiges technisches Audit einer Next.js-Forschungs-Webapp durch. Die App ermöglicht KI-gestützte Moderation in Brainstorming-Sessions mit Echtzeit-Transkription, automatischer Intervention und Live-Ideenextraktion.

### Kontext

**Tech-Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (DB + Realtime), LiveKit (Video/WebRTC), OpenAI (Whisper Realtime, Embeddings, LLM, TTS)

**Drei Szenarien:** Baseline (keine Interventionen), Szenario A (nur Moderator), Szenario B (Moderator + Ally-Eskalation)

**Kernpipeline:**
1. Mic-Audio → OpenAI Realtime WebSocket → Transkript-Segmente → Supabase + LiveKit DataChannel
2. Segmente → Embedding-basierte Metriken (alle 5s) → 5-State-Inferenz (HEALTHY_EXPLORATION, HEALTHY_ELABORATION, DOMINANCE_RISK, CONVERGENCE_RISK, STALLED_DISCUSSION)
3. Metriken → Decision Engine (4 Phasen: MONITORING → CONFIRMING 30s → POST_CHECK 90s → COOLDOWN 180s) → LLM-generierte Interventionen
4. Segmente → LLM-Ideenextraktion (alle 4s) → IdeaBoard mit Verbindungen
5. Alles synchronisiert über Supabase Realtime + LiveKit DataChannel an alle Teilnehmer

**Architektur-Highlights:**
- Ein Decision-Owner pro Session (Heartbeat-basiert, 10s-Intervall)
- Gestaffelte Tick-Intervalle: Metriken +500ms, Decision +1.5s, Extraction +2.5s
- Client-seitige Fallbacks für Interventionen bei LLM-Ausfall
- Embedding-Cache in localStorage + Supabase
- Jaccard-Fallback wenn Embeddings nicht verfügbar
- Backchannel-Filtering für Partizipationsmetriken
- Hysterese bei State-Inferenz (8% Margin, 3% Tiebreak)

---

### Audit-Auftrag

Führe ein vollständiges System-Audit durch. Lies ALLE relevanten Dateien, nicht nur die offensichtlichen. Prüfe jede Komponente nicht isoliert, sondern im Zusammenspiel mit dem Gesamtsystem.

---

### TEIL 1: End-to-End Korrektheit

#### 1.1 Transkriptions-Pipeline
Lies und analysiere:
- `lib/transcription/useOpenAIRealtimeStream.ts` — WebSocket-Lifecycle, Audio-Encoding, Interim/Final-Parsing
- `lib/hooks/useTranscriptionManager.ts` — Orchestrierung, Mute/Unmute, Fallback-Logik
- `lib/hooks/useLiveKitSync.ts` — DataChannel-Broadcasts
- `lib/hooks/sync/useSupabaseChannel.ts` — Realtime-Subscription
- `lib/hooks/useRealtimeSegments.ts` (oder entsprechend) — Segment-Empfang
- `lib/services/segmentService.ts` — API-Calls
- `app/api/segments/route.ts` — Server-seitige Verarbeitung
- `app/api/transcription/token/route.ts` — Token-Generierung

Prüfe:
- [ ] Geht Audio korrekt von Mic → PCM → Base64 → WebSocket → Transkript?
- [ ] Werden Interim-Segmente korrekt als non-final und Final-Segmente als final markiert?
- [ ] Funktioniert die Halluzinations-Filterung (`isWhisperHallucination`) zuverlässig?
- [ ] Werden Segmente korrekt dedupliziert (DataChannel + Supabase Realtime)?
- [ ] Funktioniert der Web Speech API Fallback korrekt bei OpenAI-Ausfall?
- [ ] Werden Segmente korrekt an alle Peers synchronisiert (LiveKit DataChannel)?
- [ ] Stimmt die Speaker-Zuordnung bei mehreren Teilnehmern?
- [ ] Gibt es Race Conditions bei schnellem Start/Stop der Aufnahme?
- [ ] Wird der WebSocket sauber aufgeräumt bei Disconnect/Reconnect?
- [ ] Funktioniert das Silence-Detection korrekt (RMS-Threshold, Noise-Calibration)?
- [ ] Werden bei Reconnect keine Segmente verloren oder doppelt erzeugt?

#### 1.2 Metriken-Pipeline
Lies und analysiere:
- `lib/metrics/computeMetrics.ts` — Orchestrierung
- `lib/metrics/participation.ts` — Partizipationsmetriken
- `lib/metrics/semanticDynamics.ts` — Semantische Metriken
- `lib/hooks/useMetricsComputation.ts` — Hook-Integration
- `lib/state/inferConversationState.ts` — State-Inferenz
- `lib/services/metricsService.ts` — Persistierung
- `app/api/metrics/snapshot/route.ts` — Server-Verarbeitung
- `app/api/embeddings/route.ts` — Embedding-Berechnung
- `lib/metrics/embeddingCache.ts` (falls vorhanden) — Cache-Logik

Prüfe:
- [ ] Werden Partizipationsmetriken korrekt berechnet (Volume Share, Turn Share, Silent Ratio, Dominance Streak)?
- [ ] Ist die Backchannel-Filterung korrekt und vollständig?
- [ ] Berechnet die Cosine-Similarity korrekt Novelty Rate, Cluster Concentration, Exploration/Elaboration Ratio?
- [ ] Stimmen die Schwellenwerte für die 5-State-Inferenz? Sind sie empirisch sinnvoll?
- [ ] Funktioniert die Hysterese korrekt (verhindert Zustandsflimmern)?
- [ ] Werden nur finale Segmente für Metriken verwendet (keine Interim)?
- [ ] Werden Metriken atomar mit dem aktuellen Segment-Set berechnet?
- [ ] Funktioniert der Jaccard-Fallback korrekt?
- [ ] Werden Embeddings korrekt gecacht und bei Cache-Miss nachgeladen?
- [ ] Gibt es Dimensions-Mismatches im Embedding-Cache bei Modellwechsel?
- [ ] Werden Speaking-Time-Daten korrekt aus LiveKit extrahiert?
- [ ] Stimmt die History-Cap-Grösse für die Decision Engine?

#### 1.3 Decision Engine & Interventions
Lies und analysiere:
- `lib/decision/interventionPolicy.ts` — Policy-Logik
- `lib/decision/interventionExecutor.ts` — Ausführung
- `lib/decision/ruleViolationChecker.ts` — Regelprüfung
- `lib/decision/postCheck.ts` (falls vorhanden) — Recovery-Check
- `lib/hooks/useDecisionLoop.ts` — Hauptloop
- `lib/hooks/useDecisionOwnership.ts` — Ownership-Management
- `lib/services/interventionService.ts` — API-Calls
- `app/api/interventions/route.ts` — Server-Verarbeitung
- `app/api/intervention/moderator/route.ts` (falls vorhanden)
- `app/api/intervention/ally/route.ts` (falls vorhanden)
- `lib/prompts/moderator/prompts.ts` — Moderator-Prompts
- `lib/prompts/ally/prompts.ts` — Ally-Prompts
- `lib/prompts/ruleCheck/prompts.ts` — Rule-Check-Prompts
- `lib/decision/tickConfig.ts` — Timing-Konfiguration

Prüfe:
- [ ] Wird der Phasenübergang MONITORING → CONFIRMING → POST_CHECK → COOLDOWN korrekt durchlaufen?
- [ ] Stimmt das Timing (30s Confirmation, 90s Post-Check, 180s Cooldown)?
- [ ] Werden doppelte Interventionen durch das Ownership-System verhindert?
- [ ] Was passiert bei Ownership-Wechsel während CONFIRMING oder POST_CHECK?
- [ ] Funktioniert die Recovery-Evaluation korrekt (Metrik-Vergleich Pre vs. Post)?
- [ ] Wird Intervention Fatigue korrekt erkannt (2+ Failures → Multiplier)?
- [ ] Funktionieren Client-seitige Fallbacks bei LLM-Timeout?
- [ ] Werden Rule Violations korrekt erkannt und mit der richtigen Severity eingestuft?
- [ ] Stimmen die Intent-Mappings (State → Intent → Intervention)?
- [ ] Funktioniert das 3-Interventionen-pro-10-Min-Limit korrekt?
- [ ] Werden Interventionen korrekt an alle Peers broadcast (DataChannel)?
- [ ] Funktioniert TTS-Delivery korrekt bei aktivierter Sprachausgabe?
- [ ] Werden abgebrochene/fehlgeschlagene Interventionen korrekt im Status markiert?
- [ ] Stimmt die Scenario-Logik (Baseline=keine, A=nur Moderator, B=Moderator+Ally)?

#### 1.4 Ideenextraktion
Lies und analysiere:
- `lib/hooks/useIdeaExtraction.ts` — Extraktions-Loop
- `lib/services/ideaService.ts` — API-Calls
- `app/api/ideas/route.ts` — Server-Verarbeitung
- `lib/prompts/extraction/prompts.ts` — Extraktions-Prompts
- `lib/hooks/useRealtimeIdeas.ts` — Realtime-Sync

Prüfe:
- [ ] Werden nur neue Segmente zur Extraktion gesendet (kein Re-Processing)?
- [ ] Funktioniert die Ideen-Deduplizierung nach Titel?
- [ ] Werden Verbindungen (builds_on, contrasts, supports, leads_to) korrekt erkannt?
- [ ] Wird die Extraktion bei `isActive=false` korrekt abgebrochen (AbortController)?
- [ ] Werden extrahierte Ideen korrekt an alle Peers synchronisiert?

#### 1.5 Session-Lifecycle
Lies und analysiere:
- `app/call/[room]/page.tsx` — Hauptseite
- `lib/hooks/session/useSessionOrchestration.ts` — Orchestrierung
- `app/api/session/route.ts` — Session CRUD
- `app/api/session/export/route.ts` — Export
- `app/api/livekit/token/route.ts` — Token-Generierung

Prüfe:
- [ ] Funktioniert Session-Erstellung → Join → Active → End korrekt?
- [ ] Werden alle Ressourcen bei Session-Ende aufgeräumt (WebSockets, Intervals, Subscriptions)?
- [ ] Funktioniert der Export vollständig (Segmente, Interventionen, Ideen, Metriken)?
- [ ] Was passiert bei Browser-Tab-Schliessung (sendBeacon, Cleanup)?
- [ ] Funktioniert der Participant-Tracking korrekt (Join/Leave)?

---

### TEIL 2: Effizienz & Performance

#### 2.1 Netzwerk-Effizienz
- [ ] Wie viele API-Calls pro Minute/Stunde bei einer typischen 30-Min-Session mit 4 Teilnehmern?
- [ ] Welche Calls sind überflüssig oder zu häufig?
- [ ] Wo könnte Batching eingesetzt werden?
- [ ] Werden Fire-and-Forget-Calls mit sinnvollen Retry-Counts versehen?
- [ ] Gibt es unnötige Retries bei nicht-kritischen Daten?

#### 2.2 Rendering-Effizienz
- [ ] Welche Komponenten rendern zu oft? (Monolithischer Context, fehlende Memos)
- [ ] Sind Props stabil (referenzielle Gleichheit)?
- [ ] Werden teure Berechnungen gecacht (useMemo)?
- [ ] Verursachen Interim-Updates unnötige Re-Renders?

#### 2.3 Berechnungs-Effizienz
- [ ] Ist die Metriken-Berechnung performant bei langen Transcripts (>500 Segmente)?
- [ ] Gibt es O(n²) oder schlimmere Algorithmen?
- [ ] Werden Embeddings effizient gecacht und wiederverwendet?
- [ ] Ist die State-Inferenz performant?

#### 2.4 Speicher-Effizienz
- [ ] Wachsen Arrays unbegrenzt oder gibt es Caps?
- [ ] Werden alte Daten korrekt evicted (Embedding-Cache, History)?
- [ ] Gibt es Memory Leaks (nicht aufgeräumte Listeners, Intervals, Subscriptions)?

---

### TEIL 3: Robustheit & Fehlerbehandlung

#### 3.1 Netzwerkausfälle
- [ ] Was passiert bei kurzem Internetausfall (5s)?
- [ ] Was passiert bei langem Internetausfall (60s)?
- [ ] Werden Daten bei Reconnect korrekt nachgeladen?
- [ ] Gibt es Datenverlust bei Fire-and-Forget während Ausfall?

#### 3.2 API-Fehler
- [ ] Wie reagiert das System bei OpenAI API-Ausfall (Transcription, LLM, Embeddings, TTS)?
- [ ] Wie reagiert das System bei Supabase-Ausfall?
- [ ] Wie reagiert das System bei LiveKit-Ausfall?
- [ ] Werden Fehler korrekt geloggt und dem Benutzer angezeigt?

#### 3.3 Race Conditions
- [ ] Decision-Ownership-Wechsel während aktiver Intervention
- [ ] Gleichzeitiger Segment-Upload von mehreren Teilnehmern
- [ ] Metrics-Berechnung während Segment-Updates
- [ ] Token-Refresh während aktiver WebSocket-Verbindung
- [ ] Supabase-Subscribe während Reconnect

#### 3.4 Edge Cases
- [ ] Was passiert bei nur 1 Teilnehmer (keine Partizipationsmetriken möglich)?
- [ ] Was passiert bei >6 Teilnehmern?
- [ ] Was passiert bei sehr langen Sessions (>60 Min)?
- [ ] Was passiert bei sehr schneller Sprache (viele Segmente/Sekunde)?
- [ ] Was passiert bei Stille (keine Segmente für 5+ Minuten)?
- [ ] Was passiert bei Sprachwechsel mid-session?

---

### TEIL 4: Sicherheit

- [ ] Sind alle API-Routen gegen unautorisierte Zugriffe geschützt?
- [ ] Ist RLS auf Supabase-Tabellen aktiviert?
- [ ] Werden API-Keys nur server-seitig verwendet?
- [ ] Können Session-IDs erraten werden?
- [ ] Gibt es Input-Validierung auf allen API-Routen?
- [ ] Werden Env-Variablen korrekt geschützt (.gitignore)?

---

### TEIL 5: Konsistenz & Code-Qualität

- [ ] Sind Timeout-Werte konsistent oder willkürlich verteilt?
- [ ] Sind Retry-Counts einheitlich?
- [ ] Ist die Fehlerbehandlung konsistent (warn vs. throw vs. return null)?
- [ ] Gibt es Prompt-Versions-Inkonsistenzen?
- [ ] Sind alle Realtime-Hooks nach dem gleichen Pattern implementiert?
- [ ] Gibt es Dead Code oder veraltete Reste?

---

### Output-Format

Strukturiere deinen Audit-Bericht wie folgt:

```
## Executive Summary
- Gesamtbewertung (1-10)
- Top 5 kritischste Probleme
- Top 5 Quick Wins

## 1. Transkriptions-Pipeline
### Korrektheit: X/10
### Gefundene Probleme (mit Datei:Zeile, Schwere, Beschreibung)
### Empfehlungen

## 2. Metriken-Pipeline
### Korrektheit: X/10
### Gefundene Probleme
### Empfehlungen

## 3. Decision Engine & Interventions
### Korrektheit: X/10
### Gefundene Probleme
### Empfehlungen

## 4. Ideenextraktion
### Korrektheit: X/10
### Gefundene Probleme
### Empfehlungen

## 5. Session-Lifecycle
### Korrektheit: X/10
### Gefundene Probleme
### Empfehlungen

## 6. Effizienz & Performance
### Netzwerk-Budget (Calls/Stunde)
### Rendering-Hotspots
### Berechnungs-Bottlenecks
### Empfehlungen (mit geschätztem Impact)

## 7. Robustheit
### Fehlerszenarien-Matrix
### Race Conditions
### Edge Cases
### Empfehlungen

## 8. Sicherheit
### Kritische Funde
### Empfehlungen

## 9. Konsistenz
### Inkonsistenzen
### Empfehlungen

## 10. Priorisierter Aktionsplan
### Sofort (Tag 1-2)
### Woche 1
### Woche 2-3
### Monat 2+
```

Sei brutal ehrlich. Markiere klar was funktioniert und was nicht. Gib für jedes Problem die exakte Datei und Zeile an. Unterscheide zwischen "funktioniert aber suboptimal" und "funktioniert nicht korrekt". Priorisiere nach tatsächlichem Impact auf die Forschungsdaten-Qualität.
