# UZH Brainstorming Webapp — Systemarchitektur

Vollstaendige technische Dokumentation des Systems (Maerz 2026).

---

## Inhaltsverzeichnis

1. [Ueberblick](#1-ueberblick)
2. [Technologie-Stack](#2-technologie-stack)
3. [Projektstruktur](#3-projektstruktur)
4. [Session-Lebenszyklus](#4-session-lebenszyklus)
5. [LiveKit-Integration](#5-livekit-integration)
6. [Transkriptions-Pipeline](#6-transkriptions-pipeline)
7. [Metriken-System](#7-metriken-system)
8. [Zustandsinferenz (State Inference)](#8-zustandsinferenz)
9. [Interventions-Engine](#9-interventions-engine)
10. [Ideen-System](#10-ideen-system)
11. [API-Routen](#11-api-routen)
12. [LLM-Prompts](#12-llm-prompts)
13. [Datensynchronisation](#13-datensynchronisation)
14. [Session-Kontext (React State)](#14-session-kontext)
15. [Datenfluss-Diagramm](#15-datenfluss-diagramm)
16. [Konfiguration](#16-konfiguration)
17. [Umgebungsvariablen](#17-umgebungsvariablen)

---

## 1. Ueberblick

Forschungs-Webapp fuer KI-gestuetzte Moderation in Brainstorming-Sitzungen.

**Drei Szenarien:**

| Szenario | Beschreibung |
|----------|-------------|
| `baseline` | Keine KI-Interventionen (Kontrollgruppe) |
| `A` | KI-Moderator greift bei Risikozustaenden ein |
| `B` | KI-Moderator + Ally-Eskalation bei ausbleibender Erholung |

**Kern-Architektur:**
- Echtzeit-Videokonferenz via LiveKit Cloud (WebRTC)
- Per-Teilnehmer Audio-Transkription via OpenAI Realtime API
- Deterministische 5-Zustands-Inferenz auf Gespraechsmetriken
- Policy-basierte Interventionsentscheidungen (4 Phasen)
- LLM-generierte Moderations-Interventionen mit TTS-Wiedergabe
- Supabase als zentrale Datenbank und Echtzeit-Synchronisation
- LiveKit DataChannel fuer latenzarme P2P-Synchronisation

---

## 2. Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| Framework | Next.js 16, App Router, TypeScript, React 19 |
| Video/Audio | LiveKit Cloud (WebRTC via SFU) |
| Transkription | OpenAI Realtime API (primaer) + Web Speech API (Fallback) |
| LLM | OpenAI Chat Completions (konfigurierbare Modelle mit Fallback-Kette) |
| Embeddings | OpenAI Embeddings API (`text-embedding-3-small`) |
| TTS | OpenAI Cloud TTS via `/api/tts` |
| State | React Context + useReducer |
| Datenbank | Supabase (PostgreSQL) |
| Sync | Supabase Realtime (WebSocket) + LiveKit DataChannel (WebRTC) |
| Cache | localStorage fuer Embedding-Vektoren + Konfiguration |

### Pakete

```
livekit-server-sdk          — JWT-Token-Generierung (Server)
livekit-client              — WebRTC-Client (Browser)
@livekit/components-react   — React-Komponenten (VideoConference, RoomAudioRenderer)
@livekit/components-styles  — Standard-CSS-Theme (ueberschrieben)
@supabase/supabase-js       — Supabase-Client (Browser + Server)
```

---

## 3. Projektstruktur

```
app/
  layout.tsx                              — Root-Layout, SessionProvider
  page.tsx                                — Landing/Setup-Seite
  call/[room]/page.tsx                    — Haupt-Session-Seite
  globals.css                             — Design-Tokens + LiveKit-Theme-Overrides
  api/
    livekit/
      token/route.ts                      — LiveKit JWT-Token
      webhook/route.ts                    — LiveKit Webhook (room_finished)
    transcription/token/route.ts          — OpenAI Realtime Token
    tts/route.ts                          — Cloud TTS Streaming
    embeddings/route.ts                   — Embedding-Proxy
    intervention/
      moderator/route.ts                  — Moderator-LLM-Endpoint
      ally/route.ts                       — Ally-LLM-Endpoint
    rule-check/route.ts                   — LLM-basierte Regelpruefung
    session/route.ts                      — Session CRUD (POST/GET/PUT/PATCH)
    session/join/route.ts                 — Session beitreten
    session/export/route.ts               — Session-Export (alle Daten)
    session/report/route.ts               — Post-Session-Report
    session/cleanup/route.ts              — Stale-Session-Bereinigung (Cron)
    session/participants/route.ts         — Teilnehmer-Lifecycle
    session/events/route.ts               — Session-Events (Analytics)
    sessions/route.ts                     — Alle Sessions auflisten
    segments/route.ts                     — Transkript-Segmente (POST/GET)
    ideas/route.ts                        — Ideen CRUD
    ideas/extract/route.ts                — LLM-Ideenextraktion
    ideas/connections/route.ts            — Ideen-Verbindungen
    metrics/snapshot/route.ts             — Metrik-Snapshot persistieren
    engine-state/route.ts                 — Engine-State (PUT/GET)
    interventions/route.ts                — Interventionen (POST/GET/PATCH)
    decision-owner/route.ts               — Ownership-Heartbeat
    model-routing/route.ts                — Modell-Routing-Konfiguration
    model-routing-log/route.ts            — Routing-Log persistieren
    annotations/route.ts                  — Forscher-Annotationen
    errors/route.ts                       — Fehler-Logging
    summary/live/route.ts                 — Live-Zusammenfassung (LLM)

components/
  LiveKitRoom.tsx                         — Video-UI + P2P-Sync
  IdeaBoard.tsx                           — Ideen-Graph (React Flow)
  TranscriptFeed.tsx                      — Transkript-Anzeige
  ChatFeed.tsx                            — Chat-artige Transkript-Anzeige
  OverlayPanel.tsx                        — Transkript, Metriken, Interventionen
  DesktopTabLayout.tsx                    — Tabbed Sidebar (Desktop)
  DashboardTab.tsx                        — Engine-Phase, Cooldown, Budget
  SettingsTab.tsx                         — TTS-Einstellungen
  DebugPanel.tsx                          — System-Health, Fehler, Logs
  ReadinessCheck.tsx                      — Pre-Session-Gate
  SessionReplayView.tsx                   — Post-Session Timeline-Replay
  LiveTuningPanel.tsx                     — Live-Schwellenwert-Anpassung
  ModelRoutingPanel.tsx                   — Modell-Auswahl + Routing-Log
  VoiceControls.tsx                       — TTS-Test/Cancel
  ExportButton.tsx                        — Session-Export
  LiveSummaryTab.tsx                      — Rolling-Zusammenfassung
  shared/                                 — Wiederverwendbare UI-Komponenten
  replay/                                 — Replay-Subkomponenten
  setup/                                  — Setup-Flow-Subkomponenten

lib/
  types.ts                                — Alle geteilten TypeScript-Typen
  context/
    SessionContext.tsx                    — React Context + Reducer
  hooks/
    useDecisionLoop.ts                    — Entscheidungs-Engine (Intervall)
    useMetricsComputation.ts              — Metriken-Orchestrierung
    useTranscriptionManager.ts            — Lokale Mikrofon-Transkription
    useLiveKitSync.ts                     — P2P-Sync via LiveKit DataChannel
    useRealtimeSegments.ts                — Supabase Realtime: Segmente
    useRealtimeIdeas.ts                   — Supabase Realtime: Ideen
    useRealtimeMetrics.ts                 — Supabase Realtime: Metriken
    useRealtimeInterventions.ts           — Supabase Realtime: Interventionen
    useRealtimeEngineState.ts             — Supabase Realtime: Engine-State
    useRealtimeConnections.ts             — Supabase Realtime: Ideen-Verbindungen
    useRealtimeVoiceSettings.ts           — Supabase Realtime: TTS-Settings
    useIdeaExtraction.ts                  — LLM-Ideenextraktion (periodisch)
    useLiveSummary.ts                     — Rolling-Zusammenfassung (LLM)
    useDecisionOwnership.ts               — Server-Side Ownership-Lock
    useMediaQuery.ts                      — CSS Media Query Hook
    useLatestRef.ts                       — Ref-Utility (Closure-Safety)
    useLiveKitErrorSuppression.ts         — LiveKit-Fehler unterdruecken
    session/
      useSessionLifecycle.ts              — Session-Init + Cleanup
      useSessionOrchestration.ts          — Master-Hook (komponiert alle Sub-Hooks)
      usePeerSync.ts                      — Peer-Interim-Transkripte empfangen
      useSegmentUpload.ts                 — Segment-Upload-Queue
      useTTSManager.ts                    — TTS-Wiedergabe
    sync/
      useSupabaseChannel.ts              — Generischer Supabase Realtime Hook
  services/
    apiClient.ts                          — HTTP-Client (Retry, Fire-and-Forget)
    sessionService.ts                     — Session-API-Wrapper
    segmentService.ts                     — Segment-Persistenz
    metricsService.ts                     — Metrik-Persistenz
    interventionService.ts                — Interventions-Persistenz
    ideaService.ts                        — Ideen-Persistenz
    eventService.ts                       — Event-Logging
  decision/
    interventionPolicy.ts                 — Policy-Engine (4 Phasen)
    ruleViolationChecker.ts               — LLM-Regelpruefung
    interventionExecutor.ts               — Interventions-Ausfuehrung
    transcriptContext.ts                  — Kontext-Aufbau
    postCheck.ts                          — Erholungs-Evaluation
    tickConfig.ts                         — Timing-Konstanten
  state/
    inferConversationState.ts             — 5-Zustands-Inferenz mit Hysterese
    generateSessionReport.ts              — Post-Session-Report
  metrics/
    participation.ts                      — Partizipations-Metriken (v2)
    semanticDynamics.ts                   — Semantische Dynamik-Metriken (v2)
    computeMetrics.ts                     — Gefensterte Metrik-Berechnung
    embeddingCache.ts                     — Embedding-Cache (localStorage + Memory)
  supabase/
    client.ts                             — Browser Supabase-Client (Anon-Key)
    server.ts                             — Server Supabase-Client (Service-Role)
    types.ts                              — Database-Interface (TypeScript)
    converters.ts                         — DB-Row <-> App-Type Konverter
  transcription/
    useOpenAIRealtimeStream.ts            — Primaere Transkriptions-Engine
    useSpeechRecognition.ts               — Web Speech API Fallback
  tts/
    useCloudTTS.ts                        — Cloud TTS (OpenAI)
  llm/
    openai.ts                             — OpenAI API Wrapper
  prompts/                                — Alle LLM-Prompt-Templates
  config/
    index.ts                              — DEFAULT_CONFIG mit Schwellenwerten
    modelRouting.ts                        — Modell-Routing-Strategie
    promptVersion.ts                      — Prompt-Versionierung

supabase/
  schema.sql                              — Vollstaendiges DB-Schema
```

---

## 4. Session-Lebenszyklus

### 4.1 Setup (`app/page.tsx`)

1. Host waehlt Szenario (baseline/A/B), Sprache (de-CH/en-US), Raumnamen
2. Optionale Konfiguration der Schwellenwerte und Zeitparameter
3. Konfiguration wird in `localStorage` gespeichert
4. Weiterleitung zu `/call/[room]?scenario=A&lang=de-CH&config=<base64>`

### 4.2 Session-Start (`app/call/[room]/page.tsx`)

**Host-Ablauf:**
1. Konfiguration aus URL-Parametern dekodieren
2. POST `/api/session` — Session in Supabase erstellen + Engine-State initialisieren
3. SessionId in React-Context setzen
4. Supabase Realtime-Subscriptions starten
5. POST `/api/decision-owner` — Decision-Ownership beanspruchen
6. Embedding-Cache aus localStorage laden

**Teilnehmer-Ablauf:**
1. POST `/api/session/join` — Session beitreten (Name-Deduplizierung)
2. SessionId + Konfiguration empfangen
3. GET `/api/segments`, `/api/interventions`, `/api/ideas` — Initiale Daten laden
4. Supabase Realtime-Subscriptions starten

### 4.3 Aktive Session

Hook-Orchestrierung via `useSessionOrchestration`:

| Hook | Intervall | Laeuft bei |
|------|-----------|------------|
| `LiveKitSession` (Speaking-Tracking) | 500ms | Alle |
| `useTranscriptionManager` (OpenAI Realtime) | Kontinuierlich | Alle |
| `useLiveKitSync` (P2P DataChannel) | Event-basiert | Alle |
| `useRealtimeSegments` (Supabase) | Event-basiert | Alle |
| `useRealtimeIdeas` (Supabase) | Event-basiert | Alle |
| `useRealtimeInterventions` (Supabase) | Event-basiert | Alle |
| `useRealtimeEngineState` (Supabase) | Event-basiert | Nicht-Owner |
| `useMetricsComputation` | 5000ms | Decision-Owner |
| `useDecisionLoop` | 2000ms | Decision-Owner |
| `useIdeaExtraction` | Periodisch | Decision-Owner |
| `useLiveSummary` | 60s | Decision-Owner |
| `useDecisionOwnership` (Heartbeat) | 30s | Host |

### 4.4 Session-Ende

1. PATCH `/api/session` — `ended_at` setzen, Teilnehmer als `left_at` markieren
2. Alle Intervalle und Subscriptions stoppen automatisch
3. Optionaler Post-Session-Report via `/api/session/report`
4. Export via `/api/session/export` — aggregiert alle Daten aus Supabase

---

## 5. LiveKit-Integration

### 5.1 Token-Generierung

**Endpoint:** `POST /api/livekit/token`

```
Request:  { room: string, identity: string, name?: string }
Response: { token: string }
```

Server erstellt ein JWT mit `livekit-server-sdk`:
```typescript
const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity,
  name: name || identity,
  ttl: '6h',
});
at.addGrant({
  room,
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
});
```

### 5.2 Video-UI (`components/LiveKitRoom.tsx`)

Zwei verschachtelte Komponenten:

**Aeussere Komponente (`LiveKitRoomComponent`):**
- Holt Token von `/api/livekit/token` beim Mount
- Rendert `<LKRoom>` mit LiveKit-SDK-Komponenten (`<VideoConference>`, `<RoomAudioRenderer>`)
- Enthaelt die innere `<LiveKitSession>` Komponente

**Innere Komponente (`LiveKitSession`):**
- `useConnectionState()` — Verbindungsstatus nach oben melden
- `useRemoteParticipants()` — Teilnehmerliste nach oben melden
- 500ms-Intervall: `participant.isSpeaking` abfragen, Sprechzeit akkumulieren
- `useLiveKitSync(...)` — P2P-Synchronisation via DataChannel
- `useLiveKitErrorSuppression()` — Bekannte LiveKit-Fehler unterdruecken

### 5.3 P2P-Synchronisation (`lib/hooks/useLiveKitSync.ts`)

Bidirektionale Echtzeit-Synchronisation via LiveKit DataChannel:

| Topic | Daten | Richtung |
|-------|-------|----------|
| `transcript_interim` | Interim-Transkripte | Broadcast |
| `transcript_final` | Finale Segmente | Broadcast |
| `intervention` | Interventionen | Broadcast |

Latenz: ~50ms (WebRTC Data Channel, schneller als Supabase Realtime)

### 5.4 Webhook (`POST /api/livekit/webhook`)

Empfaengt LiveKit-Events. Bei `room_finished` wird die Session automatisch geschlossen.

---

## 6. Transkriptions-Pipeline

Das System verwendet die OpenAI Realtime API als primaere Transkriptions-Engine.

### 6.1 Primaer: OpenAI Realtime API (`lib/transcription/useOpenAIRealtimeStream.ts`)

**Ablauf:**
```
Lokales Mikrofon
  → MediaStream
    → AudioWorklet (oder ScriptProcessorNode Fallback)
      → PCM16 Audio-Chunks
        → WebSocket zu OpenAI Realtime API
          → Server-seitiges VAD (Voice Activity Detection)
          → Echtzeit-Transkription
            → Interim-Updates (conversation.item.input_audio_transcription.delta)
            → Finale Segmente (conversation.item.input_audio_transcription.completed)
              → TranscriptSegment
```

**Token-Endpoint:** `POST /api/transcription/token`
- Erstellt ephemeren OpenAI Realtime Token mit Server-Side VAD
- Rate-Limited

**Features:**
- Automatische Reconnection mit Exponential Backoff
- AudioWorklet mit ScriptProcessorNode-Fallback
- Server-seitige VAD (kein Client-seitiges Speaking-Detection noetig)

### 6.2 Fallback: Web Speech API (`lib/transcription/useSpeechRecognition.ts`)

**Ablauf:**
```
Lokales Mikrofon
  → SpeechRecognition (Browser-API, continuous)
    → onResult({ text, isFinal })
      → TranscriptSegment { speaker: 'You', isFinal }
```

Wird verwendet wenn OpenAI Realtime nicht verfuegbar ist.

### 6.3 TranscriptSegment-Format

```typescript
interface TranscriptSegment {
  id: string;        // z.B. "rt-1709812345000-0" oder "speech-1709812345000"
  speaker: string;   // "You", "Max", "Anna" etc.
  text: string;
  timestamp: number; // Unix-Millisekunden
  isFinal: boolean;
  language?: string; // z.B. "de-CH"
}
```

---

## 7. Metriken-System

### 7.1 Orchestrierung (`lib/hooks/useMetricsComputation.ts`)

Laeuft als Intervall alle `ANALYZE_EVERY_MS` (5000ms), nur beim Decision-Owner.

```
Intervall-Tick
  → computeMetricsAsync(segments, config, now, speakingTimes, history)
      → getOrFetchEmbeddings(finalSegments)           // Cached
      → computeParticipationMetrics(...)               // v2
      → computeSemanticDynamicsMetrics(...)             // v2
      → MetricSnapshot
  → inferConversationState(metrics, previousInference)
      → ConversationStateInference
  → metrics.inferredState = inference
  → addMetricSnapshot(metrics)
  → persistMetricsSnapshot() (alle 30s, gedrosselt)
```

### 7.2 Partizipations-Metriken (`lib/metrics/participation.ts`)

| Metrik | Berechnung | Wertebereich |
|--------|-----------|-------------|
| `volumeShare` | Woerter pro Sprecher / Gesamt | 0-1 pro Sprecher |
| `turnShare` | Finale Segmente pro Sprecher / Gesamt | 0-1 pro Sprecher |
| `silentParticipantRatio` | Sprecher mit < 5% Volumen / Gesamt | 0-1 |
| `dominanceStreakScore` | Laengste ununterbrochene Reihe eines Sprechers (normalisiert) | 0-1 |
| `participationRiskScore` | Gewichteter Composite | 0-1 |

**Participation Risk Score:**
```
0.35 * giniImbalance
+ 0.25 * silentParticipantRatio
+ 0.25 * dominanceStreakScore
+ 0.15 * turnShareGini
```

### 7.3 Semantische Dynamik-Metriken (`lib/metrics/semanticDynamics.ts`)

| Metrik | Berechnung | Wertebereich |
|--------|-----------|-------------|
| `noveltyRate` | Anteil neuer Ideen (Cosinus-Aehnlichkeit < 0.80) | 0-1 |
| `clusterConcentration` | HHI ueber Ideen-Cluster | 0-1 |
| `explorationElaborationRatio` | Exploration vs. Vertiefung | 0-1 |
| `semanticExpansionScore` | Trend-Aenderung der Konzentration + Neuheit | -1 bis 1 |

**Cluster-Algorithmus:** Gieriges Centroid-Clustering mit Merge-Schwelle 0.75 (Cosinus-Aehnlichkeit).

**Fallback:** Ohne Embeddings wird Jaccard-Aehnlichkeit mit Schwelle 0.40 verwendet.

### 7.4 Embedding-Cache (`lib/metrics/embeddingCache.ts`)

- In-Memory `Map<string, number[]>` + LRU-Timestamps
- Persistiert in `localStorage` (Key: `uzh-brainstorming-embeddings`)
- Max 500 Eintraege (~6MB)
- Deduplizierung: Identische Texte teilen sich einen Embedding-Vektor
- Eviction: Aelteste 25% bei `QuotaExceededError`

### 7.5 MetricSnapshot-Format

```typescript
interface MetricSnapshot {
  id: string;
  timestamp: number;
  // v1
  speakingTimeDistribution: Record<string, number>;
  participationImbalance: number;
  semanticRepetitionRate: number;
  stagnationDuration: number;
  diversityDevelopment: number;
  windowStart: number;
  windowEnd: number;
  // v2
  participation?: ParticipationMetrics;
  semanticDynamics?: SemanticDynamicsMetrics;
  inferredState?: ConversationStateInference;
}
```

---

## 8. Zustandsinferenz

### 8.1 Fuenf Gespraechszustaende (`lib/state/inferConversationState.ts`)

| Zustand | Bedeutung | Primaere Indikatoren |
|---------|----------|---------------------|
| `HEALTHY_EXPLORATION` | Gruppe erkundet breit | Hohe Neuheit, niedrige Partizipations-Risiko |
| `HEALTHY_ELABORATION` | Gruppe vertieft Ideen | Niedrige Neuheit, aber Expansion |
| `DOMINANCE_RISK` | Ungleiche Beteiligung | Hohes Partizipations-Risiko, stille Teilnehmer |
| `CONVERGENCE_RISK` | Ideen verengen sich | Hohe Cluster-Konzentration, niedrige Neuheit |
| `STALLED_DISCUSSION` | Diskussion stagniert | Hohe Stagnationsdauer, keine Expansion |

### 8.2 Konfidenz-Berechnung

Jeder Zustand bekommt einen Konfidenz-Score (0-1):

**HEALTHY_EXPLORATION:**
```
0.25 * (1 - participationRiskScore)
+ 0.30 * noveltyRate
+ 0.20 * clamp(semanticExpansionScore + 0.5, 0, 1)
+ 0.25 * explorationElaborationRatio
```

**HEALTHY_ELABORATION:**
```
Gate: participationRiskScore > 0.5 → return 0

(0.20 * (1 - risk)
+ 0.25 * (1 - novelty)
+ 0.25 * (1 - exploration)
+ 0.15 * (1 - concentration)
+ 0.15 * expansionBonus) * (1 - stagnationPenalty)
```

**DOMINANCE_RISK:**
```
0.35 * participationRiskScore
+ 0.25 * silentParticipantRatio
+ 0.20 * dominanceStreakScore
+ 0.20 * participationImbalance
```

**CONVERGENCE_RISK:**
```
0.25 * clusterConcentration
+ 0.20 * (1 - noveltyRate)
+ 0.20 * (1 - explorationElaborationRatio)
+ 0.35 * clamp(-semanticExpansionScore, 0, 1)
```

**STALLED_DISCUSSION:**
```
0.25 * (1 - noveltyRate)
+ 0.30 * clamp(stagnationDuration / 180, 0, 1)
+ 0.25 * clamp(-semanticExpansionScore, 0, 1)
+ 0.20 * (1 - diversityDevelopment)
```

### 8.3 Hysterese und Tiebreaker

- **Hysterese-Marge: 0.08** — Zustandswechsel nur wenn der neue Zustand mindestens 0.08 hoeher als der aktuelle ist
- **Tiebreak-Marge: 0.03** — Risiko-Zustaende gewinnen innerhalb dieser Marge gegen gesunde Zustaende
- **Risiko-Prioritaet:** `STALLED_DISCUSSION > DOMINANCE_RISK > CONVERGENCE_RISK > HEALTHY_EXPLORATION > HEALTHY_ELABORATION`

### 8.4 ConversationStateInference-Format

```typescript
interface ConversationStateInference {
  state: ConversationStateName;
  confidence: number;
  secondaryState: ConversationStateName | null;
  secondaryConfidence: number;
  enteredAt: number;
  durationMs: number;
  criteriaSnapshot: Record<string, number>;
}
```

---

## 9. Interventions-Engine

### 9.1 Policy-Engine (`lib/decision/interventionPolicy.ts`)

Vier Phasen:

```
MONITORING → CONFIRMING (30s) → POST_CHECK (90s) → COOLDOWN (180s)
     ↑                                                    |
     └────────────────────────────────────────────────────┘
```

**MONITORING:**
1. Kein Risiko erkannt → bleibt in MONITORING
2. Risiko erkannt → `phase = 'CONFIRMING'`, Timer starten
3. Persistenz-Check: ≥70% der Snapshots im Bestaetigungs-Fenster muessen gleichen Zustand zeigen
4. Bestaetigt → `shouldIntervene = true`, Wechsel zu POST_CHECK

**POST_CHECK (nach Intervention):**
1. Wartet `POST_CHECK_SECONDS` (90s)
2. Ruft `evaluateRecovery(intent, currentMetrics, metricsAtIntervention)` auf
3. Erholung erkannt → zurueck zu MONITORING
4. Keine Erholung + Szenario B → Eskalation zu Ally (`intent = 'ALLY_IMPULSE'`)
5. Keine Erholung + Szenario A → zurueck zu MONITORING

**COOLDOWN:**
- Wartet bis `cooldownUntil` abgelaufen (180s)
- Dann zurueck zu MONITORING

### 9.2 Intent-Mapping

| Zustand | Intent |
|---------|--------|
| `DOMINANCE_RISK` | `PARTICIPATION_REBALANCING` |
| `CONVERGENCE_RISK` | `PERSPECTIVE_BROADENING` |
| `STALLED_DISCUSSION` | `REACTIVATION` |
| (Eskalation) | `ALLY_IMPULSE` |

### 9.3 Rate-Limiting

- Max `MAX_INTERVENTIONS_PER_10MIN` (3) Interventionen pro 10-Minuten-Fenster (Sliding Window)
- Minimale Konfidenz: 0.45 fuer Risiko-Zustaende
- Cooldown: 180s nach jeder Intervention
- Szenario `baseline` → keine Interventionen

### 9.4 Erholungs-Evaluation (`lib/decision/postCheck.ts`)

Jeder Intent hat spezifische Erholungskriterien:

**PARTICIPATION_REBALANCING:**
```
riskDelta = (prevRisk - currRisk) / prevRisk
recovered = riskDelta >= 0.15 AND (silentImproved OR turnImproved)
score = 0.6 * riskDelta + 0.4 * silentDelta
```

**PERSPECTIVE_BROADENING:**
```
noveltyImproved = currNovelty - prevNovelty >= 0.10
concentrationImproved = prevConcentration - currConcentration >= 0.08
recovered = noveltyImproved AND concentrationImproved
score = 0.5 * noveltyDelta + 0.5 * concentrationDelta
```

**REACTIVATION:**
```
noveltyImproved = delta >= 0.10
expansionImproved = currExpansion > 0 OR delta >= 0.20
recovered = noveltyImproved AND (expansionImproved OR stagnationImproved)
score = 0.5 * noveltyDelta/0.3 + 0.5 * expansionDelta/0.5
```

**ALLY_IMPULSE:**
```
Prueft: novelty (delta >= 0.05), risk (delta >= 0.05), stagnation (delta >= 15s)
score = improvements / 3
```

### 9.5 Decision Loop (`lib/hooks/useDecisionLoop.ts`)

Laeuft alle 2000ms beim Decision-Owner:

```
1. Pruefe: isActive, isDecisionOwner, !baseline, metrics vorhanden
2. Rate-Limit pruefen (Sliding Window, 10min)
3. evaluatePolicy(inferredState, metrics, history, engineState, config, scenario)
4. Bei stateUpdateOnly → updateDecisionState()
5. Bei recoveryResult → updateIntervention() am letzten Eingriff
6. Bei shouldIntervene:
   a. Kontext aufbauen (letzte 200 Segmente, letzte 3 Interventionen)
   b. POST /api/intervention/moderator ODER /api/intervention/ally
   c. Intervention erstellen, TTS abspielen
   d. DecisionState aktualisieren
   e. Engine-State in Supabase persistieren
```

### 9.6 Decision-Ownership (`lib/hooks/useDecisionOwnership.ts`)

Nur ein Client pro Session fuehrt die Decision-Engine aus:

```
POST /api/decision-owner { sessionId, clientId }
  → Server prueft: Existierender Owner mit aktivem Heartbeat?
  → Ja: isOwner = false
  → Nein (kein Owner oder stale): isOwner = true
  → Heartbeat alle 30s erneuern
```

### 9.7 Regelpruefung (`lib/decision/ruleViolationChecker.ts`)

LLM-basierte Pruefung auf Brainstorming-Regelverstoeße:

```
POST /api/rule-check { segments, language }
  → gpt-4o-mini klassifiziert Segmente
  → { violated, rule, severity, evidence }
  → Bei Verstoß: Moderator-Intervention mit `trigger = 'rule_violation'`
```

---

## 10. Ideen-System

### 10.1 LLM-Ideenextraktion (`lib/hooks/useIdeaExtraction.ts`)

Periodisch extrahiert der Decision-Owner Ideen aus neuen Transkript-Segmenten:

```
POST /api/ideas/extract {
  segments, contextSegments, existingTitles, existingIdeas, language
}
  → LLM extrahiert Ideen + Verbindungen
  → Deduplizierung gegen existierende Titel
  → { ideas: [{title, description, author, ideaType, parentId}], connections: [...] }
```

**Ideen-Typen:** `brainstorming_ideas`, `ally_intervention`, `action_item`

### 10.2 Ideen-Board (`components/IdeaBoard.tsx`)

Visuelle Darstellung der Ideen als Graph via `@xyflow/react`:
- Sticky-Note-artige Knoten mit Farb-Kodierung
- Gerichtete Kanten zwischen verbundenen Ideen
- Drag-and-Drop-Positionierung (persistiert in Supabase)

### 10.3 Persistenz

- POST `/api/ideas` — Idee erstellen/aktualisieren
- PATCH `/api/ideas` — Position, Farbe, Soft-Delete
- POST `/api/ideas/connections` — Verbindung erstellen
- Supabase Realtime synchronisiert Ideen und Verbindungen an alle Clients

---

## 11. API-Routen

### 11.1 Session-Management

| Route | Methoden | Beschreibung |
|-------|----------|-------------|
| `/api/session` | POST, GET, PUT, PATCH | Session erstellen, abrufen, aktualisieren, beenden |
| `/api/session/join` | POST | Session beitreten (Name-Deduplizierung) |
| `/api/session/participants` | POST, PATCH, DELETE | Teilnehmer-Lifecycle (Register/Heartbeat/Leave) |
| `/api/session/export` | GET | Vollstaendiger Session-Export aus Supabase |
| `/api/session/report` | GET | Post-Session-Report (mit optionaler LLM-Zusammenfassung) |
| `/api/session/cleanup` | POST | Stale Sessions bereinigen (Cron-sicher) |
| `/api/session/events` | POST, GET | Session-Events fuer Analytics |
| `/api/sessions` | GET | Alle Sessions auflisten |

### 11.2 Daten-Persistenz

| Route | Methoden | Beschreibung |
|-------|----------|-------------|
| `/api/segments` | POST, GET | Transkript-Segmente (idempotenter Upsert) |
| `/api/ideas` | POST, GET, PATCH | Ideen CRUD (mit Soft-Delete) |
| `/api/ideas/extract` | POST | LLM-Ideenextraktion aus Transkript |
| `/api/ideas/connections` | POST, GET | Ideen-Verbindungen |
| `/api/metrics/snapshot` | POST | Metrik-Snapshot persistieren |
| `/api/engine-state` | PUT, GET | Engine-State Upsert/Abruf |
| `/api/interventions` | POST, GET, PATCH | Interventionen CRUD |
| `/api/decision-owner` | POST, DELETE | Ownership-Lock (Heartbeat) |
| `/api/annotations` | GET, POST | Forscher-Annotationen |
| `/api/errors` | POST, GET | Fehler-Logging |
| `/api/model-routing-log` | POST | Routing-Decision-Log |

### 11.3 LLM/AI-Endpunkte

| Route | Methoden | Beschreibung |
|-------|----------|-------------|
| `/api/intervention/moderator` | POST | LLM-Moderator-Intervention (Rate-Limited) |
| `/api/intervention/ally` | POST | LLM-Ally-Impuls (nur Szenario B, Rate-Limited) |
| `/api/rule-check` | POST | LLM-Regelverstoss-Erkennung |
| `/api/summary/live` | POST | Rolling-Zusammenfassung (LLM) |
| `/api/embeddings` | POST | OpenAI Embeddings (Batch max 50) |
| `/api/transcription/token` | POST | Ephemerer OpenAI Realtime Token |
| `/api/tts` | POST | Cloud TTS Streaming |

### 11.4 Infrastruktur

| Route | Methoden | Beschreibung |
|-------|----------|-------------|
| `/api/livekit/token` | POST | LiveKit JWT-Token (6h TTL) |
| `/api/livekit/webhook` | POST | LiveKit Webhook-Events |
| `/api/model-routing` | GET, PUT | Modell-Routing-Konfiguration |

---

## 12. LLM-Prompts

### 12.1 Moderator — System-Prompt

**Deutsch:**
```
Du bist ein erfahrener Brainstorming-Moderator. Deine Aufgabe ist es, die Gruppendiskussion
durch kurze, prozessbezogene Beobachtungen sanft zu lenken.

WICHTIGE REGELN:
1. Mache NUR Prozessreflexionen – trage NIEMALS eigene Ideen bei.
2. Halte Antworten auf maximal 1-2 kurze Saetze.
3. Sei neutral, ermutigend und konstruktiv.
4. Formuliere Beobachtungen als Fragen oder sanfte Prozess-Vorschlaege.
5. Fokussiere auf Gruppendynamik, nicht auf Inhalte.
6. Antworten muessen fuer Sprachausgabe geeignet sein.
7. Adressiere NIEMALS einzelne Personen direkt.
```

### 12.2 Moderator — User-Prompts (Intent-basiert)

| Intent | Kontext | Anweisung |
|--------|---------|-----------|
| `PARTICIPATION_REBALANCING` | participationRiskScore, silentParticipantRatio, dominanceStreakScore | Sanfte Prozessreflexion fuer ausgewogenere Beteiligung |
| `PERSPECTIVE_BROADENING` | clusterConcentration, noveltyRate, explorationRatio | Ermutigung, verschiedene Blickwinkel zu erkunden |
| `REACTIVATION` | stagnationDuration, noveltyRate, expansionScore | Energetisierende Prozessreflexion |
| `rule_violation` | rule, evidence, severity | Normen-Verstaerkung ohne Beschuldigung |

### 12.3 Ally — System-Prompt

```
Du bist ein kreativer Verbuendeter in einer Brainstorming-Sitzung. Deine Aufgabe ist es,
frische Energie und neue Perspektiven einzubringen, wenn die Gruppe feststeckt.

WICHTIGE REGELN:
1. Gib EINEN kurzen, kreativen Impuls oder unerwarteten Blickwinkel.
2. Maximal 1-2 Saetze.
3. Gib KEINE fertigen Loesungen vor, sondern rege zum Nachdenken an.
4. Sei spielerisch und energetisierend.
5. Verwende Sprache, die Neugier weckt und Perspektivwechsel erzwingt.
6. Antworten muessen fuer Sprachausgabe geeignet sein.
7. Wiederhole KEINE Themen aus vorherigen Interventionen.
```

### 12.4 Fallback-Texte (bei LLM-Fehler)

Statische, vorformulierte Antworten pro Intent in DE und EN.

| Intent | Deutsch | English |
|--------|---------|---------|
| PARTICIPATION_REBALANCING | "Es waere bereichernd, noch mehr Perspektiven zu hoeren..." | "It feels like we could benefit from hearing more perspectives..." |
| PERSPECTIVE_BROADENING | "Welche voellig andere Richtung koennten wir erkunden?" | "What completely different direction could we explore?" |
| REACTIVATION | "Welche Dimensionen sind noch offen?" | "What dimensions are still open?" |

### 12.5 LLM-Client und Fallback-Kette

```
callLLM(task, routingConfig, messages, apiKey)
  → Primaeres Modell versuchen (z.B. gpt-4o)
    → Bei Fehler: Fallback 1 (z.B. gpt-4o-mini)
      → Bei Fehler: Fallback 2 (z.B. gpt-3.5-turbo)
        → Alle fehlgeschlagen: HTTP 200 mit Fallback-Text
```

---

## 13. Datensynchronisation

### 13.1 Drei-Schicht-Architektur

| Schicht | Technologie | Latenz | Verwendung |
|---------|-----------|---------|----------|
| **Lokal** | React Context + useReducer | Sofort | Single-Client-Mutationen + Deduplizierung |
| **P2P Fast Path** | LiveKit DataChannel (WebRTC) | ~50ms | Interim-Transkripte, finale Segmente, Interventionen |
| **Autoritativ** | Supabase Realtime (WebSocket) | ~200ms | Persistenz, Metriken, Ideen, Engine-State (Source of Truth) |

### 13.2 Supabase Realtime-Subscriptions

Generischer Hook `useSupabaseChannel` mit:
- Race-Condition-Schutz bei ueberlappenden `subscribe()` Aufrufen
- Exponential Backoff: 1s, 2s, 4s, 8s, 16s (max 5 Versuche)
- In-Memory Deduplizierung (Set, gecappt bei 5000, evicted aelteste 1000)
- Custom Filter pro Tabelle

| Subscription | Tabelle | Event | Empfaenger |
|-------------|---------|-------|-----------|
| Segmente | `transcript_segments` | INSERT | Alle |
| Metriken | `metric_snapshots` | INSERT | Nicht-Owner |
| Interventionen | `interventions` | INSERT | Alle (+ TTS) |
| Engine-State | `engine_state` | UPDATE | Nicht-Owner |
| Ideen | `ideas` | INSERT, UPDATE | Alle |
| Verbindungen | `idea_connections` | INSERT | Alle |
| Voice-Settings | `sessions` | UPDATE | Teilnehmer |

### 13.3 Deduplizierungs-Strategie

Drei Ebenen verhindern Doppelverarbeitung:

1. **Hook-Ebene:** `useRealtimeSegments` trackt `knownIds` (Set<string>, max 5000)
2. **Reducer-Ebene:** SessionContext dedupliziert via ID bei allen ADD-Actions
3. **TTS-Ebene:** `spokenInterventionIdsRef` verhindert doppelte Sprachausgabe

### 13.4 Persistenz-Pattern: Fire-and-Forget

Asynchrone Operationen blockieren nicht die UI:

```typescript
apiFireAndForget('/api/segments', {
  method: 'POST',
  body: JSON.stringify({ sessionId, segment }),
});
```

- 3 Retries bei Netzwerkfehlern (fuer Segmente)
- `keepalive: true` bei Session-Ende (ueberlebt Navigation)
- Fehler werden geloggt, aber nicht an den User propagiert

### 13.5 Supabase-Schema (Uebersicht)

| Tabelle | Beschreibung | Realtime |
|---------|-------------|----------|
| `sessions` | Session-Metadaten, Konfiguration, Report | Ja (UPDATE) |
| `session_participants` | Teilnehmer mit Heartbeat | Nein |
| `transcript_segments` | Transkript-Segmente | Ja (INSERT) |
| `metric_snapshots` | Metriken + Zustandsinferenz | Ja (INSERT) |
| `interventions` | KI-Interventionen + Recovery | Ja (INSERT) |
| `engine_state` | Decision-Engine Phase (Singleton pro Session) | Ja (UPDATE) |
| `ideas` | Extrahierte Ideen | Ja (INSERT, UPDATE) |
| `idea_connections` | Verbindungen zwischen Ideen | Ja (INSERT) |
| `model_routing_logs` | LLM-Routing-Telemetrie | Nein |
| `intervention_annotations` | Forscher-Bewertungen | Nein |
| `session_errors` | Laufzeit-Fehler | Nein |
| `session_events` | Lifecycle-Events | Nein |

---

## 14. Session-Kontext

### 14.1 State-Struktur (`lib/context/SessionContext.tsx`)

```typescript
interface SessionState {
  sessionId: string | null;
  isActive: boolean;
  startTime: number | null;
  roomName: string;
  scenario: Scenario;
  language: string;
  config: ExperimentConfig;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: MetricSnapshot[];
  interventions: Intervention[];
  ideas: Idea[];
  ideaConnections: IdeaConnection[];
  decisionState: DecisionEngineState;
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: SessionError[];
}
```

### 14.2 Memory-Caps

| Array | Max Eintraege | Ausreichend fuer |
|-------|--------------|-----------------|
| `transcriptSegments` | 15.000 | ~30 min @ 6 Teilnehmer |
| `metricSnapshots` | 720 | ~60 min @ 5s Intervall |
| `ideas` | 500 | Vollstaendige Session |
| `ideaConnections` | 1.000 | Vollstaendige Session |
| `modelRoutingLog` | 500 | Vollstaendige Session |
| `errors` | 100 | Vollstaendige Session |

### 14.3 Decision Engine State

```typescript
interface DecisionEngineState {
  phase: EnginePhase;               // MONITORING | CONFIRMING | POST_CHECK | COOLDOWN
  confirmingSince: number | null;
  confirmingState: ConversationStateName | null;
  postCheckIntent: InterventionIntent | null;
  lastInterventionTime: number | null;
  interventionCount: number;         // legacy: kept for Supabase backward compat
  persistenceStartTime: number | null;
  postCheckStartTime: number | null;
  cooldownUntil: number | null;
  metricsAtIntervention: MetricSnapshot | null;
  triggerAtIntervention: InterventionTrigger | null;
}
```

### 14.4 Actions

| Action | Beschreibung |
|--------|-------------|
| `START_SESSION` | Session initialisieren |
| `SET_SESSION_ID` | SessionId setzen (nach POST /api/session) |
| `END_SESSION` | Session beenden |
| `ADD_TRANSCRIPT_SEGMENT` | Segment hinzufuegen (mit Dedup) |
| `ADD_METRIC_SNAPSHOT` | Metrik-Snapshot speichern (mit Dedup) |
| `ADD_INTERVENTION` | Intervention hinzufuegen (mit Dedup) |
| `UPDATE_INTERVENTION` | Erholungsergebnis anhaengen |
| `UPDATE_DECISION_STATE` | Engine-State partiell aktualisieren |
| `ADD_IDEA` | Idee hinzufuegen (mit Dedup) |
| `ADD_IDEA_CONNECTION` | Verbindung hinzufuegen |
| `UPDATE_VOICE_SETTINGS` | TTS-Einstellungen aendern |
| `ADD_MODEL_ROUTING_LOG` | API-Aufruf protokollieren |
| `ADD_ERROR` | Fehler protokollieren |

---

## 15. Datenfluss-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                        app/call/[room]/page.tsx                     │
│                         (SessionProvider)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐   │
│  │  LiveKitRoom     │    │  useTranscriptionManager             │   │
│  │  ┌────────────┐  │    │  (OpenAI Realtime → Transkription)   │   │
│  │  │ LiveKit    │  │    └──────────┬───────────────────────────┘   │
│  │  │ Session    │  │               │                               │
│  │  │            │  │               │ TranscriptSegment             │
│  │  │ isSpeaking │  │               ▼                               │
│  │  │ 500ms poll │  │    ┌──────────────────────────────────────┐   │
│  │  │    ↓       │  │    │  SessionContext (useReducer)          │   │
│  │  │ speaking   │  │    │  - transcriptSegments (max 15k)      │   │
│  │  │ TimeRef    │  │    │  - metricSnapshots (max 720)         │   │
│  │  │            │  │    │  - interventions                     │   │
│  │  │ useLiveKit │  │    │  - ideas + ideaConnections           │   │
│  │  │ Sync       │──┼───→│  - decisionState                    │   │
│  │  │ (P2P Data  │  │    │  - Dedup via ID                     │   │
│  │  │  Channel)  │  │    └──────────┬───────────────────────────┘   │
│  │  └────────────┘  │               │                               │
│  └──────────────────┘               │ segments + speakingTime       │
│                                     ▼                               │
│                          ┌──────────────────────────────────────┐   │
│                          │  useMetricsComputation (5s)          │   │
│                          │  → computeMetricsAsync               │   │
│                          │    → POST /api/embeddings (cached)   │   │
│                          │    → ParticipationMetrics            │   │
│                          │    → SemanticDynamicsMetrics          │   │
│                          │  → inferConversationState             │   │
│                          └──────────┬───────────────────────────┘   │
│                                     │ MetricSnapshot                │
│                                     ▼                               │
│                          ┌──────────────────────────────────────┐   │
│                          │  useDecisionLoop (2s)                │   │
│                          │  → evaluatePolicy()                  │   │
│                          │    → MONITORING → CONFIRMING (30s)   │   │
│                          │    → POST_CHECK (90s)                │   │
│                          │    → COOLDOWN (180s)                 │   │
│                          │  → Bei shouldIntervene:              │   │
│                          │    → POST /api/intervention/         │   │
│                          │      moderator ODER ally             │   │
│                          │    → speak() (Cloud TTS)             │   │
│                          └──────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Supabase Realtime Subscriptions                             │   │
│  │  → useRealtimeSegments (INSERT → dedupliziert)               │   │
│  │  → useRealtimeInterventions (INSERT → optional TTS)          │   │
│  │  → useRealtimeMetrics (INSERT → Nicht-Owner)                 │   │
│  │  → useRealtimeEngineState (UPDATE → Nicht-Owner)             │   │
│  │  → useRealtimeIdeas (INSERT/UPDATE)                          │   │
│  │  → useRealtimeConnections (INSERT)                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────── API-Routen (Server) ────────────────────────────┐
│                                                                     │
│  /api/livekit/token       → livekit-server-sdk → JWT               │
│  /api/transcription/token → OpenAI Realtime Token                  │
│  /api/tts                 → OpenAI TTS API                         │
│  /api/embeddings          → OpenAI Embeddings API                  │
│  /api/intervention/                                                 │
│    moderator              → OpenAI Chat API (Moderator-Prompt)     │
│    ally                   → OpenAI Chat API (Ally-Prompt)          │
│  /api/rule-check          → OpenAI Chat API (Regel-Klassifikation) │
│  /api/ideas/extract       → OpenAI Chat API (Ideen-Extraktion)     │
│  /api/summary/live        → OpenAI Chat API (Zusammenfassung)      │
│                                                                     │
│  /api/session             → Supabase: sessions                     │
│  /api/segments            → Supabase: transcript_segments          │
│  /api/metrics/snapshot    → Supabase: metric_snapshots             │
│  /api/engine-state        → Supabase: engine_state                 │
│  /api/interventions       → Supabase: interventions                │
│  /api/ideas               → Supabase: ideas                        │
│  /api/ideas/connections   → Supabase: idea_connections             │
│  /api/decision-owner      → Supabase: engine_state                 │
│  /api/model-routing       → Server-Memory (Konfiguration)          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 16. Konfiguration

### 16.1 ExperimentConfig (Standard-Werte)

| Parameter | Wert | Beschreibung |
|-----------|------|-------------|
| `WINDOW_SECONDS` | 180 | Analyse-Zeitfenster in Sekunden |
| `ANALYZE_EVERY_MS` | 5000 | Metriken-Berechnung alle X ms |
| `COOLDOWN_SECONDS` | 180 | Abkuehlzeit nach Intervention |
| `POST_CHECK_SECONDS` | 90 | Wartezeit fuer Erholungs-Pruefung |
| `CONFIRMATION_SECONDS` | 30 | Bestaetigungszeit fuer Risiko-Zustand |
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | Rate-Limit (Sliding Window) |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | Mindest-Score fuer "erholt" |
| `THRESHOLD_SILENT_PARTICIPANT` | 0.05 | Volumen-Schwelle fuer "still" |

### 16.2 Engine-Konstanten (nicht konfigurierbar)

| Konstante | Wert | Ort |
|-----------|------|-----|
| Hysterese-Marge | 0.08 | `inferConversationState.ts` |
| Tiebreak-Marge | 0.03 | `inferConversationState.ts` |
| Min-Konfidenz | 0.45 | `interventionPolicy.ts` |
| Persistenz-Anteil | 70% | `interventionPolicy.ts` |
| Decision-Loop | 2000ms | `useDecisionLoop.ts` |
| Metrics-Loop | 5000ms | `useMetricsComputation.ts` |
| Metrics-Persist | 30s | `useMetricsComputation.ts` |
| Ownership-Heartbeat | 30s | `useDecisionOwnership.ts` |
| Embedding-Cache-Max | 500 | `embeddingCache.ts` |
| Segment-Max | 15.000 | `SessionContext.tsx` |
| Snapshot-Max | 720 | `SessionContext.tsx` |

---

## 17. Umgebungsvariablen

### `.env.local`

```env
# OpenAI (LLM, Whisper, Embeddings, TTS, Realtime)
OPENAI_API_KEY=sk-...

# LiveKit Cloud
LIVEKIT_URL=wss://....livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
NEXT_PUBLIC_LIVEKIT_URL=wss://....livekit.cloud

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://....supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional
CRON_SECRET=...                    # Fuer /api/session/cleanup
LIVEKIT_WEBHOOK_KEY=...            # Fuer /api/livekit/webhook
```

`NEXT_PUBLIC_*` Variablen sind im Browser sichtbar.
Alle anderen werden nur serverseitig in API-Routen verwendet.
