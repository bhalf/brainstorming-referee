# Brainstorming Platform — Vollständige Anforderungsspezifikation

**Version:** 1.0  
**Datum:** März 2026  
**Status:** Bereit zur Implementierung

---

## 1. Projektziel

Aufbau einer professionellen, SaaS-fähigen KI-gestützten Brainstorming-Plattform. Die Plattform ermöglicht Teams, strukturierte Brainstorming-Sessions via Video-Call durchzuführen, wobei ein KI-Agent die Diskussion in Echtzeit analysiert und bei Bedarf moderierend eingreift.

Das System wird als Multi-Tenant SaaS vermarktet und muss von Anfang an produktionsreif, erweiterbar und skalierbar aufgebaut sein — keine Forschungs-Hacks, keine Client-seitige Business-Logik, keine fragile Decision-Owner-Architektur.

---

## 2. Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind | Stabil, App Router, keine RC-Versionen |
| Auth | Clerk (Phase 2) | B2B SSO, Organizations, Invites out of the box |
| Backend API | FastAPI (Python 3.12) | HTTP-Endpoints, Auth-Middleware, Workspace-Logik |
| Agent Worker | LiveKit Agents SDK (Python) | Server-seitiger Audio-Zugriff, persistente Prozesse |
| Datenbank | Supabase (PostgreSQL + pgvector) | RLS, Realtime, Storage, Embeddings |
| Cache / State | Railway Redis | Agent-Heartbeat, Rate Limiting, Session-Flags — direkt auf Railway, internes Netzwerk |
| Video | LiveKit Cloud | SFU, per-Track Audio-Zugriff, Agents-Integration |
| Transkription | OpenAI Realtime API (gpt-4o-transcribe) | Echter Streaming-WebSocket, Server-VAD, keine Deepgram-Abhängigkeit am Anfang |
| LLM | OpenAI GPT-4o | Interventions-Generierung, Ideen-Extraktion, Summaries |
| Embeddings | OpenAI text-embedding-3-small | Semantische Analyse, Topic-Tracking |
| TTS | OpenAI TTS | Moderator-Stimme in den LiveKit Room injecten |
| Frontend Deploy | Vercel | CDN, zero-config Next.js |
| Backend Deploy | Railway | Persistente Prozesse, kein Serverless, ~$5-10/mo Einstieg |
| Monitoring | Sentry + PostHog (Phase 2) | Nach dem Fundament ergänzen |
| Billing (Phase 2) | Stripe | Usage-based Pricing via Webhooks |

---

## 3. Repository-Struktur

**2 GitHub Repos, 3 Deployments:**

| Repo | Deployment | Platform |
|---|---|---|
| `brainstorming-frontend` | 1 Service | Vercel |
| `brainstorming-backend` | 2 Services (api + agent) | Railway |

Supabase ist kein eigenes Repo — das Schema liegt als `supabase/schema.sql` im Backend-Repo und wird einmalig in Supabase ausgeführt.

```
brainstorming-frontend/              → Vercel (1 Deployment)
  app/
  components/
  lib/

brainstorming-backend/               → Railway (2 Services)
  api/                               → Service 1: uvicorn api.main:app
  agent/                             → Service 2: python -m agent.main
  shared/                            → gemeinsam genutzt
  supabase/
    schema.sql                       → einmalig in Supabase ausführen
  requirements.txt
  Procfile
  .env
```

### 3.1 Frontend-Struktur (`brainstorming-frontend`)

```
brainstorming-frontend/
  app/
    page.tsx                   Landing
    dashboard/page.tsx         Sessions-Liste, neue Session erstellen
    session/[id]/page.tsx      Aktive Session (Video + UI)
    join/[code]/page.tsx       Beitreten via Join-Code
  components/
    session/
      VideoGrid.tsx            LiveKit Video-Ansicht
      TranscriptFeed.tsx       Transkript-Anzeige (read-only)
      MetricsPanel.tsx         Metriken-Visualisierung (read-only)
      IdeaBoard.tsx            Ideen-Graph (React Flow)
      InterventionOverlay.tsx  Moderator-Meldungen
      GoalsPanel.tsx           Gesprächsziel-Fortschritt
      SummaryPanel.tsx         Live-Zusammenfassung
    setup/
      CreateSession.tsx        Session-Erstellung mit Modul-Auswahl
      ModuleSelector.tsx       Modul-Konfiguration UI
    shared/                    Wiederverwendbare UI-Elemente
  lib/
    api-client.ts              HTTP-Client → FastAPI
    realtime/
      useRealtimeSegments.ts
      useRealtimeMetrics.ts
      useRealtimeInterventions.ts
      useRealtimeIdeas.ts
      useRealtimeSummary.ts
```

### 3.2 Backend-Struktur (`brainstorming-backend`)

```
brainstorming-backend/
  api/                               Service 1: uvicorn api.main:app
    main.py                          App-Entrypoint, CORS, Middleware
    routers/
      sessions.py                    Session CRUD, Join via Code
      workspaces.py                  Workspace Management
      participants.py                Teilnehmer-Lifecycle
      modules.py                     Modul-Konfiguration pro Session
      export.py                      Session-Export (JSON)
      webhooks.py                    LiveKit + Stripe Webhooks
    middleware/
      rate_limit.py                  Redis Rate Limiting
      auth.py                        Clerk JWT (Phase 2)
    services/
      livekit.py                     Token-Generierung
      agent_dispatcher.py            Agent starten / stoppen
      usage_tracker.py               Usage-Events für Billing
  agent/                             Service 2: python -m agent.main
    main.py                          Worker-Entrypoint, Job-Queue
    session_agent.py                 Haupt-Agent-Klasse pro Session
    transcription/
      realtime_client.py             OpenAI Realtime WebSocket pro Participant
      speaker_tracker.py             Speaker Identity + Segment-Assembly
    modules/                         EIN FILE PRO MODUL
      base.py                        Abstract BaseModule (Interface)
      participation.py               Partizipations-Metriken
      semantic.py                    Semantische Dynamik-Metriken
      state_inference.py             5-Zustands-Inferenz mit Hysterese
      decision_engine.py             4-Phasen State Machine
      idea_extraction.py             LLM-Ideen-Extraktion
      live_summary.py                Rolling Summary
      goal_tracker.py                Topic Tracking + Embedding Heat
      rule_check.py                  Regel-Verletzungs-Erkennung
    interventions/
      moderator.py                   Moderator GPT-4o Call + TTS Inject
      ally.py                        Impuls-Teilnehmer GPT-4o Call + TTS Inject
    sync/
      supabase_writer.py             Alle DB-Writes aus dem Agent
  shared/                            Gemeinsam: API + Agent
    types.py                         Pydantic Models
    database.py                      Supabase-Client (service role)
    redis_client.py                  Railway Redis
    config.py                        Env-Variablen, Konstanten
  tests/
    test_participation.py
    test_state_inference.py
    test_decision_engine.py
  supabase/
    schema.sql                       Einmalig in Supabase ausführen
  requirements.txt
  Procfile
```

---

## 4. Datenbankschema

### 4.1 Multi-Tenancy Fundament

```sql
-- Workspaces (Organisationen / Teams)
CREATE TABLE workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan          TEXT DEFAULT 'starter',       -- starter / professional / academic / enterprise
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Workspace-Mitglieder
CREATE TABLE workspace_members (
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,                -- Clerk User ID
  role          TEXT DEFAULT 'member',        -- owner / admin / member
  joined_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
```

### 4.2 Session Management

```sql
-- Sessions
CREATE TABLE sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by        TEXT NOT NULL,            -- Clerk User ID
  title             TEXT NOT NULL,
  status            TEXT DEFAULT 'scheduled', -- scheduled / active / ended
  join_code         TEXT UNIQUE NOT NULL,     -- 6-stellig z.B. "BRN-447"
  livekit_room      TEXT UNIQUE NOT NULL,     -- LiveKit Room Name
  moderator_enabled BOOLEAN DEFAULT false,    -- KI-Moderation aktiv
  ally_enabled      BOOLEAN DEFAULT false,    -- Impuls-Teilnehmer aktiv
  language          TEXT DEFAULT 'de-CH',
  config            JSONB DEFAULT '{}',       -- Schwellenwerte, Zeitparameter
  agent_id          UUID,                     -- Referenz auf agent_jobs
  started_at        TIMESTAMPTZ,
  ended_at          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Session-Teilnehmer
CREATE TABLE session_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id           TEXT,                     -- Clerk User ID (optional für Gäste)
  display_name      TEXT NOT NULL,
  role              TEXT DEFAULT 'participant', -- host / participant / observer
  livekit_identity  TEXT NOT NULL,
  joined_at         TIMESTAMPTZ DEFAULT now(),
  left_at           TIMESTAMPTZ
);

-- Session-Module (welche Module für diese Session aktiv)
CREATE TABLE session_modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE,
  module_key   TEXT NOT NULL,
  -- Mögliche Werte:
  -- 'participation_metrics'
  -- 'semantic_analysis'
  -- 'state_inference'
  -- 'decision_engine'
  -- 'idea_extraction'
  -- 'live_summary'
  -- 'goal_tracking'
  -- 'rule_check'
  -- 'moderator'
  -- 'ally'
  enabled      BOOLEAN DEFAULT true,
  config       JSONB DEFAULT '{}',
  UNIQUE (session_id, module_key)
);
```

### 4.3 Core Session-Daten

```sql
-- Transkript-Segmente
CREATE TABLE transcript_segments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_identity  TEXT NOT NULL,           -- LiveKit Participant Identity
  speaker_name      TEXT NOT NULL,           -- Anzeige-Name
  text              TEXT NOT NULL,
  is_final          BOOLEAN DEFAULT true,
  language          TEXT,
  embedding         vector(1536),            -- pgvector, gesetzt nach Generierung
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Metriken-Snapshots (modular, JSONB pro Modul)
CREATE TABLE metric_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
  computed_at     TIMESTAMPTZ DEFAULT now(),
  participation   JSONB,   -- gini, silent_ratio, dominance_streak, risk_score etc.
  semantic        JSONB,   -- novelty_rate, cluster_concentration, stagnation etc.
  state           TEXT,    -- HEALTHY_EXPLORATION / DOMINANCE_RISK / STALLED_DISCUSSION / etc.
  confidence      FLOAT
);

-- Engine-State (aktueller Zustand der State Machine)
CREATE TABLE engine_state (
  session_id      UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  phase           TEXT DEFAULT 'MONITORING', -- MONITORING / CONFIRMING / POST_CHECK / COOLDOWN
  current_state   TEXT DEFAULT 'HEALTHY_EXPLORATION',
  intervention_count INTEGER DEFAULT 0,
  last_intervention_at TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Interventionen
CREATE TABLE interventions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
  module          TEXT NOT NULL,             -- 'moderator' / 'ally' / 'rule_check' / 'goal_refocus'
  trigger_state   TEXT,
  trigger_reason  TEXT,
  content         TEXT NOT NULL,
  audio_url       TEXT,
  executed_at     TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Features

```sql
-- Ideen
CREATE TABLE ideas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Ideen-Verbindungen
CREATE TABLE idea_connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID REFERENCES ideas(id) ON DELETE CASCADE,
  target_id   UUID REFERENCES ideas(id) ON DELETE CASCADE,
  strength    FLOAT DEFAULT 0.5,
  label       TEXT
);

-- Gesprächsziele
CREATE TABLE session_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  description TEXT,
  embedding   vector(1536),
  progress    FLOAT DEFAULT 0,              -- 0-1, via LLM-Assessment
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Live-Zusammenfassung (rolling, wird überschrieben)
CREATE TABLE session_summary (
  session_id  UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  content     TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 Agent Management & Billing

```sql
-- Agent Jobs (welcher Worker-Prozess läuft für welche Session)
CREATE TABLE agent_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'starting',  -- starting / running / ended / error
  worker_id       TEXT,
  error           TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  last_heartbeat  TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ
);

-- Usage Events (für Billing)
CREATE TABLE usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,              -- 'session_minute' / 'llm_call' / 'tts_second'
  quantity      FLOAT NOT NULL,
  cost_usd      FLOAT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Annotations (Forscher-Annotationen für wissenschaftliche Auswertung)
CREATE TABLE intervention_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID REFERENCES interventions(id) ON DELETE CASCADE,
  annotator_id    TEXT NOT NULL,
  rating          INTEGER,                  -- 1-5
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Session-Flow (neu)

### 5.1 Session erstellen (Host)

```
1. Host öffnet Dashboard
2. Klickt "Neue Session"
3. Füllt Formular aus:
   - Titel
   - Sprache (de-CH / en-US)
   - Moderations-Stufe:
       ○ Keine Moderation
       ● Moderation
       ○ Moderation + Impuls
   - Module (Checkboxen):
       ✅ Partizipations-Analyse    (immer aktiv wenn Moderation)
       ✅ Semantische Analyse       (immer aktiv wenn Moderation)
       ☐  Ideen-Extraktion
       ☐  Live-Zusammenfassung
       ☐  Gesprächsziele           → Ziele eingeben wenn aktiv
       ☐  Regel-Check
   - Erweiterte Einstellungen (optional, Schwellenwerte)
4. POST /api/sessions → bekommt join_code zurück (z.B. "BRN-447")
5. Dashboard zeigt Join-Code + kopierbaren Link
6. Host kann Link/Code an Teilnehmer senden
```

### 5.2 Session beitreten (Teilnehmer)

```
1. Teilnehmer öffnet /join/BRN-447 oder gibt Code ein
2. Gibt Display-Name ein
3. POST /api/sessions/join → bekommt LiveKit-Token + Session-Metadaten
4. Klickt "Beitreten" → LiveKit Room wird gejoined
```

### 5.3 Agent-Dispatch

```
1. Erster Teilnehmer oder Host joined LiveKit Room
2. LiveKit Webhook (participant_joined) → FastAPI
3. FastAPI prüft: Hat diese Session bereits einen laufenden Agent?
4. Nein → agent_dispatcher.py dispatched neuen Agent-Job
5. Agent-Worker picked Job auf, started Session-Agent, joined LiveKit Room
6. Agent öffnet pro Participant einen OpenAI Realtime WebSocket
7. Agent meldet Heartbeat alle 10s → Redis
```

### 5.4 Session-Ende

```
1. Host klickt "Session beenden" ODER alle Teilnehmer haben verlassen
2. LiveKit Webhook (room_finished) → FastAPI
3. FastAPI setzt session.status = 'ended'
4. Agent führt Cleanup aus:
   - Post-Session Summary generieren
   - Alle Ideen-Verbindungen finalisieren
   - Session-Export JSON in Supabase Storage
5. Agent-Job wird beendet
```

---

## 6. LiveKit Agent — Architektur

### 6.1 Grundprinzip

Der Agent ist ein Python-Prozess der auf Railway läuft. Er ist kein HTTP-Server. Er reagiert auf Events.

```python
# Jede Session bekommt eine eigene Agent-Instanz
class SessionAgent:
    def __init__(self, session_id, config, active_modules):
        self.modules = active_modules        # nur aktivierte Module
        self.state = AgentState()
        self.supabase = SupabaseWriter(session_id)

    async def on_participant_connected(self, participant):
        # OpenAI Realtime WebSocket für diesen Participant öffnen
        client = RealtimeClient(participant.identity)
        client.on_segment(self.handle_segment)
        await client.start()

    async def handle_segment(self, segment):
        # Segment in DB schreiben
        await self.supabase.write_segment(segment)
        # Alle aktiven Module benachrichtigen
        for module in self.modules:
            await module.on_segment(segment)
```

### 6.2 Modul-System

Jedes Modul implementiert das BaseModule-Interface:

```python
class BaseModule:
    key: str                                  # eindeutiger Modul-Schlüssel
    
    def __init__(self, config: dict, writer: SupabaseWriter):
        self.config = config
        self.writer = writer

    async def on_segment(self, segment: TranscriptSegment):
        """Aufgerufen für jedes neue finale Transkript-Segment."""
        pass

    async def on_tick(self, interval_key: str, agent_state: AgentState):
        """Aufgerufen periodisch (verschiedene Intervalle pro Modul)."""
        pass

    async def on_session_end(self):
        """Aufgerufen wenn Session endet — Cleanup, finale Berechnungen."""
        pass
```

Beispiel-Intervalle:

| Modul | Trigger | Intervall |
|---|---|---|
| participation | on_segment + on_tick | alle 5s |
| semantic | on_segment + on_tick | alle 5s |
| state_inference | on_tick (nach metrics) | alle 5s |
| decision_engine | on_tick | alle 1s |
| idea_extraction | on_tick | alle 4s |
| live_summary | on_tick | alle 60s |
| goal_tracker | on_tick (heat + LLM) | 5s / 90s |
| rule_check | on_segment | bei jedem Segment |

### 6.3 Transkriptions-Pipeline

```
LiveKit SFU
  └── Audio-Track Participant A   ──→  OpenAI Realtime WebSocket A
  └── Audio-Track Participant B   ──→  OpenAI Realtime WebSocket B
  └── Audio-Track Participant C   ──→  OpenAI Realtime WebSocket C

Jeder WebSocket:
  - gpt-4o-transcribe
  - Server-VAD (kein manuelles Chunking)
  - Noise Reduction: near_field
  - Streaming: conversation.item.input_audio_transcription.delta
  - Final:    conversation.item.input_audio_transcription.completed

→ TranscriptSegment {
    session_id, speaker_identity, speaker_name,
    text, is_final, language, timestamp
  }
→ supabase_writer.write_segment()
→ Supabase Realtime → alle Browser-Clients (nur anzeigen)
```

### 6.4 Interventions-Ausführung

```
decision_engine erkennt: INTERVENTION nötig
  → moderator.py:
      1. Kontext aufbauen (letzte N Segmente + aktuelle Metriken)
      2. GPT-4o Call → Moderations-Text
      3. OpenAI TTS → Audio-Buffer
      4. LiveKit: Audio-Track in Room publishen (Teilnehmer hören Moderator)
      5. intervention in DB schreiben
      6. Supabase Realtime → Browser zeigt Intervention-Overlay
```

---

## 7. FastAPI Backend — Endpoints

### 7.1 Session-Endpoints

```
POST   /api/sessions                  Session erstellen
GET    /api/sessions                  Alle Sessions des Workspace
GET    /api/sessions/{id}             Session-Details
PATCH  /api/sessions/{id}             Session updaten
POST   /api/sessions/join             Session beitreten via Code
POST   /api/sessions/{id}/end         Session beenden

GET    /api/sessions/{id}/export      Vollständiger JSON-Export
GET    /api/sessions/{id}/segments    Transkript-Segmente
GET    /api/sessions/{id}/metrics     Metriken-Snapshots
GET    /api/sessions/{id}/ideas       Ideen + Verbindungen
GET    /api/sessions/{id}/interventions Interventions-Liste
```

### 7.2 Workspace-Endpoints

```
POST   /api/workspaces                Workspace erstellen
GET    /api/workspaces/{id}           Workspace-Details
POST   /api/workspaces/{id}/members   Mitglied einladen
DELETE /api/workspaces/{id}/members/{userId}
```

### 7.3 System-Endpoints

```
POST   /api/webhooks/livekit          LiveKit Events (room_finished etc.)
POST   /api/webhooks/stripe           Stripe Billing Events (Phase 2)
POST   /api/livekit/token             LiveKit JWT-Token generieren
```

### 7.4 Auth-Middleware (Phase 2)

In Phase 1 sind alle Endpoints ohne Auth zugänglich. In Phase 2 wird Clerk JWT-Validierung als Middleware ergänzt — ohne dass sich die Endpoint-Struktur ändert.

---

## 8. Browser (Frontend) — Verantwortlichkeiten

Der Browser macht **ausschliesslich**:

- Video und Audio via LiveKit Client SDK darstellen
- UI rendern (React-Komponenten)
- Supabase Realtime Subscriptions empfangen und anzeigen
- HTTP-Requests an FastAPI senden (Session erstellen, joinen, etc.)
- LiveKit-Token von FastAPI holen

Der Browser berechnet **nichts**:

- Keine Metriken-Berechnung
- Keine State Machine
- Keine LLM-Calls
- Kein localStorage für Embeddings oder Konfiguration
- Kein Decision-Owner-Konzept
- Keine OpenAI API-Keys im Client

### 8.1 Supabase Realtime Subscriptions (read-only)

```typescript
// Alle Hooks sind reine Empfänger — kein Schreiben aus dem Browser
useRealtimeSegments(sessionId)        // neue Transkript-Segmente
useRealtimeMetrics(sessionId)         // Metriken-Updates
useRealtimeInterventions(sessionId)   // neue Interventionen → Overlay + TTS-Playback
useRealtimeIdeas(sessionId)           // neue Ideen → IdeaBoard
useRealtimeSummary(sessionId)         // Summary-Updates
useRealtimeEngineState(sessionId)     // State-Anzeige im Dashboard
```

### 8.2 TTS-Playback im Browser

Der Agent injiziert Audio direkt als LiveKit-Track in den Room. Browser spielen diesen Track ab wie jeden anderen Teilnehmer-Track — kein separater TTS-Mechanismus nötig.

---

## 9. Modul-Konfiguration — Detailspezifikation

### 9.1 Verfügbare Module

| Module Key | Name | Beschreibung | Abhängigkeiten |
|---|---|---|---|
| participation_metrics | Partizipations-Analyse | Gini, Silent Ratio, Dominanz | — |
| semantic_analysis | Semantische Analyse | Novelty Rate, Cluster, Stagnation | Embeddings |
| state_inference | Zustandsinferenz | 5-Zustands-Erkennung mit Hysterese | participation + semantic |
| decision_engine | Entscheidungs-Engine | 4-Phasen State Machine | state_inference |
| moderator | KI-Moderation | GPT-4o Intervention + TTS | decision_engine |
| ally | Impuls-Teilnehmer | KI-Teilnehmer mit Impulsen | decision_engine |
| idea_extraction | Ideen-Extraktion | LLM erkennt und verknüpft Ideen | Embeddings |
| live_summary | Live-Zusammenfassung | Rolling Summary alle 60s | — |
| goal_tracking | Gesprächsziele | Embedding-Heat + LLM-Assessment | Embeddings |
| rule_check | Regel-Check | LLM-basierte Regelverletzungserkennung | — |

### 9.2 Moderations-Stufen (UI-Abstraktion)

Im UI werden Module nicht einzeln angezeigt — stattdessen eine klare Auswahl:

```
Keine Moderation
  → Keine Module ausser optionalen Features

Moderation
  → participation_metrics ✅ (auto)
  → semantic_analysis ✅ (auto)
  → state_inference ✅ (auto)
  → decision_engine ✅ (auto)
  → moderator ✅ (auto)

Moderation + Impuls
  → Alles wie "Moderation"
  → ally ✅ (zusätzlich)
```

Optionale Zusatz-Module wählt der Host separat:
- Ideen-Extraktion
- Live-Zusammenfassung
- Gesprächsziele
- Regel-Check

### 9.3 Konversations-Zustände (5 States)

| State | Bedeutung |
|---|---|
| HEALTHY_EXPLORATION | Gesunde, ausgewogene Diskussion |
| DOMINANCE_RISK | Ein Teilnehmer dominiert stark |
| STALLED_DISCUSSION | Diskussion stagniert, keine neuen Ideen |
| OFF_TOPIC_DRIFT | Thematische Abweichung erkannt |
| RECOVERY | Erholung nach Intervention |

### 9.4 Engine-Phasen (4 Phases)

| Phase | Beschreibung |
|---|---|
| MONITORING | Normalbetrieb, Metriken werden beobachtet |
| CONFIRMING | Risiko-Zustand erkannt, 45s Bestätigung |
| POST_CHECK | Nach Intervention, 180s Erholungs-Check |
| COOLDOWN | 180s Pause nach Intervention |

---

## 10. Konfigurations-Parameter (Agent)

Alle Parameter sind pro Session konfigurierbar und werden in `sessions.config` (JSONB) gespeichert.

| Parameter | Standard | Beschreibung |
|---|---|---|
| WINDOW_SECONDS | 300 | Analyse-Zeitfenster |
| ANALYZE_EVERY_MS | 5000 | Metriken-Berechnungs-Intervall |
| COOLDOWN_SECONDS | 180 | Pause nach Intervention |
| POST_CHECK_SECONDS | 180 | Erholungs-Check-Dauer |
| CONFIRMATION_SECONDS | 45 | Bestätigung Risiko-Zustand |
| MAX_INTERVENTIONS_PER_10MIN | 3 | Rate-Limit Interventionen |
| RECOVERY_IMPROVEMENT_THRESHOLD | 0.15 | Mindest-Verbesserung für "erholt" |
| THRESHOLD_PARTICIPATION_RISK | 0.55 | Risiko-Schwelle Partizipation |
| THRESHOLD_NOVELTY_RATE | 0.30 | Neuheits-Schwelle |
| NOVELTY_COSINE_THRESHOLD | 0.45 | Cosinus-Schwelle neue Idee |
| CLUSTER_MERGE_THRESHOLD | 0.35 | Cluster-Merge-Schwelle |
| PARTICIPATION_RISK_WEIGHTS | [0.35, 0.25, 0.25, 0.15] | Gewichtung Gini/Silent/Dominance/TurnGini |

---

## 11. Pricing-Modell (für späteres Billing)

| Tier | Preis | Sessions | Zielgruppe |
|---|---|---|---|
| Trial | Gratis | 5 Sessions | Alle |
| Starter | $49/mo | 15 Sessions | Kleine Teams |
| Professional | $199/mo | 75 Sessions | Agenturen, Coaches |
| Academic | $99/mo | 75 Sessions | Unis, Forschung |
| Enterprise | ab $800/mo | Custom | Konzerne |

**Credit-Packs** (Zusatz-Sessions):
- 10 Sessions: $29
- 50 Sessions: $119
- 200 Sessions: $399

**1 Session** = bis 8 Teilnehmer, bis 90 Minuten. Grössere Sessions = 2 Credits.

---

## 12. Migrations-Plan (von bestehender Forschungs-App)

### Phase 1 — Fundament (3-4 Tage)
- Neues DB-Schema in Supabase erstellen
- FastAPI Grundgerüst: Session CRUD, LiveKit Token, Auth-Middleware
- Next.js spricht gegen FastAPI (nicht eigene API Routes)
- Railway-Deployment einrichten

### Phase 2 — Agent Grundgerüst (2-3 Tage)
- LiveKit Agent Worker läuft auf Railway
- Joined Session-Rooms, öffnet OpenAI Realtime WebSockets
- Transkript-Segmente landen in Supabase
- Browser empfängt via Realtime (read-only)

### Phase 3 — Module portieren (4-5 Tage)
- participation.ts → participation.py
- semanticDynamics.ts → semantic.py
- inferConversationState.ts → state_inference.py
- interventionPolicy.ts → decision_engine.py
- Alle 103 bestehenden Tests als Referenz nutzen

### Phase 4 — Features portieren (3-4 Tage)
- useIdeaExtraction → idea_extraction.py
- useLiveSummary → live_summary.py
- useGoalTracker → goal_tracker.py
- ruleViolationChecker → rule_check.py
- Moderator + Ally Interventionen mit TTS-Inject in LiveKit Room

### Phase 5 — Browser aufräumen (2-3 Tage)
- Alle computation Hooks entfernen
- localStorage Cache entfernen
- Decision-Owner-Logik entfernen
- Nur Realtime-Empfang und UI-Rendering verbleiben

### Phase 6 — Session-Flow neu (2 Tage)
- Join-Code System implementieren
- Kein öffentliches Room-Listing
- Workspace-Struktur im Frontend
- Dashboard mit Session-Verwaltung

### Phase 7 — SaaS-Basics (3-4 Tage)
- Usage Tracking in usage_events
- Rate Limiting via Redis
- Workspace-Isolation via RLS

---

## Phase 2 — Später (nach produktionsreifem Fundament)

- **Clerk Auth** — Login, SSO, Workspace-Invites
- **Stripe Billing** — Usage-based Pricing, Credit-Packs, Webhook
- **Multi-Tenancy enforcement** — RLS pro Workspace vollständig aktivieren
- **Admin-Panel** — Workspace-Verwaltung, Usage-Übersicht

**Gesamt: ~3-4 Wochen** für produktionsreifes Fundament.

---

## 13. Umgebungsvariablen

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://api.yourapp.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_LIVEKIT_URL=wss://xxx.livekit.cloud
# Clerk wird in Phase 2 ergänzt
```

### Backend (.env)
```env
# OpenAI
OPENAI_API_KEY=sk-...

# LiveKit
LIVEKIT_URL=wss://xxx.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=...

# Railway (automatisch gesetzt)
PORT=8000
RAILWAY_ENVIRONMENT=production
# Sentry, Clerk + Stripe werden in Phase 2 ergänzt
```

---

## 14. Qualitäts-Anforderungen

- Alle bestehenden 103 TypeScript-Tests werden als Python-Tests portiert
- Jedes Modul hat eigene Unit-Tests
- Agent-Prozess überlebt Teilnehmer-Disconnects ohne Datenverlust
- Session-State ist vollständig in Supabase — Agent-Neustart verliert nichts
- Alle API Keys ausschliesslich server-seitig, nie im Browser
- Row Level Security in Supabase: Kein Workspace sieht Daten eines anderen
- Rate Limiting auf allen LLM-Endpoints via Redis Sliding Window

---

*Dieses Dokument beschreibt den vollständigen Zielzustand. Es dient als Referenz für die Implementierung und ersetzt die bestehende Forschungs-Architektur vollständig.*

---

## 20. Implementierungs-Prompts

### Prompt A — Backend (`brainstorming-backend`)

```
Du baust das Backend für eine professionelle, SaaS-fähige KI-gestützte 
Brainstorming-Plattform. Das Backend besteht aus zwei Python-Services 
in einem einzigen GitHub Repo, deployed auf Railway.

---

STACK:
- Python 3.12
- FastAPI (HTTP API, Service 1)
- LiveKit Agents SDK (Agent Worker, Service 2)
- Supabase (PostgreSQL + pgvector, via supabase-py)
- Redis (Railway Redis, via redis-py)
- OpenAI SDK (GPT-4o, Embeddings, Realtime API, TTS)
- LiveKit Server SDK (Token-Generierung)

DEPLOYMENT:
- Service 1: uvicorn api.main:app --host 0.0.0.0 --port $PORT
- Service 2: python -m agent.main
- Beide Services laufen aus demselben Repo auf Railway

---

ORDNERSTRUKTUR (exakt so aufbauen):

brainstorming-backend/
  api/
    main.py                  FastAPI App, CORS, Router-Registration
    routers/
      sessions.py            Session CRUD + Join via Code
      workspaces.py          Workspace Management
      participants.py        Teilnehmer-Lifecycle
      modules.py             Modul-Konfiguration pro Session
      export.py              Session-Export (JSON)
      webhooks.py            LiveKit Webhook (room_finished)
    middleware/
      rate_limit.py          Redis Sliding Window Rate Limiting
    services/
      livekit.py             LiveKit JWT Token-Generierung
      agent_dispatcher.py    Agent-Job erstellen und starten
      usage_tracker.py       Usage-Events in DB schreiben
  agent/
    main.py                  LiveKit Worker Entrypoint
    session_agent.py         Haupt-Agent-Klasse pro Session
    transcription/
      realtime_client.py     OpenAI Realtime WebSocket pro Participant
      speaker_tracker.py     Speaker Identity + Segment-Assembly
    modules/
      base.py                Abstract BaseModule Class
      participation.py       Partizipations-Metriken (Gini, Silent Ratio, Dominanz)
      semantic.py            Semantische Dynamik (Novelty Rate, Cluster, Stagnation)
      state_inference.py     5-Zustands-Inferenz mit Hysterese
      decision_engine.py     4-Phasen State Machine (MONITORING/CONFIRMING/POST_CHECK/COOLDOWN)
      idea_extraction.py     LLM-Ideen-Extraktion
      live_summary.py        Rolling Summary alle 60s
      goal_tracker.py        Topic Tracking + Embedding Heat
      rule_check.py          Regel-Verletzungs-Erkennung
    interventions/
      moderator.py           Moderator GPT-4o + TTS in LiveKit Room injecten
      ally.py                Impuls-Teilnehmer GPT-4o + TTS
    sync/
      supabase_writer.py     Alle DB-Writes aus dem Agent
  shared/
    config.py                Pydantic Settings, alle Env-Variablen
    database.py              Supabase Service-Role Client
    redis_client.py          Redis Client (Railway Redis)
    types.py                 Alle Pydantic Models
  tests/
    test_participation.py
    test_state_inference.py
    test_decision_engine.py
  supabase/
    schema.sql               Vollständiges DB-Schema
  requirements.txt
  Procfile
  .env.example

---

DATENBANK-SCHEMA (in supabase/schema.sql, mit pgvector):

-- pgvector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace Members
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by TEXT,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled',
  join_code TEXT UNIQUE NOT NULL,
  livekit_room TEXT UNIQUE NOT NULL,
  moderator_enabled BOOLEAN DEFAULT false,
  ally_enabled BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'de-CH',
  config JSONB DEFAULT '{}',
  agent_id UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session Participants
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT,
  display_name TEXT NOT NULL,
  role TEXT DEFAULT 'participant',
  livekit_identity TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ
);

-- Session Modules
CREATE TABLE session_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  UNIQUE (session_id, module_key)
);

-- Transcript Segments
CREATE TABLE transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_identity TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  text TEXT NOT NULL,
  is_final BOOLEAN DEFAULT true,
  language TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Metric Snapshots
CREATE TABLE metric_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ DEFAULT now(),
  participation JSONB,
  semantic JSONB,
  state TEXT,
  confidence FLOAT
);

-- Engine State
CREATE TABLE engine_state (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  phase TEXT DEFAULT 'MONITORING',
  current_state TEXT DEFAULT 'HEALTHY_EXPLORATION',
  intervention_count INTEGER DEFAULT 0,
  last_intervention_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interventions
CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  trigger_state TEXT,
  trigger_reason TEXT,
  content TEXT NOT NULL,
  audio_url TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- Ideas
CREATE TABLE ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Idea Connections
CREATE TABLE idea_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES ideas(id) ON DELETE CASCADE,
  target_id UUID REFERENCES ideas(id) ON DELETE CASCADE,
  strength FLOAT DEFAULT 0.5,
  label TEXT
);

-- Session Goals
CREATE TABLE session_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  embedding vector(1536),
  progress FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Session Summary (rolling, wird überschrieben)
CREATE TABLE session_summary (
  session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Jobs
CREATE TABLE agent_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'starting',
  worker_id TEXT,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Usage Events
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  quantity FLOAT NOT NULL,
  cost_usd FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supabase Realtime aktivieren für alle relevanten Tabellen:
ALTER PUBLICATION supabase_realtime ADD TABLE transcript_segments;
ALTER PUBLICATION supabase_realtime ADD TABLE metric_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE interventions;
ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
ALTER PUBLICATION supabase_realtime ADD TABLE idea_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE session_summary;
ALTER PUBLICATION supabase_realtime ADD TABLE engine_state;

---

MODUL-SYSTEM (agent/modules/base.py):

Jedes Modul implementiert dieses Interface:

class BaseModule:
    key: str  # eindeutiger Schlüssel z.B. 'participation_metrics'
    
    def __init__(self, config: dict, writer: SupabaseWriter): ...
    async def on_segment(self, segment: TranscriptSegment): ...
    async def on_tick(self, interval_key: str, agent_state: AgentState): ...
    async def on_session_end(self): ...

Intervalle pro Modul:
- participation + semantic: alle 5s (on_tick)
- state_inference: alle 5s, nach metrics (on_tick)
- decision_engine: alle 1s (on_tick)
- idea_extraction: alle 4s (on_tick)
- live_summary: alle 60s (on_tick)
- goal_tracker: 5s heat + 90s LLM (on_tick)
- rule_check: bei jedem Segment (on_segment)

---

KONVERSATIONS-ZUSTÄNDE (5):
HEALTHY_EXPLORATION, DOMINANCE_RISK, STALLED_DISCUSSION, OFF_TOPIC_DRIFT, RECOVERY

ENGINE-PHASEN (4):
MONITORING, CONFIRMING (45s), POST_CHECK (180s), COOLDOWN (180s)

---

ENV-VARIABLEN (.env.example):
OPENAI_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
REDIS_URL=
PORT=8000

---

WICHTIGE ARCHITEKTUR-REGELN:
1. Keine OpenAI API Keys im Browser — alles server-seitig
2. Kein Decision-Owner-Konzept — der Agent ist immer der einzige Owner
3. Browser schreibt nie direkt in Supabase — nur der Agent und die API schreiben
4. Browser empfängt nur via Supabase Realtime Subscriptions
5. Auth ist Phase 2 — keine Clerk-Integration jetzt, alle Endpoints sind offen
6. Redis für: Agent-Heartbeat, Rate Limiting, Session-Ownership-Lock
7. Jedes Modul ist eine eigene Datei und unabhängig testbar

---

STARTE MIT:
1. Ordnerstruktur anlegen
2. shared/config.py + shared/database.py + shared/redis_client.py
3. supabase/schema.sql vollständig
4. api/main.py + api/routers/sessions.py (Session erstellen + joinen)
5. api/services/livekit.py (Token-Generierung)
6. agent/main.py + agent/session_agent.py (Agent joined Room, loggt Participants)
7. Procfile + requirements.txt
8. Health Check: GET /health → {"status": "ok"}
9. Erster Test: Session erstellen → Join-Code zurückbekommen
```

---

### Prompt B — Frontend (`brainstorming-frontend`)

```
Du baust das Frontend für eine professionelle, SaaS-fähige KI-gestützte 
Brainstorming-Plattform. Das Frontend ist ein reines UI — es berechnet 
nichts, enthält keine Business-Logik und hält keinen globalen State 
ausser dem was für die UI direkt nötig ist.

---

STACK:
- Next.js 14 (App Router, TypeScript)
- React 18 (kein React 19 — zu early)
- Tailwind CSS
- LiveKit Client SDK + @livekit/components-react (Video-UI)
- @supabase/supabase-js (nur Realtime Subscriptions, kein Schreiben)
- @xyflow/react (Ideen-Graph)
- recharts (Metriken-Visualisierung)

DEPLOYMENT: Vercel

---

ORDNERSTRUKTUR:

brainstorming-frontend/
  app/
    page.tsx                   Landing: Session erstellen oder Code eingeben
    dashboard/
      page.tsx                 Sessions-Liste des Workspace
    session/[id]/
      page.tsx                 Aktive Session (Video + alle Panels)
    join/[code]/
      page.tsx                 Beitreten via Join-Code
  components/
    session/
      VideoGrid.tsx            LiveKit Video-Ansicht (alle Teilnehmer)
      TranscriptFeed.tsx       Transkript-Anzeige, read-only, Realtime
      MetricsPanel.tsx         Metriken-Charts, read-only, Realtime
      IdeaBoard.tsx            Ideen-Graph mit React Flow, Realtime
      InterventionOverlay.tsx  Moderator-Meldungen, erscheint kurz
      GoalsPanel.tsx           Gesprächsziel-Fortschritt, Realtime
      SummaryPanel.tsx         Live-Zusammenfassung, Realtime
    setup/
      CreateSession.tsx        Formular: Session erstellen
      ModuleSelector.tsx       Modul-Auswahl UI
    shared/
      Button.tsx
      Panel.tsx
      Badge.tsx
  lib/
    api-client.ts              Alle HTTP-Calls → FastAPI Backend
    realtime/
      useRealtimeSegments.ts   Supabase Realtime → Transkript
      useRealtimeMetrics.ts    Supabase Realtime → Metriken
      useRealtimeInterventions.ts
      useRealtimeIdeas.ts
      useRealtimeSummary.ts
      useRealtimeEngineState.ts
  types/
    index.ts                   Alle TypeScript-Typen

---

API CLIENT (lib/api-client.ts):

Alle Calls gehen gegen das FastAPI Backend (NEXT_PUBLIC_API_URL).
Kein direktes Supabase-Schreiben aus dem Browser.

Funktionen:
- createSession(data) → POST /api/sessions
- joinSession(code, name) → POST /api/sessions/join
- getSession(id) → GET /api/sessions/{id}
- getLivekitToken(room, identity) → POST /api/livekit/token
- endSession(id) → PATCH /api/sessions/{id}
- exportSession(id) → GET /api/sessions/{id}/export

---

REALTIME HOOKS (alle read-only, kein Schreiben):

Jeder Hook abonniert eine Supabase-Tabelle für eine Session:

useRealtimeSegments(sessionId)
  → INSERT auf transcript_segments
  → gibt TranscriptSegment[] zurück

useRealtimeMetrics(sessionId)
  → INSERT auf metric_snapshots
  → gibt letzten MetricSnapshot zurück

useRealtimeInterventions(sessionId)
  → INSERT auf interventions
  → triggert Overlay-Anzeige

useRealtimeIdeas(sessionId)
  → INSERT/UPDATE auf ideas + idea_connections
  → gibt Ideas[] + Connections[] zurück

useRealtimeSummary(sessionId)
  → UPDATE auf session_summary
  → gibt aktuellen Summary-Text zurück

useRealtimeEngineState(sessionId)
  → UPDATE auf engine_state
  → gibt Phase + State zurück (für Dashboard-Anzeige)

---

SESSION-SEITE (app/session/[id]/page.tsx):

Layout: Video links (60%), Sidebar rechts (40%) mit Tabs:
- Transkript (TranscriptFeed)
- Metriken (MetricsPanel)  
- Ideen (IdeaBoard)
- Ziele (GoalsPanel)
- Zusammenfassung (SummaryPanel)

InterventionOverlay erscheint als Toast oben, auto-dismiss nach 8s.

---

LANDING PAGE (app/page.tsx):

Zwei Aktionen:
1. "Neue Session erstellen" → öffnet CreateSession Modal/Dialog
2. "Session beitreten" → Eingabefeld für Join-Code → /join/[code]

Kein Login, kein Auth (Phase 2).

---

CREATE SESSION FORMULAR:

Felder:
- Titel (Text)
- Sprache (de-CH / en-US, Dropdown)
- Moderations-Stufe (Radio):
    ○ Keine Moderation
    ● Moderation  
    ○ Moderation + Impuls
- Optionale Module (Checkboxen, nur sichtbar wenn Moderation aktiv):
    ☐ Ideen-Extraktion
    ☐ Live-Zusammenfassung
    ☐ Gesprächsziele (+ Ziele eingeben wenn aktiv)
    ☐ Regel-Check
- Erweiterte Einstellungen (Accordion, optional):
    Schwellenwerte, Timing-Parameter

Nach Submit: Session-Code prominent anzeigen (z.B. "BRN-447") 
mit Kopier-Button und Link zum Teilen.

---

TYPEN (types/index.ts):

interface Session {
  id: string
  title: string
  status: 'scheduled' | 'active' | 'ended'
  join_code: string
  livekit_room: string
  moderator_enabled: boolean
  ally_enabled: boolean
  language: string
  config: Record<string, unknown>
  created_at: string
}

interface TranscriptSegment {
  id: string
  session_id: string
  speaker_identity: string
  speaker_name: string
  text: string
  is_final: boolean
  created_at: string
}

interface MetricSnapshot {
  id: string
  session_id: string
  computed_at: string
  participation: {
    gini_imbalance: number
    silent_participant_ratio: number
    dominance_streak_score: number
    participation_risk_score: number
    volume_share: Record<string, number>
  }
  semantic: {
    novelty_rate: number
    cluster_concentration: number
    stagnation_score: number
  }
  state: 'HEALTHY_EXPLORATION' | 'DOMINANCE_RISK' | 'STALLED_DISCUSSION' | 'OFF_TOPIC_DRIFT' | 'RECOVERY'
  confidence: number
}

interface Intervention {
  id: string
  session_id: string
  module: 'moderator' | 'ally' | 'rule_check' | 'goal_refocus'
  trigger_state: string
  content: string
  executed_at: string
}

interface Idea {
  id: string
  session_id: string
  title: string
  description: string
  created_at: string
}

---

ENV-VARIABLEN (.env.local):
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_LIVEKIT_URL=

---

WICHTIGE ARCHITEKTUR-REGELN:
1. Browser schreibt NIE direkt in Supabase — nur Realtime lesen
2. Alle API-Calls gehen über api-client.ts → FastAPI
3. Keine Business-Logik im Browser — kein Metriken-Rechnen, 
   kein State-Inferenz, keine LLM-Calls
4. Keine OpenAI Keys im Browser
5. localStorage nur für UI-Präferenzen (Tab-Auswahl etc.), 
   niemals für Embeddings oder Session-State
6. Auth ist Phase 2 — kein Clerk jetzt

---

STARTE MIT:
1. Next.js 16 Projekt erstellen (npx create-next-app@14)
2. Tailwind + alle Dependencies installieren
3. types/index.ts mit allen Typen
4. lib/api-client.ts mit allen FastAPI-Calls
5. lib/realtime/ alle 6 Hooks (read-only Supabase Subscriptions)
6. app/page.tsx Landing mit CreateSession + Join-Code Input
7. app/join/[code]/page.tsx Beitreten-Flow
8. app/session/[id]/page.tsx Session-Layout mit LiveKit Video
9. Alle Panel-Komponenten (Transcript, Metrics, Ideas, etc.)
```