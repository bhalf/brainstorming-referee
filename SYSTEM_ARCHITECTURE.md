# UZH Brainstorming Webapp — Systemarchitektur

Vollstaendige technische Dokumentation des Systems nach der LiveKit-Migration (Maerz 2026).

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
10. [API-Routen](#10-api-routen)
11. [LLM-Prompts](#11-llm-prompts)
12. [Datensynchronisation](#12-datensynchronisation)
13. [Session-Kontext (React State)](#13-session-kontext)
14. [Datenfluss-Diagramm](#14-datenfluss-diagramm)
15. [Konfiguration](#15-konfiguration)
16. [Umgebungsvariablen](#16-umgebungsvariablen)

---

## 1. Ueberblick

Forschungs-Webapp fuer KI-gestuetzte Moderation in Brainstorming-Sitzungen.
Drei experimentelle Szenarien:

| Szenario | Beschreibung |
|----------|-------------|
| **Baseline** | Keine Interventionen — reine Beobachtung |
| **A** | Nur Moderator-Interventionen (Prozessreflexionen) |
| **B** | Moderator + Ally-Eskalation (kreative Impulse bei Nicht-Erholung) |

Der Host (Forscher) startet eine Session, konfiguriert Szenario/Sprache/Parameter und sieht alle Metriken.
Teilnehmer treten ueber einen Raumnamen bei und sehen nur das Video-Interface.

---

## 2. Technologie-Stack

| Komponente | Technologie |
|-----------|-------------|
| Framework | Next.js 16, App Router, TypeScript, React 19 |
| Video/Audio | LiveKit Cloud (WebRTC via SFU) |
| Transkription | OpenAI Whisper API (`whisper-1`) + Web Speech API (Fallback) |
| LLM | OpenAI Chat Completions (konfigurierbare Modelle mit Fallback-Kette) |
| Embeddings | OpenAI Embeddings API (`text-embedding-3-small`) |
| TTS | Web Speech Synthesis API (Browser-nativ) |
| State | React Context + useReducer |
| Sync | Polling-basiert ueber `/api/sync/room` |
| Cache | localStorage fuer Embedding-Vektoren |

### Pakete

```
livekit-server-sdk          — JWT-Token-Generierung (Server)
livekit-client              — WebRTC-Client (Browser)
@livekit/components-react   — React-Komponenten (VideoConference, RoomAudioRenderer)
@livekit/components-styles  — Standard-CSS-Theme (ueberschrieben)
```

---

## 3. Projektstruktur

```
app/
  page.tsx                              — Landing/Setup-Seite
  call/[room]/page.tsx                  — Haupt-Session-Seite
  globals.css                           — Design-Tokens + LiveKit-Theme-Overrides
  api/
    livekit/token/route.ts              — LiveKit JWT-Token-Endpoint
    transcription/route.ts              — Whisper-Proxy
    embeddings/route.ts                 — Embedding-Proxy
    intervention/
      moderator/route.ts                — Moderator-LLM-Endpoint
      ally/route.ts                     — Ally-LLM-Endpoint
    sync/room/route.ts                  — Segment-Synchronisation
    model-routing/route.ts              — Modell-Routing-Konfiguration

components/
  LiveKitRoom.tsx                       — Video-UI + innere LiveKitSession-Komponente

lib/
  types.ts                              — Alle geteilten TypeScript-Typen
  context/SessionContext.tsx             — React Context + Reducer
  hooks/
    useLiveKitTranscription.ts          — Per-Teilnehmer MediaRecorder auf Remote-Audio
    useTranscriptionManager.ts          — Lokale Mikrofon-Transkription
    useMetricsComputation.ts            — Metriken-Orchestrierung (Intervall)
    useDecisionLoop.ts                  — Entscheidungs-Engine (Intervall)
    useRemoteSync.ts                    — Segment-Sync via Polling
  decision/
    interventionPolicy.ts               — Policy-Engine (4 Phasen)
    postCheck.ts                        — Erholungs-Evaluation
  state/
    inferConversationState.ts           — 5-Zustands-Inferenz mit Hysterese
  metrics/
    participation.ts                    — Partizipations-Metriken (v2)
    semanticDynamics.ts                 — Semantische Dynamik-Metriken (v2)
    computeMetrics.ts                   — Gefensterte Metrik-Berechnung
    embeddingCache.ts                   — Embedding-Cache (localStorage + Memory)
  llm/client.ts                         — LLM-Client mit Fallback-Kette
  api/routeHelpers.ts                   — API-Key-Pruefung, Routing-Config laden
  sync/roomPersistence.ts               — In-Memory + Datei-basierte Raum-Persistenz
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
2. PUT `/api/sync/room` — Konfiguration fuer Teilnehmer publizieren
3. GET `/api/model-routing` — Whisper-Aktivierung pruefen
4. `startSession(roomName, scenario, language, config)` aufrufen
5. Embedding-Cache aus localStorage laden

**Teilnehmer-Ablauf:**
1. GET `/api/sync/room?room=...&since=0` — Session-Konfiguration abrufen
2. `startSession(...)` mit empfangener Konfiguration aufrufen

### 4.3 Aktive Session

Folgende Hooks laufen parallel:

| Hook | Intervall | Laeuft bei |
|------|-----------|------------|
| `LiveKitSession` (Speaking-Tracking) | 500ms | Alle |
| `useLiveKitTranscription` (Remote-Audio) | 5000ms Chunks | Host |
| `useTranscriptionManager` (Lokales Mikro) | 5000ms Chunks | Alle |
| `useRemoteSync` (Polling) | 2000ms | Alle |
| `useMetricsComputation` | `ANALYZE_EVERY_MS` (5000ms) | Nur Host |
| `useDecisionLoop` | 2000ms | Nur Host |

### 4.4 Session-Ende

1. `endSession()` — setzt `isActive = false`
2. Alle Intervalle stoppen automatisch
3. `exportSessionLog()` — exportiert komplettes Protokoll als JSON

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
  canPublish: true,    // Audio + Video senden
  canSubscribe: true,  // Audio + Video empfangen
});
```

### 5.2 Video-UI (`components/LiveKitRoom.tsx`)

Zwei verschachtelte Komponenten:

**Aeussere Komponente (`LiveKitRoomComponent`):**
- Holt Token von `/api/livekit/token` beim Mount
- Rendert `<LKRoom>` mit LiveKit-SDK-Komponenten (`<VideoConference>`, `<RoomAudioRenderer>`)
- Enthaelt die innere `<LiveKitSession>` Komponente

**Innere Komponente (`LiveKitSession`):**
- Laeuft innerhalb des LiveKit-React-Kontexts (kann LiveKit-Hooks nutzen)
- `useConnectionState()` — Verbindungsstatus nach oben melden
- `useRemoteParticipants()` — Teilnehmerliste nach oben melden
- 500ms-Intervall: `participant.isSpeaking` abfragen, Sprechzeit akkumulieren
- `useLiveKitTranscription(...)` — Per-Teilnehmer-Audioaufnahme starten

**Props-Interface:**
```typescript
interface LiveKitRoomProps {
  roomName: string;
  displayName: string;
  onConnectionChange: (connected: boolean) => void;
  onParticipantsChange: (participants: { id: string; displayName: string }[]) => void;
  onRemoteSpeakersChange: (speakers: { id: string; displayName: string }[]) => void;
  speakingTimeRef: MutableRefObject<Map<string, number>>;
  transcriptionConfig: {
    language: string;
    isActive: boolean;
    onSegment: (segment: TranscriptSegment) => void;
    uploadSegment: (segment: TranscriptSegment) => void;
    addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  };
}
```

### 5.3 Warum LiveKit statt Jitsi?

- **Per-Teilnehmer Audio-Tracks**: Jeder Remote-Teilnehmer hat einen eigenen Audio-Track
- **Exakte Sprecher-Zuordnung**: `participant.identity` statt Raten ueber `dominantSpeakerChanged`
- **Kein Tab-Audio-Hack**: Frueheres System brauchte Tab-Audio-Capture fuer Remote-Transkription
- **Integriertes VAD**: `participant.isSpeaking` fuer Sprechzeit-Tracking
- **Cloud-Service**: Kein eigener TURN/SFU-Server noetig

---

## 6. Transkriptions-Pipeline

Das System hat zwei parallele Transkriptions-Pfade:

### 6.1 Remote-Teilnehmer (`lib/hooks/useLiveKitTranscription.ts`)

**Ablauf fuer jeden Remote-Teilnehmer:**

```
LiveKit Remote Participant
  → Track.Source.Microphone (Audio-Track)
    → new MediaStream([track.mediaStreamTrack])
      → MediaRecorder (5s Chunks, audio/webm;codecs=opus)
        → ondataavailable: Blob
          → [Nur wenn wasSpeakingDuringChunk = true]
            → processTranscriptionChunk()
              → POST /api/transcription (Whisper)
                → TranscriptSegment[]
                  → onSegment() (lokaler State)
                  → uploadSegment() (Sync-API)
```

**Internes Datenmodell pro Teilnehmer:**
```typescript
interface ParticipantRecorder {
  recorder: MediaRecorder;
  stream: MediaStream;       // Fuer Cleanup (tracks stoppen)
  identity: string;          // LiveKit Identity
  name: string;              // Anzeigename
  chunkStartTime: number;    // Exakter Timestamp fuer diesen Chunk
  wasSpeakingDuringChunk: boolean;  // Sprachaktivitaet im aktuellen Chunk
}
```

**Optimierungen:**
- Speaking-Only: 250ms-Intervall setzt `wasSpeakingDuringChunk = true` wenn `participant.isSpeaking`
- Chunks < 100 Bytes werden uebersprungen (Stille)
- Processing-Lock per Teilnehmer (`isProcessingRef: Set<string>`)
- Korrekte Timestamps via gespeichertem `chunkStartTime` (nicht rueckberechnet)

**MIME-Type-Prioritaet:**
1. `audio/webm;codecs=opus`
2. `audio/webm`
3. `audio/ogg;codecs=opus`
4. `audio/mp4`

### 6.2 Lokales Mikrofon (`lib/hooks/useTranscriptionManager.ts`)

**Zwei Methoden (alternativ):**

| Methode | Bedingung | Speaker-Label |
|---------|-----------|---------------|
| Web Speech API | Fallback, wenn Whisper deaktiviert | `'You'` |
| Whisper (AudioRecorder) | Wenn `isWhisperEnabled = true` | `'You'` |

**Whisper-Pfad:**
```
Lokales Mikrofon
  → useAudioRecorder (5s Chunks)
    → handleAudioChunk(blob)
      → processTranscriptionChunk({ speaker: 'You', idPrefix: 'whisper' })
        → POST /api/transcription
          → TranscriptSegment[]
```

**Speech API-Pfad:**
```
Lokales Mikrofon
  → useSpeechRecognition (continuous, interimResults)
    → onResult({ text, isFinal })
      → TranscriptSegment { speaker: 'You', isFinal }
        → Bei isFinal: uploadSegment()
```

### 6.3 Whisper API (`POST /api/transcription`)

**Request:** Multipart Form Data
```
file:                     Audio-Blob (max 25MB, als "audio.webm")
model:                    z.B. "whisper-1"
language:                 z.B. "de" (aus "de-CH" extrahiert)
response_format:          "verbose_json"
timestamp_granularities[]: "segment"
```

**Weiterleitung an:** `https://api.openai.com/v1/audio/transcriptions`

**Response:**
```json
{
  "text": "Gesamter transkribierter Text",
  "segments": [
    { "start": 0.0, "end": 2.5, "text": "Segment 1" },
    { "start": 2.5, "end": 5.0, "text": "Segment 2" }
  ],
  "language": "de",
  "duration": 5.0,
  "logEntry": { /* ModelRoutingLogEntry */ }
}
```

### 6.4 TranscriptSegment-Format

```typescript
interface TranscriptSegment {
  id: string;        // z.B. "lk-abc12345-1709812345000-0" oder "whisper-1709812345000-0"
  speaker: string;   // "You", "Max", "Anna" etc.
  text: string;
  timestamp: number; // Unix-Millisekunden
  isFinal: boolean;
  language?: string; // z.B. "de-CH"
}
```

**ID-Format:** `{idPrefix}-{timestamp}-{segmentIndex}`
- Remote: `lk-{identity.slice(0,8)}-{chunkStartTime}-{i}`
- Lokal: `whisper-{timestamp}-{i}` oder `speech-{timestamp}`

---

## 7. Metriken-System

### 7.1 Orchestrierung (`lib/hooks/useMetricsComputation.ts`)

Laeuft als Intervall alle `ANALYZE_EVERY_MS` (5000ms), nur beim Host.

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

### 7.4 v1-Metriken (Legacy, `lib/metrics/computeMetrics.ts`)

| Metrik | Beschreibung |
|--------|-------------|
| `participationImbalance` | Gini-Koeffizient der Sprechzeit-Verteilung |
| `semanticRepetitionRate` | Durchschnittliche Jaccard-Aehnlichkeit aufeinanderfolgender Segmente |
| `stagnationDuration` | Sekunden seit letztem neuen Beitrag |
| `diversityDevelopment` | Type-Token-Ratio (einzigartige Woerter / Gesamt) |

### 7.5 Embedding-Cache (`lib/metrics/embeddingCache.ts`)

- In-Memory `Map<string, number[]>` + LRU-Timestamps
- Persistiert in `localStorage` (Key: `uzh-brainstorming-embeddings`)
- Max 500 Eintraege (~6MB)
- Deduplizierung: Identische Texte teilen sich einen Embedding-Vektor
- Eviction: Aelteste 25% bei `QuotaExceededError`

### 7.6 MetricSnapshot-Format

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
  criteriaSnapshot: Record<string, number>;  // Alle 5 Konfidenzen + Eingabe-Metriken
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
2. Risiko erkannt, noch nicht bestaetigt → `phase = 'CONFIRMING'`, Timer starten
3. Risiko < `CONFIRMATION_SECONDS` (30s) bestaetigt → warten
4. Persistenz-Check: ≥70% der Snapshots im Bestaetigungs-Fenster muessen gleichen Zustand zeigen
5. Bestaetigt → `shouldIntervene = true`, Wechsel zu POST_CHECK

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

| Zustand | Intent | v1-Trigger |
|---------|--------|-----------|
| `DOMINANCE_RISK` | `PARTICIPATION_REBALANCING` | `imbalance` |
| `CONVERGENCE_RISK` | `PERSPECTIVE_BROADENING` | `repetition` |
| `STALLED_DISCUSSION` | `REACTIVATION` | `stagnation` |
| (Eskalation) | `ALLY_IMPULSE` | `escalation` |

### 9.3 Rate-Limiting

- Max `MAX_INTERVENTIONS_PER_10MIN` (3) Interventionen pro 10-Minuten-Fenster
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

Laeuft alle 2000ms beim Host:

```
1. Pruefe: isActive, !isParticipant, !baseline, metrics vorhanden
2. Rate-Limit zuruecksetzen (alle 10min)
3. evaluatePolicy(inferredState, metrics, history, engineState, config, scenario)
4. Bei stateUpdateOnly → updateDecisionState()
5. Bei recoveryResult → updateIntervention() am letzten Eingriff
6. Bei shouldIntervene:
   a. Kontext aufbauen (letzte 200 Segmente, letzte 3 Interventionen)
   b. POST /api/intervention/moderator ODER /api/intervention/ally
   c. Intervention erstellen, optional TTS abspielen
   d. DecisionState aktualisieren
```

---

## 10. API-Routen

### 10.1 `POST /api/livekit/token`

LiveKit JWT-Token fuer Raum-Beitritt.

```
Request:  { room: string, identity: string, name?: string }
Response: { token: string }
Fehler:   503 (keine Credentials), 400 (fehlende Felder), 500 (Token-Fehler)
```

### 10.2 `POST /api/transcription`

Whisper-Proxy fuer Audio-Transkription.

```
Request:  FormData { file: Blob, model, language, response_format, timestamp_granularities[] }
Response: { text, segments: [{start, end, text}], language, duration, logEntry }
Fehler:   503 (deaktiviert/kein Key), 400 (kein Audio/zu gross), 502 (Whisper-Fehler)
```

### 10.3 `POST /api/embeddings`

Embedding-Proxy fuer semantische Analyse.

```
Request:  { texts: string[] }  (max 50)
Response: { embeddings: number[][], count: number, logEntry }
Fehler:   503 (deaktiviert/kein Key), 400 (keine/zu viele Texte), 502 (alle Modelle fehlgeschlagen)
```

### 10.4 `POST /api/intervention/moderator`

LLM-generierte Moderator-Intervention.

```
Request:  {
  trigger: 'imbalance'|'repetition'|'stagnation',
  speakerDistribution: string,
  language: string,
  transcriptExcerpt?: string[],
  totalTurns?: number,
  scenario?: string,
  // v2
  intent?: string,
  triggeringState?: string,
  stateConfidence?: number,
  participationMetrics?: { participationRiskScore, silentParticipantRatio, dominanceStreakScore },
  semanticDynamics?: { noveltyRate, clusterConcentration, explorationElaborationRatio, semanticExpansionScore }
}

Response: {
  role: 'moderator',
  text: string,          // LLM-generierter oder Fallback-Text
  trigger: string,
  intent?: string,
  timestamp: number,
  logEntry: ModelRoutingLogEntry,
  fallback?: true        // Nur bei LLM-Fehler
}

Fehler: 400 (baseline/ungueltiger Trigger), 503 (kein API-Key), 500 (Server-Fehler)
```

### 10.5 `POST /api/intervention/ally`

LLM-generierter kreativer Ally-Impuls.

```
Request:  {
  language: string,
  scenario?: string,
  previousInterventions?: string[],
  transcriptExcerpt?: string[],
  totalTurns?: number,
  // v2
  intent?: string,
  triggeringState?: string,
  stateConfidence?: number,
  participationMetrics?: { participationRiskScore },
  semanticDynamics?: { noveltyRate, clusterConcentration }
}

Response: {
  role: 'ally',
  text: string,
  intent?: string,
  timestamp: number,
  logEntry: ModelRoutingLogEntry,
  fallback?: true
}

Fehler: 400 (nicht Szenario B), 503 (kein API-Key), 500 (Server-Fehler)
```

### 10.6 Sync-API (`/api/sync/room`)

```
GET  ?room=...&since=...  → { segments, count, sessionConfig, timestamp }
PUT  { roomId, sessionConfig }  → { success: true }
POST { roomId, segment }  → { success: true }
```

### 10.7 `GET/PUT /api/model-routing`

```
GET  → { config: ModelRoutingConfig, defaults: DEFAULT_MODEL_ROUTING }
PUT  { config: Partial<...> }  → { config: merged, ok: true }
```

---

## 11. LLM-Prompts

### 11.1 Moderator — System-Prompt

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

**English:**
```
You are a skilled brainstorming facilitator. Your role is to gently guide group discussions
by making brief process-oriented observations.

IMPORTANT RULES:
1. ONLY make process reflections - NEVER contribute actual ideas.
2. Keep responses to 1-2 short sentences maximum.
3. Be neutral, encouraging and constructive.
4. Phrase observations as questions or gentle process suggestions.
5. Focus on group dynamics, not content.
6. Responses must be suitable for text-to-speech.
7. NEVER address individuals directly by name.
```

### 11.2 Moderator — User-Prompts (v2, Intent-basiert)

**PARTICIPATION_REBALANCING (DE):**
```
Das Gespraech zeigt ein Ungleichgewicht in der Beteiligung.
Partizipations-Risiko-Score: {participationRiskScore}
Anteil stiller Teilnehmer: {silentParticipantRatio}
Verteilung der Sprecher: {speakerDistribution}
Dominanz-Streak-Score: {dominanceStreakScore}

Vollstaendiges Gespraechstranskript ({totalTurns} Beitraege insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, sanfte Prozessreflexion, um eine ausgewogenere Beteiligung zu foerdern.
Lade leisere Stimmen ein, ohne jemanden einzeln hervorzuheben.
```

**PERSPECTIVE_BROADENING (DE):**
```
Die Diskussion konvergiert um eine enge Auswahl von Ideen.
Cluster-Konzentration: {clusterConcentration}
Neuheitsrate: {noveltyRate}
Explorations-/Elaborations-Verhaeltnis: {explorationRatio}

Vollstaendiges Gespraechstranskript ({totalTurns} Beitraege insgesamt):
{transcriptExcerpt}

Formuliere eine kurze Prozessreflexion, die dazu ermutigt, verschiedene Blickwinkel
zu erkunden oder Ideen auf unerwartete Weise zu verbinden.
```

**REACTIVATION (DE):**
```
Das Gespraech ist semantisch statisch geworden mit wenig neuem Inhalt.
Stagnationsdauer: {stagnationDuration}s
Neuheitsrate: {noveltyRate}
Semantische Expansion: {expansionScore}

Vollstaendiges Gespraechstranskript ({totalTurns} Beitraege insgesamt):
{transcriptExcerpt}

Formuliere eine kurze, energetisierende Prozessreflexion, um den kreativen Fluss
wieder anzuregen. Verweise auf das, was die Gruppe bisher erkundet hat.
```

(Englische Varianten analog mit gleicher Struktur, aber englischem Text und Anweisungen.)

### 11.3 Moderator — User-Prompts (v1, Trigger-basiert)

Fallback fuer aeltere Clients oder wenn kein `intent` gesendet wird:

| Trigger | Kerninhalt |
|---------|-----------|
| `imbalance` | Sprecher-Verteilung + Aufforderung zu ausgewogenerer Beteiligung |
| `repetition` | Voller Transkript + Aufforderung, neue Richtungen zu erkunden |
| `stagnation` | Voller Transkript + energetisierende Prozessreflexion |

### 11.4 Ally — System-Prompt

**Deutsch:**
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

### 11.5 Ally — User-Prompts

**v2 (DE, mit Zustands-Kontext):**
```
Die Brainstorming-Sitzung steckt trotz frueherer Moderation fest.
Der Moderator versuchte Folgendes anzusprechen: {triggeringState}
Bisherige Interventionen: {previousInterventions}

Wichtige Kennzahlen:
- Partizipationsrisiko: {participationRiskScore}
- Neuheitsrate: {noveltyRate}
- Cluster-Konzentration: {clusterConcentration}

Vollstaendiges Gespraechstranskript ({totalTurns} Beitraege insgesamt):
{transcriptExcerpt}

Formuliere einen kurzen, unerwarteten kreativen Impuls. Mache ihn spezifisch fuer das,
was diese Gruppe besprochen hat. Vermeide die Wiederholung von Themen aus frueheren Interventionen.
```

**v1 (DE, ohne Metriken):**
```
Die Brainstorming-Sitzung steckt trotz frueherer Moderationsversuche fest.
Die Gruppe braucht einen kreativen Funken.

Bisherige Interventionen: {previousInterventions}

Vollstaendiges Gespraechstranskript ({totalTurns} Beitraege insgesamt):
{transcriptExcerpt}

Formuliere einen kurzen, unerwarteten kreativen Impuls, um die Diskussion zu beleben.
```

### 11.6 LLM-Client und Fallback-Kette (`lib/llm/client.ts`)

```
callLLM(task, routingConfig, messages, apiKey)
  → Primaeres Modell versuchen (z.B. gpt-4o)
    → Bei Fehler: Fallback 1 (z.B. gpt-4o-mini)
      → Bei Fehler: Fallback 2 (z.B. gpt-3.5-turbo)
        → Alle fehlgeschlagen: throw LLMError (HTTP 200 mit Fallback-Text)
```

Alle LLM-Aufrufe gehen ueber `POST https://api.openai.com/v1/chat/completions`.

### 11.7 Fallback-Texte (bei LLM-Fehler)

Statische, vorformulierte Antworten pro Intent/Trigger in DE und EN.
Beispiele:

| Intent | Deutsch | English |
|--------|---------|---------|
| PARTICIPATION_REBALANCING | "Es waere bereichernd, noch mehr Perspektiven zu hoeren..." | "It feels like we could benefit from hearing more perspectives..." |
| PERSPECTIVE_BROADENING | "Welche voellig andere Richtung koennten wir erkunden?" | "What completely different direction could we explore?" |
| REACTIVATION | "Welche Dimensionen sind noch offen?" | "What dimensions are still open?" |

Ally-Fallbacks: 4 zufaellige kreative Provokationen (z.B. "Was waere, wenn wir das Ganze komplett umdrehen wuerden?").

---

## 12. Datensynchronisation

### 12.1 Host → Teilnehmer

```
Host erstellt Segment (Transkription)
  → addTranscriptSegment() (lokaler State)
  → uploadSegment() → POST /api/sync/room { roomId, segment }

Teilnehmer pollt (alle 2s):
  → GET /api/sync/room?room=...&since=lastTimestamp
  → Neue Segmente → addTranscriptSegment() (dedupliziert via ID)
```

### 12.2 Teilnehmer → Host

Gleicher Mechanismus in umgekehrter Richtung. `speaker: 'You'` wird beim Upload ersetzt durch den tatsaechlichen Teilnehmernamen.

### 12.3 Session-Konfiguration

Host publiziert beim Session-Start:
```
PUT /api/sync/room { roomId, sessionConfig: { scenario, language, encodedConfig } }
```

Teilnehmer holt beim Beitritt:
```
GET /api/sync/room?room=...&since=0 → sessionConfig
```

### 12.4 Deduplizierung

Der React-Reducer in `SessionContext.tsx` dedupliziert Segmente anhand der `id`:
```typescript
case 'ADD_TRANSCRIPT_SEGMENT':
  if (state.transcriptSegments.some(s => s.id === action.payload.id)) {
    return state; // Duplikat ignorieren
  }
```

---

## 13. Session-Kontext

### 13.1 State-Struktur (`lib/context/SessionContext.tsx`)

```typescript
interface SessionState {
  isActive: boolean;
  roomName: string;
  scenario: Scenario;
  language: string;
  config: ExperimentConfig;
  transcriptSegments: TranscriptSegment[];    // Max 2000
  metricSnapshots: MetricSnapshot[];          // Max 200
  interventions: Intervention[];
  decisionState: DecisionEngineState;
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}
```

### 13.2 Decision Engine State

```typescript
interface DecisionEngineState {
  currentState: 'OBSERVATION' | 'STABILIZATION' | 'ESCALATION';  // v1 legacy
  lastInterventionTime: number | null;
  interventionCount: number;
  persistenceStartTime: number | null;
  postCheckStartTime: number | null;
  cooldownUntil: number | null;
  metricsAtIntervention: MetricSnapshot | null;
  triggerAtIntervention: InterventionTrigger | null;
  // v2
  phase: EnginePhase;               // MONITORING | CONFIRMING | POST_CHECK | COOLDOWN
  confirmingSince: number | null;
  confirmingState: ConversationStateName | null;
  postCheckIntent: InterventionIntent | null;
}
```

### 13.3 Actions

| Action | Beschreibung |
|--------|-------------|
| `START_SESSION` | Session initialisieren |
| `END_SESSION` | Session beenden |
| `ADD_TRANSCRIPT_SEGMENT` | Segment hinzufuegen (mit Dedup, max 2000) |
| `ADD_METRIC_SNAPSHOT` | Metrik-Snapshot speichern (max 200) |
| `ADD_INTERVENTION` | Intervention hinzufuegen + interventionCount erhoehen |
| `UPDATE_INTERVENTION` | Erholungsergebnis an bestehende Intervention anhaengen |
| `UPDATE_DECISION_STATE` | Engine-State partiell aktualisieren |
| `UPDATE_VOICE_SETTINGS` | TTS-Einstellungen aendern |
| `ADD_MODEL_ROUTING_LOG` | API-Aufruf protokollieren |
| `ADD_ERROR` | Fehler protokollieren |

---

## 14. Datenfluss-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                        app/call/[room]/page.tsx                     │
│                         (SessionProvider)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐   │
│  │  LiveKitRoom     │    │  useTranscriptionManager             │   │
│  │  ┌────────────┐  │    │  (Lokales Mikro → Whisper/Speech)    │   │
│  │  │ LiveKit    │  │    └──────────┬───────────────────────────┘   │
│  │  │ Session    │  │               │                               │
│  │  │            │  │               │ TranscriptSegment             │
│  │  │ isSpeaking │  │               ▼                               │
│  │  │ 500ms poll │  │    ┌──────────────────────────────────────┐   │
│  │  │    ↓       │  │    │  SessionContext (useReducer)          │   │
│  │  │ speaking   │  │    │  - transcriptSegments (max 2000)     │   │
│  │  │ TimeRef    │  │    │  - metricSnapshots (max 200)         │   │
│  │  │            │  │    │  - interventions                     │   │
│  │  │ useLiveKit │  │    │  - decisionState                    │   │
│  │  │ Transcrip. │──┼───→│  - Dedup via segment.id             │   │
│  │  │ (Remote    │  │    └──────────┬───────────────────────────┘   │
│  │  │  Audio)    │  │               │                               │
│  │  └────────────┘  │               │ segments + speakingTime       │
│  └──────────────────┘               ▼                               │
│                          ┌──────────────────────────────────────┐   │
│                          │  useMetricsComputation (5s)          │   │
│                          │  → computeMetricsAsync               │   │
│                          │    → POST /api/embeddings (cached)   │   │
│                          │    → ParticipationMetrics            │   │
│                          │    → SemanticDynamicsMetrics          │   │
│                          │  → inferConversationState             │   │
│                          │    → 5 Konfidenz-Scores              │   │
│                          │    → Hysterese + Tiebreak             │   │
│                          └──────────┬───────────────────────────┘   │
│                                     │ MetricSnapshot                │
│                                     │ + inferredState               │
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
│                          │    → speak() (TTS)                   │   │
│                          └──────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  useRemoteSync (2s Polling)                                  │   │
│  │  → GET /api/sync/room (neue Segmente holen)                 │   │
│  │  → POST /api/sync/room (eigene Segmente hochladen)          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────── API-Routen (Server) ────────────────────────────┐
│                                                                     │
│  /api/livekit/token     → livekit-server-sdk → JWT                 │
│  /api/transcription     → OpenAI Whisper API                       │
│  /api/embeddings        → OpenAI Embeddings API (mit Fallback)     │
│  /api/intervention/                                                 │
│    moderator            → OpenAI Chat API (Moderator-Prompt)       │
│    ally                 → OpenAI Chat API (Ally-Prompt)            │
│  /api/sync/room         → In-Memory Store (roomPersistence)        │
│  /api/model-routing     → Modell-Konfiguration (CRUD)              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 15. Konfiguration

### 15.1 ExperimentConfig (Standard-Werte)

| Parameter | Wert | Beschreibung |
|-----------|------|-------------|
| `WINDOW_SECONDS` | 180 | Analyse-Zeitfenster in Sekunden |
| `ANALYZE_EVERY_MS` | 5000 | Metriken-Berechnung alle X ms |
| `PERSISTENCE_SECONDS` | 120 | v1: Persistenz-Schwelle |
| `COOLDOWN_SECONDS` | 180 | Abkuehlzeit nach Intervention |
| `POST_CHECK_SECONDS` | 90 | Wartezeit fuer Erholungs-Pruefung |
| `CONFIRMATION_SECONDS` | 30 | Bestaetigungszeit fuer Risiko-Zustand |
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | Rate-Limit |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | Mindest-Score fuer "erholt" |
| `THRESHOLD_SILENT_PARTICIPANT` | 0.05 | Volumen-Schwelle fuer "still" |
| `THRESHOLD_PARTICIPATION_RISK` | 0.55 | v1: Risiko-Schwelle |
| `THRESHOLD_NOVELTY_RATE` | 0.30 | v1: Neuheits-Schwelle |
| `THRESHOLD_CLUSTER_CONCENTRATION` | 0.70 | v1: Konzentrations-Schwelle |

### 15.2 Engine-Konstanten (nicht konfigurierbar)

| Konstante | Wert | Ort |
|-----------|------|-----|
| Hysterese-Marge | 0.08 | `inferConversationState.ts` |
| Tiebreak-Marge | 0.03 | `inferConversationState.ts` |
| Min-Konfidenz | 0.45 | `interventionPolicy.ts` |
| Persistenz-Anteil | 70% | `interventionPolicy.ts` |
| Chunk-Intervall | 5000ms | `useLiveKitTranscription.ts` |
| Speaking-Poll | 250ms | `useLiveKitTranscription.ts` |
| Sync-Poll | 2000ms | `useRemoteSync.ts` |
| Decision-Poll | 2000ms | `useDecisionLoop.ts` |
| Embedding-Cache-Max | 500 | `embeddingCache.ts` |
| Segment-Max | 2000 | `SessionContext.tsx` |
| Snapshot-Max | 200 | `SessionContext.tsx` |

---

## 16. Umgebungsvariablen

### `.env.local`

```env
# OpenAI (LLM, Whisper, Embeddings)
OPENAI_API_KEY=sk-...

# LiveKit Cloud
LIVEKIT_URL=wss://....livekit.cloud           # Server-SDK (Token-Generierung)
LIVEKIT_API_KEY=API...                         # Server-SDK
LIVEKIT_API_SECRET=...                         # Server-SDK
NEXT_PUBLIC_LIVEKIT_URL=wss://....livekit.cloud  # Client-SDK (Browser-Verbindung)
```

`NEXT_PUBLIC_LIVEKIT_URL` ist die einzige Variable, die im Browser sichtbar ist.
Alle anderen werden nur serverseitig in API-Routen verwendet.
