# Aktueller Stand — Frontend

> Zuletzt aktualisiert: 2026-03-16 (BigPicture-konform)

---

## Architektur-Übersicht

```
Browser (Next.js 16 / React 19)
│
├── Supabase Realtime (read-only) ──── 9 Subscriptions auf Postgres Changes
├── FastAPI Backend (HTTP) ─────────── NEXT_PUBLIC_API_URL
└── LiveKit Cloud (WebRTC) ─────────── NEXT_PUBLIC_LIVEKIT_URL
```

**Kernprinzip:** Das Frontend ist eine **reine UI-Schicht**. Es berechnet nichts, ruft keine LLMs auf, macht kein Audio-Processing. Alle Daten kommen via Supabase Realtime oder HTTP-Calls an das FastAPI-Backend.

---

## Seiten (App Router)

| Route | Datei | Beschreibung |
|-------|-------|--------------|
| `/` | `app/page.tsx` | Landing: Join-Code eingeben oder Session erstellen |
| `/dashboard` | `app/dashboard/page.tsx` | Session-Liste, gruppiert nach Status (active/idle/scheduled/ended) |
| `/join/[code]` | `app/join/[code]/page.tsx` | Beitrittsformular: Name eingeben → Session beitreten |
| `/session/[id]` | `app/session/[id]/page.tsx` | Haupt-Session: Video + Tabs (Transkript, Metriken, Ideen, Ziele, Zusammenfassung) |
| `/workspace` | `app/workspace/page.tsx` | Workspace erstellen (Name, Slug) |
| `/workspace/[id]` | `app/workspace/[id]/page.tsx` | Workspace-Dashboard (Stub) |
| `/join-workspace` | `app/join-workspace/page.tsx` | Workspace-Einladung annehmen via Token |

---

## API-Client (`lib/api-client.ts`)

Alle HTTP-Calls gehen an `NEXT_PUBLIC_API_URL` (FastAPI Backend, Default: `http://localhost:8000`).

### Sessions

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `createSession(data)` | POST | `/api/sessions` | Session erstellen. Sendet `moderation_level`, `features[]`, `goals[]` direkt |
| `getSessions()` | GET | `/api/sessions` | Alle Sessions abrufen |
| `getSession(id)` | GET | `/api/sessions/{id}` | Einzelne Session abrufen |
| `endSession(id)` | POST | `/api/sessions/{id}/end` | Session beenden |

### Teilnehmer-Management

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `joinSession(code, displayName)` | POST | `/api/sessions/join` | Session beitreten → `{ session, participant, livekit_token }` |
| `getParticipants(sessionId)` | GET | `/api/participants/session/{id}` | Alle Teilnehmer einer Session |
| `promoteToCoHost(sessionId, targetIdentity)` | POST | `/api/sessions/{id}/promote` | Teilnehmer zum Co-Host befördern |
| `transferHost(sessionId, targetIdentity)` | POST | `/api/sessions/{id}/transfer-host` | Host-Rolle übertragen |

### LiveKit

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `getLivekitToken(sessionId, identity, displayName?)` | POST | `/api/livekit/token` | LiveKit JWT holen → `{ token, room, url }` |

### Ideen (interaktiv)

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `createIdea(sessionId, data)` | POST | `/api/sessions/{id}/ideas` | Idee erstellen |
| `updateIdea(sessionId, ideaId, data)` | PATCH | `/api/sessions/{id}/ideas/{ideaId}` | Idee bearbeiten (title, description) |
| `deleteIdea(sessionId, ideaId)` | DELETE | `/api/sessions/{id}/ideas/{ideaId}` | Idee löschen (Soft-Delete) |

### Export

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `exportSession(id)` | GET | `/api/sessions/{id}/export` | Session-Daten exportieren |

### Workspaces

| Funktion | Methode | Endpoint | Beschreibung |
|----------|---------|----------|--------------|
| `createWorkspace(data)` | POST | `/api/workspaces` | Workspace erstellen (name, slug?) |
| `getWorkspace(id)` | GET | `/api/workspaces/{id}` | Workspace + Members abrufen |
| `getWorkspaceSessions(id, params?)` | GET | `/api/workspaces/{id}/sessions` | Sessions eines Workspace (Filter: status, limit, offset) |
| `inviteMember(workspaceId, data)` | POST | `/api/workspaces/{id}/invite` | Mitglied einladen → `{ invite_url }` |
| `acceptInvite(token)` | POST | `/api/workspaces/accept-invite` | Einladung annehmen |
| `updateMemberRole(workspaceId, userId, role)` | PATCH | `/api/workspaces/{id}/members/{userId}` | Mitgliedsrolle ändern |
| `removeMember(workspaceId, userId)` | DELETE | `/api/workspaces/{id}/members/{userId}` | Mitglied entfernen |
| `transferOwnership(workspaceId, targetUserId)` | POST | `/api/workspaces/{id}/transfer-ownership` | Workspace-Eigentümer wechseln |

### Request-Format: `createSession`

```json
{
  "title": "Brainstorming XY",
  "language": "de-CH",
  "moderation_level": "moderation",
  "features": ["metrics", "ideas", "summary"],
  "goals": [{ "label": "Ziel 1", "description": "..." }],
  "config": {}
}
```

### Request-Format: `joinSession`

```json
{ "code": "ABC123", "display_name": "Anna" }
```

### Response-Format: `joinSession`

```json
{
  "session": { "id": "uuid", "title": "...", "livekit_room": "room-name", ... },
  "participant": { "id": "uuid", "livekit_identity": "participant-xyz", "display_name": "Anna", "role": "participant", ... },
  "livekit_token": "eyJ..."
}
```

### Request-Format: `getLivekitToken`

```json
{ "session_id": "uuid", "identity": "host", "display_name": "Host" }
```

### Response-Format: `getLivekitToken`

```json
{ "token": "eyJ...", "room": "room-name", "url": "wss://..." }
```

### Fehlerbehandlung

- Eigene `ApiError`-Klasse mit `.status` und `.message`
- 204 No Content → `undefined`
- Alle Fehler werfen `ApiError` mit HTTP-Statuscode und Body

---

## Token-Flow

### Host-Flow
1. Host erstellt Session auf Landing Page → `createSession()`
2. Erhält Session mit Join-Code → Success-UI
3. Host gibt Namen ein → `joinSession(code, name)` als Host
4. Navigiert zu `/session/{id}?identity={livekit_identity}&name={name}`
5. Session-Page liest Params → `getLivekitToken(sessionId, identity, name)`

### Teilnehmer-Flow
1. Teilnehmer geht zu `/join/{code}`
2. Gibt Namen ein → `joinSession(code, name)`
3. Join-Page navigiert zu `/session/{id}?identity={livekit_identity}&name={name}`
4. Session-Page liest Params aus URL → `getLivekitToken(sessionId, identity, name)`

**Kein sessionStorage, kein globaler State** — Token wird direkt beim Mount geholt.
**Schutz:** Ohne `identity` URL-Param leitet die Session-Page automatisch zu `/join/{code}` um.

---

## Supabase Realtime Subscriptions

Alle Hooks in `lib/realtime/`, basierend auf `useSupabaseChannel` (exponential backoff, max 5 Reconnects).

| Hook | Tabelle(n) | Event | Filter | Rückgabe |
|------|------------|-------|--------|----------|
| `useRealtimeSegments` | `transcript_segments` | INSERT | `session_id=eq.{id}` | `segments[]` (max 15K, dedup) |
| `useRealtimeMetrics` | `metric_snapshots` | INSERT | `session_id=eq.{id}` | `latest` (gemergt), `history[]` (max 720) |
| `useRealtimeInterventions` | `interventions` | INSERT | `session_id=eq.{id}` | `interventions[]`, `latestIntervention`, `dismissLatest()` |
| `useRealtimeIdeas` | `ideas` + `idea_connections` | * | `session_id=eq.{id}` | `ideas[]`, `connections[]` |
| `useRealtimeSummary` | `session_summary` | * | `session_id=eq.{id}` | `summary`, `updatedAt` |
| `useRealtimeEngineState` | `engine_state` | * | `session_id=eq.{id}` | `engineState` (dedup via phase\|state\|count) |
| `useRealtimeGoals` | `session_goals` | * | `session_id=eq.{id}` | `goals[]` |
| `useRealtimeParticipants` | `session_participants` | * | `session_id=eq.{id}` | `participants[]`, `hostIdentity`, `myRole`, `isHost`, `isCoHost` |
| `useRealtimeSession` | `sessions` | * | `id=eq.{id}` | `session`, `isIdle`, `isEnded` |

### Besonderheiten
- `useRealtimeMetrics`: Backend sendet partielle Snapshots (ein Metrik-Feld pro Row). Hook mergt: `latest` hat immer den neuesten Non-Null-Wert für jedes Feld.
- `useRealtimeEngineState`: Dedup über `phase|current_state|intervention_count` — verhindert Re-Renders bei No-Op Backend-Writes (~5s Intervall).
- `useRealtimeParticipants`: Initial-Load via `getParticipants()` API, dann Realtime-Updates. Filtert auf `is_active` only.
- `useRealtimeSession`: Initial-Load via `getSession()` API, dann Realtime-Updates.

### Composition Hook: `useSessionData(sessionId, myIdentity?)`

Bündelt alle 9 Realtime-Hooks und gibt ein einzelnes Datenobjekt zurück:

```typescript
{
  // Transkript
  segments,
  // Metriken
  latestMetrics, metricsHistory,
  // Interventionen
  interventions, latestIntervention, dismissIntervention,
  // Ideen
  ideas, connections,
  // Zusammenfassung
  summary, summaryUpdatedAt,
  // Engine
  engineState,
  // Ziele
  goals,
  // Teilnehmer
  participants, allParticipants, hostIdentity, myRole, isHost, isCoHost,
  // Session-Status
  realtimeSession, isIdle, isEnded,
  // Verbindungsstatus
  isConnected  // true wenn mindestens ein Hook subscribed
}
```

**Kein Context, kein Reducer** — jeder Hook verwaltet seinen eigenen `useState`.

---

## Typen (`types/index.ts`)

### Session

```typescript
interface Session {
  id: string;
  workspace_id?: string;
  created_by?: string;
  title: string;
  status: 'scheduled' | 'active' | 'idle' | 'ended';
  join_code: string;
  livekit_room: string;
  moderation_level: ModerationLevel;       // 'none' | 'moderation' | 'moderation_ally'
  enabled_features: FeatureKey[];          // ['metrics', 'ideas', 'summary', ...]
  language: string;
  config: Record<string, unknown>;
  agent_id?: string;
  idle_since_at: string | null;
  started_at?: string;
  ended_at?: string;
  created_at: string;
}
```

### SessionParticipant

```typescript
type ParticipantRole = 'host' | 'co_host' | 'participant';

interface SessionParticipant {
  id: string;
  session_id: string;
  display_name: string;
  livekit_identity: string;
  role: ParticipantRole;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
}
```

### TranscriptSegment

```typescript
interface TranscriptSegment {
  id: string;
  session_id: string;
  speaker_identity: string;
  speaker_name: string;
  text: string;
  is_final: boolean;
  language?: string;
  created_at: string;
}
```

### MetricSnapshot (bigpicture.md §7-9)

```typescript
interface MetricSnapshot {
  id: string;
  session_id: string;
  computed_at: string;
  participation: ParticipationMetrics;
  semantic_dynamics: SemanticDynamicsMetrics;
  inferred_state: InferredState;
  window_start?: string;
  window_end?: string;
  created_at?: string;
}

interface ParticipationMetrics {              // §7.7
  volume_share: Record<string, number>;        // pro Speaker-Identity
  turn_share: Record<string, number>;          // pro Speaker-Identity
  gini_imbalance: number;                      // 0–1
  turn_share_gini: number;                     // 0–1
  hoover_imbalance: number;                    // 0–1
  turn_hoover: number;                         // 0–1
  balance: number;                             // 0–1
  silent_participant_ratio: number;            // 0–1
  dominance_streak_score: number;              // 0–1
  participation_risk_score: number;            // 0–1
  long_term_balance: number;                   // 0–1
  cumulative_imbalance: number;                // 0–1
  ideational_fluency_rate: number;             // 0–1
}

interface SemanticDynamicsMetrics {           // §8.8
  novelty_rate: number;                        // 0–1
  cluster_concentration: number;               // 0–1
  exploration_elaboration_ratio: number;       // 0–∞
  semantic_expansion_score: number;            // 0–1
  cluster_count: number;
  has_embeddings: boolean;
  stagnation_duration_seconds: number;
  diversity: number;                           // 0–1
  piggybacking_score: number;                  // 0–1
}

interface InferredState {                    // §9.2
  state: ConversationState;
  confidence: number;
  secondary_state: ConversationState | null;
  secondary_confidence: number;
  criteria_snapshot: Record<string, number>;
}
```

### ConversationState (5 Zustände — bigpicture.md §9)

```
HEALTHY_EXPLORATION | HEALTHY_ELABORATION | DOMINANCE_RISK | CONVERGENCE_RISK | STALLED_DISCUSSION
```

### EnginePhase (4 Phasen — bigpicture.md §10)

```
MONITORING → CONFIRMING → POST_CHECK → COOLDOWN
```

### EngineState

```typescript
interface EngineState {
  session_id: string;
  phase: EnginePhase;
  current_state: ConversationState;
  phase_entered_at: string;
  cooldown_until?: string;
  intervention_count: number;
  last_intervention_at?: string;
}
```

### Intervention (bigpicture.md §10.3)

```typescript
type InterventionIntent =
  | 'PARTICIPATION_REBALANCING'
  | 'PERSPECTIVE_BROADENING'
  | 'REACTIVATION'
  | 'ALLY_IMPULSE'
  | 'NORM_REINFORCEMENT'
  | 'GOAL_REFOCUS';

type InterventionTrigger = 'state' | 'rule_violation' | 'goal_refocus';

interface Intervention {
  id: string;
  session_id: string;
  intent: InterventionIntent;
  trigger: InterventionTrigger;
  text: string;
  audio_duration_ms?: number;
  metrics_at_intervention?: Record<string, unknown>;
  recovery_score?: number;
  recovered?: boolean;
  created_at: string;
}
```

### Idea / IdeaConnection (bigpicture.md §4)

```typescript
type IdeaType = 'brainstorming_idea' | 'ally_intervention' | 'action_item';
type ConnectionType = 'builds_on' | 'supports' | 'leads_to' | 'contrasts' | 'related' | 'contains' | 'refines';

interface Idea {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  author_name?: string;
  idea_type: IdeaType;
  position_x?: number;
  position_y?: number;
  color?: string;
  is_deleted: boolean;
  created_at: string;
}

interface IdeaConnection {
  id: string;
  session_id: string;
  source_idea_id: string;
  target_idea_id: string;
  connection_type: ConnectionType;
  created_at: string;
}
```

### SessionGoal (bigpicture.md §4)

```typescript
type GoalStatus = 'not_started' | 'mentioned' | 'partially_covered' | 'covered';

interface SessionGoal {
  id: string;
  session_id: string;
  label: string;
  description?: string;
  status: GoalStatus;
  heat_score: number;    // 0–1
  notes?: string;
  updated_at: string;
}
```

### SessionSummary

```typescript
interface SessionSummary {
  session_id: string;
  content: string;
  updated_at: string;
}
```

### Workspace / WorkspaceMember

```typescript
type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'professional' | 'academic' | 'enterprise';
  owner_id: string;
  max_sessions_per_month: number;
  sessions_this_month: number;
  max_participants_per_session: number;
  billing_email: string | null;
  created_at: string;
}

interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: WorkspaceMemberRole;
  joined_at: string;
}

interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceMemberRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
```

### FeatureKey / ModerationLevel

```typescript
type FeatureKey = 'metrics' | 'ideas' | 'summary' | 'goals' | 'rules';
type ModerationLevel = 'none' | 'moderation' | 'moderation_ally';
```

### CreateSessionFormData (Frontend → Backend)

```typescript
interface CreateSessionFormData {
  title: string;
  language: string;
  moderation_level: ModerationLevel;
  features: FeatureKey[];
  goals?: { label: string; description?: string }[];
  config?: Record<string, unknown>;
}
```

---

## Komponenten

### Session-Komponenten (`components/session/`)

| Komponente | Beschreibung | Props |
|------------|--------------|-------|
| `VideoGrid` | LiveKit Video mit Agent-Filter (`ParticipantKind.AGENT`), Error Boundary mit Retry, responsives Grid (1-4 Spalten) | `token, serverUrl, onConnectionChange?, onDisconnected?` |
| `TranscriptFeed` | Transkript-Anzeige mit Auto-Scroll, Speaker-Name (Gradient), Timestamp | `segments[]` |
| `MetricsPanel` | 2 Views (Metriken, Eingriffe): Custom SVG Sparklines, Gauge Bars, MetricRow-Komponenten, State Header, Risk Badge. Metriken-View hat 3 Sektionen: Beteiligung, Dynamik, Aktivität | `latest, history[], engineState, participants?, interventions?` |
| `IdeaBoard` | ReactFlow Graph mit CRUD, 3 Idee-Typen (Farben), 7 Connection-Typen, Soft-Delete, Edit-Modal, Legende, i18n (de/en/fr) | `ideas[], connections[], sessionId, language?` |
| `InterventionOverlay` | Intent-basiertes Toast (6 Intents, 3 Trigger), 8s Auto-Dismiss mit Progress-Bar, farbige Glow-Border um Video | `intervention, onDismiss, children` |
| `GoalsPanel` | Status-Dots (not_started→covered), Heat-Score-Balken, Gesamtübersicht (X/N covered, Durchschnitts-Heat) | `goals[]` |
| `SummaryPanel` | Zusammenfassungs-Text mit Timestamp | `summary, updatedAt?` |

### Setup-Komponenten (`components/setup/`)

| Komponente | Beschreibung |
|------------|--------------|
| `CreateSession` | Session-Erstellungsformular: Titel, Sprache (5 Optionen), Moderation-Level (3 Stufen), Features (ModuleSelector), Ziele. Success-Phase: Join-Code, Copy-Button, Host-Name, Start-Button |
| `ModuleSelector` | Feature-Auswahl Grid (5 Features: metrics, ideas, summary, goals, rules). Visuelles Checkbox-Grid mit Icons, Labels, Beschreibungen, Disabled-State |

---

## VideoGrid: Agent-Handling

- Backend-Agents werden via `ParticipantKind.AGENT` aus dem Grid gefiltert (LiveKit setzt das serverseitig)
- Nicht name-basiert → ein User namens "agent-xyz" wird trotzdem angezeigt
- `TrackLoop` statt `GridLayout` (vermeidet internen Track-State-Konflikt)
- Responsives Grid: 1 Spalte (1 TN), 2 Spalten (2 TN), 3 Spalten (3 TN), 4 Spalten (4+ TN)
- LiveKit Leave-Button ausgeblendet (`controls={{ leave: false }}`)
- `LiveKitErrorBoundary`: Error Boundary Klasse mit Retry-Möglichkeit

---

## Session-Page Layout

### Desktop (≥1024px)
```
┌─────────────────────────────────────────────────────┐
│ Header: ← Title  JoinCode  Participants  [Beenden]  │
├────────────────────────┬────────────────────────────┤
│                        │ Tabs: Transkript │ Metriken │
│     Video (60%)        │       Ideen │ Ziele │ ...   │
│                        ├────────────────────────────┤
│  (InterventionOverlay) │                            │
│                        │    Tab Content (40%)        │
│  Idle-Banner           │                            │
└────────────────────────┴────────────────────────────┘
```

### Mobile (<1024px)
```
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│                     │
│   Content Area      │
│  (Video/Ideen/Panel)│
│                     │
├─────────────────────┤
│ Video │ Ideen │Panel│  ← Bottom Tab Bar
└─────────────────────┘
```

### Session-Page Features
- `100dvh` für korrekte iOS Safari Höhe
- `env(safe-area-inset-bottom)` für iPhone Home-Indicator
- Idle-Countdown: 5 Minuten Auto-End-Warnung mit Countdown-Banner
- Ended-Modal: Automatischer Redirect zum Dashboard nach 5 Sekunden bei Session-Ende
- Host/Co-Host-Controls: Teilnehmer befördern, Host übertragen (via Participant-Avatar-Dropdown)
- Participant-Avatare mit Rollen-Badges im Header
- Feature-Gating: Tabs werden nur angezeigt wenn `enabled_features` das Feature enthält
- Connection-Status-Indikator im Header

---

## Supabase-Tabellen (die das Frontend liest)

| Tabelle | Primärschlüssel | Frontend-Hook | Event |
|---------|-----------------|---------------|-------|
| `transcript_segments` | `id` | `useRealtimeSegments` | INSERT |
| `metric_snapshots` | `id` | `useRealtimeMetrics` | INSERT |
| `interventions` | `id` | `useRealtimeInterventions` | INSERT |
| `ideas` | `id` | `useRealtimeIdeas` | * |
| `idea_connections` | `id` | `useRealtimeIdeas` | * |
| `session_summary` | `session_id` | `useRealtimeSummary` | * |
| `engine_state` | `session_id` | `useRealtimeEngineState` | * |
| `session_goals` | `id` | `useRealtimeGoals` | * |
| `session_participants` | `id` | `useRealtimeParticipants` | * |
| `sessions` | `id` | `useRealtimeSession` | * |

**Alle Tabellen brauchen `session_id` Spalte** (für Realtime-Filter).
`session_summary` und `engine_state` nutzen `session_id` als PK (1:1 mit Session).
`sessions` filtert direkt auf `id=eq.{sessionId}`.

---

## Generic Realtime Hook: `useSupabaseChannel`

`lib/hooks/sync/useSupabaseChannel.ts` — gemeinsame Subscription-Logik für alle Realtime-Hooks.

```typescript
useSupabaseChannel<TRow>({
  channelName: string,           // Eindeutiger Channel-Prefix
  table: string,                 // Postgres-Tabellenname
  sessionId: string | null,      // Session-Filter
  isActive: boolean,             // Subscription aktiv?
  event: 'INSERT' | 'UPDATE' | '*',  // Default: 'INSERT'
  filter?: (sessionId) => string,     // Custom Filter (Default: session_id=eq.{id})
  onPayload: (row, eventType) => void,
  onError?: (message, context) => void,
})
```

**Features:**
- Exponential Backoff Reconnect: 1s → 2s → 4s → 8s → 16s, max 5 Versuche
- Overlapping-Subscribe-Guard (`isSubscribingRef`) verhindert Race Conditions
- `useLatestRef`-Pattern: keine Re-Subscriptions bei Prop-Änderungen
- Cleanup bei Unmount oder `sessionId`-Wechsel
- Error-Logging mit hilfreichen Tabellen-Setup-Hints

---

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://brainstorming-backend-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://agasejwalgyzqlsjrvzq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
NEXT_PUBLIC_LIVEKIT_URL=wss://uzh-brainstorming-referee-q8pfqq84.livekit.cloud
```

Nicht mehr im Frontend: `OPENAI_API_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Dependencies

| Package | Version | Zweck |
|---------|---------|-------|
| `next` | 16.1.6 | React Framework |
| `react` | 19.2.3 | UI Library |
| `@supabase/supabase-js` | ^2.98.0 | Realtime Subscriptions |
| `livekit-client` | ^2.17.2 | Video SDK |
| `@livekit/components-react` | ^2.9.20 | React Video Components |
| `@livekit/components-styles` | ^1.2.0 | LiveKit Default Styles |
| `@xyflow/react` | ^12.10.1 | Graph-Visualisierung (IdeaBoard) |
| `@dagrejs/dagre` | ^2.0.4 | Graph Layout (derzeit nur in _archive, unbenutzt) |
| `tailwindcss` | ^4 | CSS Framework |
| `recharts` | ^3.8.0 | Charts (derzeit nur in _archive, unbenutzt) |
| `@vercel/analytics` | ^1.6.1 | Vercel Analytics |

---

## Dateistruktur

```
app/
├── layout.tsx                    # Root Layout (Fonts, Viewport, Analytics)
├── globals.css                   # Design System (Glassmorphism, Animationen)
├── page.tsx                      # Landing Page (Join + Create)
├── dashboard/page.tsx            # Dashboard (Sessions nach Status)
├── join/[code]/page.tsx          # Join Flow (Name eingeben)
├── session/[id]/page.tsx         # Session Page (Video + Tabs)
├── workspace/page.tsx            # Workspace erstellen
├── workspace/[id]/page.tsx       # Workspace Dashboard (Stub)
└── join-workspace/page.tsx       # Workspace-Einladung annehmen

components/
├── setup/
│   ├── CreateSession.tsx         # Session-Erstellungsformular + Success-Phase
│   └── ModuleSelector.tsx        # Feature-Checkbox-Grid (5 Features)
└── session/
    ├── VideoGrid.tsx             # LiveKit Video (Agent-Filter, Error Boundary, Responsive Grid)
    ├── TranscriptFeed.tsx        # Transkript (Auto-Scroll)
    ├── MetricsPanel.tsx          # Metriken (2 Views: Metriken + Eingriffe; 3 Sektionen)
    ├── IdeaBoard.tsx             # Ideen-Graph (ReactFlow, CRUD, 7 Connection-Typen, i18n)
    ├── InterventionOverlay.tsx   # Interventions-Toast (6 Intents, 8s Auto-Dismiss)
    ├── GoalsPanel.tsx            # Ziele (Status-Dots, Heat-Score)
    └── SummaryPanel.tsx          # Zusammenfassung (Text + Timestamp)

lib/
├── api-client.ts                 # HTTP Client → FastAPI (Sessions, Participants, Ideas, Workspaces)
├── supabase/client.ts            # Supabase Browser Client (anon key, read-only)
├── realtime/
│   ├── index.ts                  # Barrel Export (9 Hooks)
│   ├── useRealtimeSegments.ts    # Transkript-Segmente (INSERT, max 15K, dedup)
│   ├── useRealtimeMetrics.ts     # Metriken (INSERT, partial merge, max 720)
│   ├── useRealtimeInterventions.ts # Interventionen (INSERT, latest tracking)
│   ├── useRealtimeIdeas.ts       # Ideen + Connections (*, dual subscription)
│   ├── useRealtimeSummary.ts     # Zusammenfassung (*, 1:1 mit Session)
│   ├── useRealtimeEngineState.ts # Engine State (*, dedup)
│   ├── useRealtimeGoals.ts       # Ziele (*, CRUD)
│   ├── useRealtimeParticipants.ts # Teilnehmer (*, initial API load, Rollen)
│   └── useRealtimeSession.ts     # Session-Status (*, idle/ended tracking)
├── hooks/
│   ├── useSessionData.ts         # Composition Hook (bündelt alle 9 Realtime-Hooks)
│   ├── useLatestRef.ts           # Ref-Utility (always-current ref für Callbacks)
│   ├── useMediaQuery.ts          # Responsive Breakpoint Hook (SSR-safe)
│   └── sync/
│       └── useSupabaseChannel.ts # Generic Realtime Channel (Reconnect, Backoff, Guard)
└── utils/
    ├── format.ts                 # formatTime, formatPercent, formatSeconds, estimateSpeakingSeconds
    ├── generateId.ts             # UUID Generator mit Prefix
    └── fetchWithRetry.ts         # HTTP Retry Wrapper (exponential backoff, 5xx retry, 4xx no retry)

types/
└── index.ts                      # Alle TypeScript-Interfaces (Session, Participant, Metrics, etc.)

_archive/                         # Alter Code (Research-Prototype, ~152 Dateien)
```

---

## Komponenten-Details (BigPicture-Konform)

### MetricsPanel — 2 Views

**State Header (immer sichtbar):**
- Aktueller Zustand (farbig), Konfidenz, sekundärer Zustand, Engine-Phase, Eingriffe-Count

**View-Switcher:** "Metriken" | "Eingriffe (N)"

**View 1: Metriken** — 3 Sektionen:

*Sektion Beteiligung:*
- Speaker Volume Bars: pro Teilnehmer (mit display_name Mapping via Participants)
- MetricRow: participation_risk_score mit SVG Sparkline + Gauge + Status-Ampel
- MetricRow: balance mit SVG Sparkline + Gauge + Status
- ShowMore: Detail-Gauges (gini, hoover, turn_share_gini, silent_ratio, dominance_streak, long_term_balance, cumulative_imbalance)

*Sektion Dynamik:*
- MetricRow: novelty_rate mit SVG Sparkline + Gauge + Status
- MetricRow: diversity (Themenbreite) mit SVG Sparkline + Gauge + Status
- ShowMore: Exploration/Elaboration Ratio-Balken (`ratio/(1+ratio)*100`), Cluster-Anzahl, Cluster-Konzentration, Expansion-Score, Piggybacking-Score, Jaccard-Fallback-Indikator

*Sektion Aktivität:*
- MetricRow: ideational_fluency_rate (Ideen/Min) mit Sparkline
- MetricRow: stagnation_duration_seconds mit Sparkline

**View 2: Eingriffe**
- Chronologische Interventions-Liste mit intent-basiertem Styling
- Intent-Farben + Trigger-Labels
- Count-Badge am View-Switcher

**Visualisierung:** Custom SVG `Sparkline`-Komponente (letzte 30 Datenpunkte), `GaugeBar`/`DetailGauge` für Balken, `MetricRow` für Einzel-Metriken mit Status-Ampel. Kein recharts.

**Defensiv-Checks:**
- Alle 3 JSONB-Felder (`participation`, `semantic_dynamics`, `inferred_state`) sind null-safe mit `??`-Defaults
- Sparkline-Zugriffe auf `s.participation?.participation_risk_score ?? 0` etc.
- Erste Metriken: Loading-Text "Erste Metriken erscheinen nach ~30 Sekunden..."
- Metriken-Tooltips: 17 Erklärungs-Tooltips für alle angezeigten Metriken

### InterventionOverlay — 6 Intents

| Intent | Farbe | Label |
|--------|-------|-------|
| PARTICIPATION_REBALANCING | Blau | Beteiligung |
| PERSPECTIVE_BROADENING | Violett | Perspektive |
| REACTIVATION | Amber/Orange | Reaktivierung |
| ALLY_IMPULSE | Grün/Emerald | Impuls |
| NORM_REINFORCEMENT | Gelb | Regel-Check |
| GOAL_REFOCUS | Indigo | Ziel-Refokus |

Trigger-Label: `state` → "Zustand", `rule_violation` → "Regelverstoss", `goal_refocus` → "Zielabweichung"

### GoalsPanel — Status-System

| Status | Dot-Farbe | Label |
|--------|-----------|-------|
| not_started | Grau | Nicht begonnen |
| mentioned | Amber | Erwähnt |
| partially_covered | Blau | Teilweise behandelt |
| covered | Grün | Abgedeckt |

Heat-Score (0–1): Farbige Fortschrittsbalken (Grau → Amber → Blau → Grün)
Gesamtübersicht: X/N covered, Durchschnitts-Heat-Score

### IdeaBoard — Typ-basiert

| Idea-Type | Farbe | Badge |
|-----------|-------|-------|
| brainstorming_idea | Indigo/Violett | Idee |
| ally_intervention | Grün/Emerald | Impuls |
| action_item | Amber/Orange | Aktion |

**7 Connection-Typen:**

| Typ | Farbe | Stil |
|-----|-------|------|
| builds_on | Grün | Animiert |
| supports | Blau/Indigo | Animiert |
| leads_to | Violett | Animiert |
| refines | Violett | Animiert |
| contrasts | Orange | Dashed |
| related | Slate | Dashed |
| contains | Dark Slate | Dashed |

**Interaktiv:** Create-Input, Edit-Modal (Titel + Beschreibung), Delete-Confirmation (Soft-Delete)
**i18n:** Deutsch, Englisch, Französisch
**Layout:** Positionen aus Backend (`position_x`, `position_y`), MiniMap, Controls, Background Dots, Smoothstep Edges

---

## Was das Backend schreiben muss

Damit das Frontend Daten anzeigt, muss das Backend in folgende Tabellen schreiben:

1. **`transcript_segments`** — INSERT pro finalem Transkript-Segment
2. **`metric_snapshots`** — INSERT alle ~5s mit Participation + Semantic Metriken (partiell erlaubt)
3. **`interventions`** — INSERT wenn eine Intervention ausgelöst wird
4. **`ideas`** — INSERT/UPDATE wenn Ideen extrahiert werden (Frontend kann auch via API schreiben)
5. **`idea_connections`** — INSERT wenn Verbindungen erkannt werden
6. **`session_summary`** — UPSERT mit rollendem Summary-Text
7. **`engine_state`** — UPSERT bei Phase/State-Änderungen
8. **`session_goals`** — UPDATE bei Fortschritts-Änderungen
9. **`session_participants`** — INSERT/UPDATE bei Join/Leave/Role-Änderungen
10. **`sessions`** — UPDATE bei Status-Änderungen (active/idle/ended)

---

## Offene Punkte / TODO

- [ ] Workspace-Dashboard (`/workspace/[id]`) ist noch ein Stub
- [ ] Export-Funktion (`exportSession`) ist im API-Client, aber noch kein UI dafür
