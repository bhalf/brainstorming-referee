# UZH Brainstorming Webapp – Vollständige Architektur

> **Stand:** März 2026  
> **Version:** 0.1.0  
> **Zweck:** Forschungsprototyp für KI-gestützte Brainstorming-Moderation

---

## 📋 Inhaltsverzeichnis

1. [Überblick](#1-überblick)
2. [Technologie-Stack](#2-technologie-stack)
3. [Projektstruktur](#3-projektstruktur)
4. [Systemarchitektur](#4-systemarchitektur)
5. [Datenfluss](#5-datenfluss)
6. [Frontend-Architektur](#6-frontend-architektur)
7. [Backend-Architektur (API Routes)](#7-backend-architektur-api-routes)
8. [Kernmodule (lib/)](#8-kernmodule-lib)
9. [Decision Engine](#9-decision-engine)
10. [Metriken & Analyse](#10-metriken--analyse)
11. [Transkription](#11-transkription)
12. [Text-to-Speech (TTS)](#12-text-to-speech-tts)
13. [Model Routing](#13-model-routing)
14. [Experiment-Szenarien](#14-experiment-szenarien)
15. [Konfiguration](#15-konfiguration)
16. [Sequenzdiagramme](#16-sequenzdiagramme)

---

## 1. Überblick

Die **UZH Brainstorming Webapp** ist ein Forschungsprototyp der Universität Zürich zur Untersuchung von KI-gestützter Moderation in Brainstorming-Sitzungen. 

### Kernfunktionen:
- **Live-Videokonferenz** via Jitsi Meet
- **Echtzeit-Transkription** (Web Speech API + optional Whisper)
- **Metriken-Analyse** (Partizipation, Wiederholung, Stagnation)
- **Automatische KI-Interventionen** basierend auf Schwellenwerten
- **Text-to-Speech** für Interventionen
- **Experiment-Export** für wissenschaftliche Auswertung

### Experimentelle Szenarien:
| Szenario | Beschreibung |
|----------|-------------|
| **Baseline** | Keine KI-Interventionen (Kontrollgruppe) |
| **A** | Nur Moderator-Interventionen (Prozessreflexionen) |
| **B** | Moderator + Ally-Eskalation (kreative Impulse) |

---

## 2. Technologie-Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
├─────────────────────────────────────────────────────────┤
│  Next.js 16.1.6  │  React 19.2.3  │  TypeScript 5       │
│  Tailwind CSS 4  │  Jitsi Meet External API             │
├─────────────────────────────────────────────────────────┤
│                    BACKEND (API Routes)                  │
├─────────────────────────────────────────────────────────┤
│  Next.js API Routes (Server-Side)                        │
│  OpenAI SDK 6.21.0                                       │
├─────────────────────────────────────────────────────────┤
│                    EXTERNE SERVICES                      │
├─────────────────────────────────────────────────────────┤
│  Jitsi (jitsi.riot.im)  │  OpenAI API                   │
│  Web Speech API (Browser)                                │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Projektstruktur

```
uzh-brainstorming-webapp/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root Layout mit SessionProvider
│   ├── page.tsx                  # Setup-Seite (Raum-Erstellung)
│   ├── globals.css               # Globale Styles
│   ├── call/
│   │   └── [room]/
│   │       └── page.tsx          # Haupt-Call-Seite
│   └── api/                      # Server-Side API Routes
│       ├── embeddings/route.ts   # Embedding-Berechnung
│       ├── intervention/
│       │   ├── ally/route.ts     # Ally-Interventionen
│       │   └── moderator/route.ts # Moderator-Interventionen
│       ├── model-routing/route.ts # Model-Konfiguration CRUD
│       ├── test/route.ts         # API-Key Test
│       └── transcription/route.ts # Whisper Transkription
│
├── components/                   # React UI-Komponenten
│   ├── ChatFeed.tsx             # Interventions-Chat
│   ├── DebugPanel.tsx           # Metriken & State Debug
│   ├── ExportButton.tsx         # Session-Export
│   ├── JitsiEmbed.tsx           # Jitsi Meet Integration
│   ├── ModelRoutingPanel.tsx    # Model-Konfiguration UI
│   ├── OverlayPanel.tsx         # Haupt-Seitenpanel
│   ├── TranscriptFeed.tsx       # Live-Transkript
│   └── VoiceControls.tsx        # TTS Einstellungen
│
├── lib/                          # Kernlogik & Utilities
│   ├── config.ts                # Experiment-Konfiguration
│   ├── types.ts                 # TypeScript Typen
│   ├── config/
│   │   ├── modelRouting.ts      # Model-Routing Logik
│   │   └── modelRoutingPersistence.ts # File-Persistenz
│   ├── context/
│   │   └── SessionContext.tsx   # Globaler Session-State
│   ├── decision/
│   │   └── decisionEngine.ts    # Interventions-Logik
│   ├── llm/
│   │   └── client.ts            # Unified LLM Client
│   ├── metrics/
│   │   ├── computeMetrics.ts    # Metriken-Berechnung
│   │   └── embeddingCache.ts    # Embedding-Cache
│   ├── transcription/
│   │   ├── useAudioRecorder.ts  # Mikrofon-Recording
│   │   ├── useSpeechRecognition.ts # Web Speech API
│   │   └── useTabAudioCapture.ts # Tab-Audio Capture
│   └── tts/
│       └── useSpeechSynthesis.ts # Text-to-Speech
│
├── data/                         # Persistierte Konfiguration
│   └── model-routing.json       # Model-Routing Einstellungen
│
└── public/                       # Statische Assets
```

---

## 4. Systemarchitektur

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER (Client)                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │   Setup      │   │   Call       │   │   Overlay    │   │   Jitsi     │ │
│  │   Page       │──▶│   Page       │──▶│   Panel      │   │   Embed     │ │
│  └──────────────┘   └──────────────┘   └──────────────┘   └─────────────┘ │
│         │                  │                  │                  │         │
│         │                  ▼                  ▼                  ▼         │
│         │          ┌──────────────────────────────────────────────────┐   │
│         │          │              SessionContext (React Context)      │   │
│         │          │  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐  │   │
│         │          │  │Config  │ │Metrics │ │Trans-  │ │Interven-  │  │   │
│         │          │  │        │ │        │ │cripts  │ │tions      │  │   │
│         │          │  └────────┘ └────────┘ └────────┘ └───────────┘  │   │
│         │          └──────────────────────────────────────────────────┘   │
│         │                              │                                   │
│         │                              ▼                                   │
│  ┌──────┴──────┐              ┌──────────────────┐                        │
│  │ Config      │              │ Decision Engine   │                        │
│  │ Encoding    │              │ (Client-Side)     │                        │
│  └─────────────┘              └────────┬─────────┘                        │
│                                        │                                   │
│    ┌────────────────┬─────────────────┼─────────────────┬──────────────┐  │
│    ▼                ▼                 ▼                 ▼              │  │
│ ┌──────┐      ┌──────────┐     ┌──────────┐      ┌───────────┐         │  │
│ │Web   │      │Mikrofon  │     │Tab Audio │      │TTS        │         │  │
│ │Speech│      │Recorder  │     │Capture   │      │Synthesis  │         │  │
│ │API   │      │          │     │          │      │           │         │  │
│ └──────┘      └──────────┘     └──────────┘      └───────────┘         │  │
│                                                                         │  │
└────────────────────────────────────────────────────────────────────────┼──┘
                                                                         │
                            HTTP/HTTPS Requests                          │
                                                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS SERVER (API Routes)                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐  │
│  │ /api/intervention/ │  │ /api/transcription │  │ /api/embeddings     │  │
│  │   moderator        │  │                    │  │                     │  │
│  │   ally             │  │   Whisper ASR      │  │   OpenAI Embeddings │  │
│  └─────────┬──────────┘  └─────────┬──────────┘  └──────────┬──────────┘  │
│            │                       │                        │              │
│            └───────────────────────┼────────────────────────┘              │
│                                    │                                       │
│                                    ▼                                       │
│                         ┌─────────────────────┐                           │
│                         │   LLM Client        │                           │
│                         │   (Unified)         │                           │
│                         │   - Fallbacks       │                           │
│                         │   - Timeouts        │                           │
│                         │   - Logging         │                           │
│                         └─────────┬───────────┘                           │
│                                   │                                       │
│  ┌────────────────────┐           │          ┌────────────────────┐       │
│  │ /api/model-routing │           │          │ File Persistence   │       │
│  │   GET/PUT Config   │◀──────────┼─────────▶│ data/model-        │       │
│  └────────────────────┘           │          │ routing.json       │       │
│                                   │          └────────────────────┘       │
└───────────────────────────────────┼───────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │         OPENAI API            │
                    │  ┌─────────┐ ┌─────────────┐  │
                    │  │GPT-4o   │ │text-embed-  │  │
                    │  │GPT-4o-  │ │ding-3-small │  │
                    │  │mini     │ │             │  │
                    │  └─────────┘ └─────────────┘  │
                    │  ┌─────────────────────────┐  │
                    │  │    Whisper-1            │  │
                    │  └─────────────────────────┘  │
                    └───────────────────────────────┘
```

---

## 5. Datenfluss

### 5.1 Session-Lebenszyklus

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SETUP     │────▶│   ACTIVE    │────▶│   ENDING    │────▶│   EXPORT    │
│   (page.tsx)│     │ (call/page) │     │             │     │   (JSON)    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 Config erstellen    Metriken berechnen  Session beenden    Download Log
 Room generieren     Interventionen      State finalisieren
 URL navigieren      TTS ausgeben
```

### 5.2 Interventions-Zyklus

```
Transkript ──▶ Metriken ──▶ Schwellenwert ──▶ Persistenz ──▶ API Call ──▶ TTS
                 │              prüfen         Timer           │
                 │                │                            │
                 ▼                ▼                            ▼
          participationImbalance > 0.65?              /api/intervention/
          semanticRepetition > 0.75?                     moderator
          stagnationDuration > 180s?                     oder ally
```

---

## 6. Frontend-Architektur

### 6.1 Seiten

#### `app/page.tsx` – Setup-Seite
**Zweck:** Experiment-Konfiguration und Raum-Erstellung

**Funktionen:**
- Room-Name generieren/eingeben
- Szenario wählen (Baseline/A/B)
- Sprache wählen (en-US, de-DE, etc.)
- Erweiterte Konfiguration (Thresholds, Timings)
- Config validieren und in URL kodieren
- Navigation zu `/call/[room]`

**State:**
```typescript
- roomName: string
- scenario: 'baseline' | 'A' | 'B'
- language: string
- config: ExperimentConfig
- showAdvanced: boolean
- errors: string[]
```

#### `app/call/[room]/page.tsx` – Haupt-Call-Seite
**Zweck:** Brainstorming-Sitzung mit KI-Moderation

**Funktionen:**
- Jitsi-Videokonferenz einbetten
- Transkription starten/stoppen
- Metriken berechnen (Interval: ANALYZE_EVERY_MS)
- Decision Engine ausführen (alle 2s)
- Interventionen auslösen und sprechen
- Session-State verwalten

**Hooks verwendet:**
- `useSession()` – Globaler State
- `useSpeechRecognition()` – Web Speech API
- `useAudioRecorder()` – Whisper Recording
- `useTabAudioCapture()` – Remote Participant Audio
- `useSpeechSynthesis()` – TTS

### 6.2 Komponenten

| Komponente | Zweck | Props |
|------------|-------|-------|
| `JitsiEmbed` | Jitsi Meet Integration | roomName, displayName, Event-Callbacks |
| `OverlayPanel` | Rechtes Seitenpanel mit Tabs | Alle Session-Daten, Callbacks |
| `TranscriptFeed` | Live-Transkript anzeigen | segments, interimText |
| `ChatFeed` | Interventions-Historie | interventions |
| `DebugPanel` | Metriken & Decision State | metrics, config, decisionState |
| `VoiceControls` | TTS Einstellungen | settings, voices, callbacks |
| `ModelRoutingPanel` | Model-Konfiguration | logEntries |
| `ExportButton` | Session-Export | sessionLog, roomName |

### 6.3 Overlay Panel Tabs

```
┌────────┬────────────┬──────────┬─────────┬─────────┐
│  Chat  │ Transcript │ Settings │ Models  │  Debug  │
│  💬    │     📝     │    ⚙️    │   🤖    │   🔧    │
└────────┴────────────┴──────────┴─────────┴─────────┘
     │         │           │          │         │
     ▼         ▼           ▼          ▼         ▼
 ChatFeed  Transcript   Voice    ModelRouting  Debug
           Feed       Controls    Panel       Panel
```

---

## 7. Backend-Architektur (API Routes)

### 7.1 `/api/intervention/moderator`

**Methode:** POST

**Zweck:** Generiert prozessorientierte Moderator-Interventionen

**Request Body:**
```typescript
{
  trigger: 'imbalance' | 'repetition' | 'stagnation';
  speakerDistribution: string;  // "Alice: 60%, Bob: 40%"
  language: string;
  transcriptExcerpt?: string[];
  participationImbalance?: number;
  repetitionRate?: number;
  stagnationDuration?: number;
}
```

**Response:**
```typescript
{
  text: string;          // Interventions-Text
  role: 'moderator';
  trigger: string;
  logEntry?: ModelRoutingLogEntry;
}
```

**System Prompt (Auszug):**
- Nur Prozessreflexionen, keine inhaltlichen Ideen
- Maximal 1-2 Sätze
- Neutral, ermutigend, nicht belehrend
- Geeignet für Sprachausgabe

### 7.2 `/api/intervention/ally`

**Methode:** POST

**Zweck:** Generiert kreative Impulse bei Eskalation

**Request Body:**
```typescript
{
  language: string;
  previousInterventions?: string[];
  transcriptExcerpt?: string[];
}
```

**Response:**
```typescript
{
  text: string;          // Kreativer Impuls
  role: 'ally';
  logEntry?: ModelRoutingLogEntry;
}
```

**System Prompt (Auszug):**
- EIN kurzer, kreativer Impuls
- Maximal 1-2 Sätze
- Spielerisch, nicht belehrend
- Keine fertigen Lösungen

### 7.3 `/api/embeddings`

**Methode:** POST

**Zweck:** Berechnet Embeddings für semantische Analyse

**Request Body:**
```typescript
{
  texts: string[];  // Max 50 Texte
}
```

**Response:**
```typescript
{
  embeddings: number[][];  // Embedding-Vektoren
  count: number;
  logEntry?: ModelRoutingLogEntry;
}
```

### 7.4 `/api/transcription`

**Methode:** POST

**Zweck:** Whisper-Transkription von Audio-Chunks

**Request:** FormData mit `audio` (Blob) und `language`

**Response:**
```typescript
{
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  logEntry?: ModelRoutingLogEntry;
}
```

### 7.5 `/api/model-routing`

**Methode:** GET, PUT

**Zweck:** Model-Konfiguration lesen/schreiben

**GET Response:**
```typescript
{
  config: ModelRoutingConfig;
  defaults: ModelRoutingConfig;
}
```

**PUT Request:**
```typescript
{
  config: Partial<Record<ModelTaskKey, Partial<TaskModelConfig>>>;
}
```

### 7.6 `/api/test`

**Methode:** GET

**Zweck:** API-Key Validierung

**Response:**
```typescript
{
  ok: boolean;
  models?: Model[];  // Erste 5 Modelle
  error?: string;
}
```

---

## 8. Kernmodule (lib/)

### 8.1 `lib/types.ts` – Typdefinitionen

```typescript
// Transkript-Segment
interface TranscriptSegment {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
  language?: string;
}

// Metriken-Snapshot
interface MetricSnapshot {
  id: string;
  timestamp: number;
  speakingTimeDistribution: Record<string, number>;
  participationImbalance: number;      // 0-1
  semanticRepetitionRate: number;      // 0-1
  stagnationDuration: number;          // Sekunden
  diversityDevelopment: number;        // 0-1
  windowStart: number;
  windowEnd: number;
}

// Intervention
interface Intervention {
  id: string;
  timestamp: number;
  type: 'moderator' | 'ally';
  trigger: 'imbalance' | 'repetition' | 'stagnation' | 'escalation' | 'manual';
  text: string;
  spoken: boolean;
  metricsAtTrigger: MetricSnapshot | null;
}

// Decision Engine State
interface DecisionEngineState {
  currentState: 'OBSERVATION' | 'STABILIZATION' | 'ESCALATION';
  lastInterventionTime: number | null;
  interventionCount: number;
  persistenceStartTime: number | null;
  postCheckStartTime: number | null;
  cooldownUntil: number | null;
  metricsAtIntervention: MetricSnapshot | null;
}

// Experiment-Konfiguration
interface ExperimentConfig {
  WINDOW_SECONDS: number;              // 180
  ANALYZE_EVERY_MS: number;            // 5000
  PERSISTENCE_SECONDS: number;         // 120
  COOLDOWN_SECONDS: number;            // 180
  POST_CHECK_SECONDS: number;          // 90
  THRESHOLD_IMBALANCE: number;         // 0.65
  THRESHOLD_REPETITION: number;        // 0.75
  THRESHOLD_STAGNATION_SECONDS: number;// 180
  TTS_RATE_LIMIT_SECONDS: number;      // 30
  MAX_INTERVENTIONS_PER_10MIN: number; // 3
}
```

### 8.2 `lib/config.ts` – Konfiguration

**Funktionen:**
| Funktion | Beschreibung |
|----------|-------------|
| `validateConfig()` | Validiert ExperimentConfig gegen Constraints |
| `encodeConfig()` | Base64-Kodierung für URL |
| `decodeConfig()` | Dekodiert Config aus URL |
| `saveConfigToStorage()` | LocalStorage speichern |
| `loadConfigFromStorage()` | LocalStorage laden |
| `generateRoomName()` | Zufälligen Raumnamen generieren |

### 8.3 `lib/context/SessionContext.tsx` – Globaler State

**State-Struktur:**
```typescript
interface SessionState {
  roomName: string;
  scenario: Scenario;
  language: string;
  isActive: boolean;
  startTime: number | null;
  config: ExperimentConfig;
  transcriptSegments: TranscriptSegment[];
  metricSnapshots: MetricSnapshot[];
  interventions: Intervention[];
  decisionState: DecisionEngineState;
  voiceSettings: VoiceSettings;
  modelRoutingLog: ModelRoutingLogEntry[];
  errors: Array<{ timestamp: number; message: string; context?: string }>;
}
```

**Actions:**
- `START_SESSION` – Session starten
- `END_SESSION` – Session beenden
- `ADD_TRANSCRIPT_SEGMENT` – Transkript hinzufügen
- `ADD_METRIC_SNAPSHOT` – Metriken hinzufügen
- `ADD_INTERVENTION` – Intervention speichern
- `UPDATE_DECISION_STATE` – Decision Engine State updaten
- `UPDATE_VOICE_SETTINGS` – TTS Einstellungen ändern
- `ADD_MODEL_ROUTING_LOG` – API-Call loggen
- `ADD_ERROR` – Fehler loggen

**Convenience Methoden:**
- `exportSessionLog()` – Komplettes Log für Export

---

## 9. Decision Engine

### 9.1 Zustandsdiagramm

```
                          ┌───────────────────────────────────┐
                          │                                   │
                          ▼                                   │
                   ┌─────────────┐                            │
          ┌───────│ OBSERVATION │◀──────────────────────┐    │
          │       └──────┬──────┘                       │    │
          │              │                              │    │
          │   Threshold breached                        │    │
          │   for PERSISTENCE_SECONDS                   │    │
          │              │                              │    │
          │              ▼                              │    │
          │  ┌───────────────────────┐                  │    │
          │  │ Moderator Intervention │                 │    │
          │  └───────────┬───────────┘                  │    │
          │              │                              │    │
          │              ▼                              │    │
          │       ┌─────────────────┐                   │    │
          │       │  STABILIZATION  │                   │    │
          │       └───────┬─────────┘                   │    │
          │               │                             │    │
          │    POST_CHECK_SECONDS                       │    │
          │               │                             │    │
          │     ┌─────────┴─────────┐                   │    │
          │     │                   │                   │    │
          │     ▼                   ▼                   │    │
          │ Improved?           Not Improved            │    │
          │     │                   │                   │    │
          │     │            ┌──────┴──────┐            │    │
          │     │            │             │            │    │
          │     │       Scenario A    Scenario B        │    │
          │     │            │             │            │    │
          │     │            │             ▼            │    │
          │     │            │   ┌───────────────┐      │    │
          │     │            │   │ Ally Interven-│      │    │
          │     │            │   │ tion (Impulse)│      │    │
          │     │            │   └───────┬───────┘      │    │
          │     │            │           │              │    │
          │     │            │           ▼              │    │
          │     │            │    ┌─────────────┐       │    │
          │     │            │    │ ESCALATION  │       │    │
          │     │            │    └──────┬──────┘       │    │
          │     │            │           │              │    │
          │     │            │    COOLDOWN_SECONDS      │    │
          │     │            │           │              │    │
          │     └────────────┴───────────┴──────────────┘    │
          │                                                  │
          │              COOLDOWN_SECONDS                    │
          └──────────────────────────────────────────────────┘
```

### 9.2 `lib/decision/decisionEngine.ts`

**Hauptfunktionen:**

```typescript
// Evaluiert ob/welche Intervention nötig ist
evaluateDecision(
  metrics: MetricSnapshot,
  metricsHistory: MetricSnapshot[],
  currentState: DecisionEngineState,
  config: ExperimentConfig,
  scenario: Scenario,
  currentTime: number
): DecisionResult

// Prüft ob Verbesserung eingetreten ist
checkImprovement(
  current: MetricSnapshot, 
  old: MetricSnapshot | null
): boolean

// Setzt Interventions-Counter zurück (alle 10 Min)
resetInterventionCountIfNeeded(
  currentState: DecisionEngineState,
  lastResetTime: number,
  currentTime: number
): { state: DecisionEngineState; newResetTime: number }
```

**DecisionResult:**
```typescript
{
  shouldIntervene: boolean;
  interventionType: 'moderator' | 'ally' | null;
  trigger: InterventionTrigger | null;
  reason: string;
  nextState: DecisionEngineState;
  stateUpdateOnly: Partial<DecisionEngineState> | null;
}
```

---

## 10. Metriken & Analyse

### 10.1 `lib/metrics/computeMetrics.ts`

#### Metriken-Berechnung

| Metrik | Funktion | Beschreibung |
|--------|----------|--------------|
| **Sprechzeit-Verteilung** | `computeSpeakingTimeDistribution()` | Textlänge pro Sprecher als Proxy |
| **Partizipations-Imbalance** | `computeParticipationImbalance()` | Gini-Koeffizient-ähnlich (0-1) |
| **Semantische Wiederholung** | `computeSemanticRepetitionRate()` | Jaccard-Ähnlichkeit zwischen Segmenten |
| **Stagnation** | `computeStagnationDuration()` | Zeit seit letztem Segment |
| **Diversity** | `computeDiversityDevelopment()` | Type-Token-Ratio |

#### Schwellenwert-Prüfung

```typescript
checkThresholds(metrics: MetricSnapshot, config: ExperimentConfig): {
  imbalance: boolean;   // >= THRESHOLD_IMBALANCE
  repetition: boolean;  // >= THRESHOLD_REPETITION
  stagnation: boolean;  // >= THRESHOLD_STAGNATION_SECONDS
  any: boolean;
}
```

#### Async Metriken (mit Embeddings)

```typescript
computeMetricsAsync(
  segments: TranscriptSegment[],
  config: ExperimentConfig,
  currentTime: number,
  audioSpeakingTimes?: Map<string, number>
): Promise<MetricSnapshot>
```

**Fallback-Logik:**
1. Versuche Embeddings von `/api/embeddings`
2. Falls genug Embeddings: Cosine-Similarity für Repetition/Diversity
3. Falls fehlgeschlagen: Fallback zu Jaccard-Similarity

### 10.2 `lib/metrics/embeddingCache.ts`

**Zweck:** Client-seitiger Cache für Embeddings mit LRU-Eviction

**Funktionen:**
```typescript
loadPersistedCache(sessionId?: string): number
persistCache(sessionId?: string): void
getOrFetchEmbeddings(segments: SegmentForEmbedding[]): Promise<Map<string, number[]>>
cosineSimilarity(a: number[], b: number[]): number
computeEmbeddingRepetition(embeddings: Map, segmentIds: string[]): number
computeEmbeddingDiversity(embeddings: Map, segmentIds: string[]): number
```

**Cache-Eigenschaften:**
- Max 500 Einträge
- LocalStorage-Persistenz
- LRU-Eviction bei Quota-Überschreitung

---

## 11. Transkription

### 11.1 `lib/transcription/useSpeechRecognition.ts`

**Zweck:** Web Speech API Integration

**Features:**
- Continuous Recognition
- Interim Results
- Auto-Restart bei Browser-Stopp
- Fehlerbehandlung

**Rückgabe:**
```typescript
{
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  results: TranscriptResult[];
  toggle: () => void;
  error: string | null;
}
```

### 11.2 `lib/transcription/useAudioRecorder.ts`

**Zweck:** MediaRecorder für Whisper-Chunks

**Features:**
- Periodische Chunks (Standard: 5s)
- Automatische MIME-Type-Erkennung
- 16kHz Sampling für Whisper

### 11.3 `lib/transcription/useTabAudioCapture.ts`

**Zweck:** Tab-Audio für Remote-Teilnehmer

**Features:**
- `getDisplayMedia` mit Audio
- TTS-Unterdrückung (eigene Sprachausgabe nicht transkribieren)
- Speaker-Diarization via Jitsi Dominant Speaker

---

## 12. Text-to-Speech (TTS)

### 12.1 `lib/tts/useSpeechSynthesis.ts`

**Features:**
- Rate-Limiting (Standard: 30s)
- Automatische Sprachauswahl
- Chrome-Keepalive (gegen 15s-Bug)
- Queue-System

**Sprachauswahl-Logik:**
1. Exakte Sprache, Remote-Stimme (hochwertig)
2. Exakte Sprache, Lokal
3. Sprach-Präfix, Remote
4. Sprach-Präfix, Lokal
5. Englisch Fallback

**Rückgabe:**
```typescript
{
  isSupported: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  speak: (text: string) => boolean;
  cancel: () => void;
  canSpeak: boolean;
  lastSpeakTime: number | null;
}
```

---

## 13. Model Routing

### 13.1 `lib/config/modelRouting.ts`

**Tasks:**
```typescript
type ModelTaskKey =
  | 'moderator_intervention'  // GPT-4o-mini, temp 0.4
  | 'ally_intervention'       // GPT-4o-mini, temp 0.9
  | 'embeddings_similarity'   // text-embedding-3-small
  | 'transcription_server';   // whisper-1 (optional)
```

**TaskModelConfig:**
```typescript
{
  provider: 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  fallbacks: FallbackModel[];
  enabled: boolean;
}
```

### 13.2 `lib/llm/client.ts`

**Unified LLM Client mit:**
- Fallback-Chains
- Timeout-Handling
- Strukturiertes Logging
- Retry-Logik

```typescript
callLLM(
  task: ModelTaskKey,
  config: ModelRoutingConfig,
  messages: LLMMessage[],
  apiKey: string
): Promise<{ text: string; logEntry: ModelRoutingLogEntry }>
```

---

## 14. Experiment-Szenarien

### 14.1 Baseline
- **Interventionen:** Keine
- **Verwendung:** Kontrollgruppe
- **Decision Engine:** Übersprungen

### 14.2 Scenario A
- **Interventionen:** Nur Moderator
- **Trigger:** Imbalance, Repetition, Stagnation
- **Eskalation:** Keine (zurück zu Observation)

### 14.3 Scenario B
- **Interventionen:** Moderator + Ally
- **Trigger:** Wie A
- **Eskalation:** Ally-Impuls wenn Moderator nicht hilft

---

## 15. Konfiguration

### 15.1 Default-Werte

```typescript
const DEFAULT_CONFIG = {
  // Analyse-Fenster
  WINDOW_SECONDS: 180,         // 3 Minuten
  ANALYZE_EVERY_MS: 5000,      // Alle 5 Sekunden
  
  // Trigger-Timing
  PERSISTENCE_SECONDS: 120,    // 2 Minuten anhaltend
  COOLDOWN_SECONDS: 180,       // 3 Minuten Pause
  POST_CHECK_SECONDS: 90,      // 1.5 Minuten Prüfung
  
  // Schwellenwerte
  THRESHOLD_IMBALANCE: 0.65,   // 65% Ungleichgewicht
  THRESHOLD_REPETITION: 0.75,  // 75% Wiederholung
  THRESHOLD_STAGNATION_SECONDS: 180,  // 3 Minuten Stille
  
  // Sicherheitslimits
  TTS_RATE_LIMIT_SECONDS: 30,  // Min. 30s zwischen TTS
  MAX_INTERVENTIONS_PER_10MIN: 3  // Max 3 pro 10 Min
}
```

### 15.2 Constraint-Validierung

```typescript
const CONFIG_CONSTRAINTS = {
  WINDOW_SECONDS: { min: 30, max: 600 },
  ANALYZE_EVERY_MS: { min: 1000, max: 30000 },
  PERSISTENCE_SECONDS: { min: 5, max: 300 },
  COOLDOWN_SECONDS: { min: 10, max: 600 },
  POST_CHECK_SECONDS: { min: 5, max: 300 },
  THRESHOLD_IMBALANCE: { min: 0.1, max: 1.0 },
  THRESHOLD_REPETITION: { min: 0.1, max: 1.0 },
  THRESHOLD_STAGNATION_SECONDS: { min: 15, max: 600 },
  TTS_RATE_LIMIT_SECONDS: { min: 10, max: 120 },
  MAX_INTERVENTIONS_PER_10MIN: { min: 1, max: 20 }
}
```

---

## 16. Sequenzdiagramme

### 16.1 Session-Start

```
User          Setup-Page       Router         Call-Page        SessionContext
  │               │               │               │                   │
  │  Config       │               │               │                   │
  │  eingeben     │               │               │                   │
  │──────────────▶│               │               │                   │
  │               │               │               │                   │
  │  Start        │  encodeConfig │               │                   │
  │  klicken      │──────────────▶│               │                   │
  │──────────────▶│               │               │                   │
  │               │               │  navigate     │                   │
  │               │               │  /call/[room] │                   │
  │               │               │──────────────▶│                   │
  │               │               │               │  startSession     │
  │               │               │               │──────────────────▶│
  │               │               │               │                   │
  │               │               │               │  loadPersistedCache
  │               │               │               │──────────────────▶│
  │               │               │               │                   │
  │               │               │               │◀──────────────────│
```

### 16.2 Intervention-Flow

```
Call-Page       Decision       API             LLM Client      OpenAI        TTS
    │           Engine          │                  │              │            │
    │  metrics   │              │                  │              │            │
    │───────────▶│              │                  │              │            │
    │            │              │                  │              │            │
    │  evaluate  │              │                  │              │            │
    │───────────▶│              │                  │              │            │
    │            │              │                  │              │            │
    │  shouldIntervene=true     │                  │              │            │
    │◀───────────│              │                  │              │            │
    │            │              │                  │              │            │
    │  POST /api/intervention/moderator            │              │            │
    │───────────────────────────▶│                 │              │            │
    │            │              │  callLLM        │              │            │
    │            │              │─────────────────▶│              │            │
    │            │              │                  │  chat/comp.  │            │
    │            │              │                  │─────────────▶│            │
    │            │              │                  │◀─────────────│            │
    │            │              │◀─────────────────│              │            │
    │◀───────────│──────────────│                  │              │            │
    │            │              │                  │              │            │
    │  speak(text)              │                  │              │            │
    │──────────────────────────────────────────────────────────────────────────▶│
    │            │              │                  │              │            │
```

---

## Anhang: Dateiübersicht

| Datei | Zeilen | Beschreibung |
|-------|--------|--------------|
| `app/page.tsx` | 373 | Setup-Seite |
| `app/call/[room]/page.tsx` | 691 | Haupt-Call-Seite |
| `lib/types.ts` | 170 | Typdefinitionen |
| `lib/config.ts` | 182 | Konfiguration |
| `lib/context/SessionContext.tsx` | 298 | Session State |
| `lib/decision/decisionEngine.ts` | 413 | Decision Engine |
| `lib/metrics/computeMetrics.ts` | 377 | Metriken |
| `lib/metrics/embeddingCache.ts` | 311 | Embedding Cache |
| `lib/llm/client.ts` | 322 | LLM Client |
| `lib/config/modelRouting.ts` | 236 | Model Routing |
| `components/OverlayPanel.tsx` | 286 | Overlay UI |
| `components/JitsiEmbed.tsx` | 280 | Jitsi Integration |
| `app/api/intervention/moderator/route.ts` | 179 | Moderator API |
| `app/api/intervention/ally/route.ts` | 151 | Ally API |
| `app/api/embeddings/route.ts` | 111 | Embeddings API |
| `app/api/transcription/route.ts` | 137 | Whisper API |

---

*Dokumentation generiert März 2026*

