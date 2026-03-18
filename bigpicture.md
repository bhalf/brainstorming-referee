# Brainstorming SaaS — Master-Anforderungsdokument v3.0
*Stand: März 2026 — Einzige Quelle der Wahrheit für Frontend, Backend und Architektur-Entscheidungen*

---

## 0. Executive Summary

Eine KI-gestützte Brainstorming-Plattform die aus einem UZH-Forschungsprototyp zu einem kommerziellen SaaS-Produkt wird. Das System analysiert Gruppenkonversationen in Echtzeit, erkennt Kommunikationsmuster (dominante Sprecher, Stagnation, thematische Verengung) und interveniert mit KI-generierter Moderation via Sprachausgabe — ohne dass die Gruppe einen menschlichen Moderator braucht.

**Kern-Differenzierung gegenüber Zoom/Teams/Miro:**
- Echtzeit-Analyse der Gesprächsdynamik (nicht nur Transkription)
- KI-Moderator der proaktiv eingreift, nicht nur aufzeichnet
- Drei Modi: Beobachtung / Moderation / Moderation + Ally-Eskalation
- Vollständige Session-Daten für Forscher und Facilitatoren

**Aktuelle Phase:** Phase 1 — Core-Infrastruktur (Transkription + Speicherung)  
**Nächste Phase:** Phase 2 — Echtzeit-Analyse-Engine (Metriken + State Inference)

---

## 1. System-Architektur (stabil)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 / React 19)                            │
│  Reiner UI-Layer — berechnet NICHTS, schreibt nie in DB     │
│                                                             │
│  Video/Audio ──────────────────────────────────────────┐   │
│  FastAPI HTTP ──────────────────────────────────────┐   │   │
│  Supabase Realtime (read-only) ─────────────────┐   │   │   │
└─────────────────────────────────────────────────│───│───│───┘
                                                  │   │   │
                                    ┌─────────────▼───▼───▼──┐
                                    │  LiveKit Cloud (SFU)    │
                                    │  WebRTC Audio/Video     │
                                    └────────────────┬────────┘
                                                     │ Audio-Tracks
                                    ┌────────────────▼────────┐
                                    │  Railway: Agent Service  │
                                    │  livekit-agents Worker   │
                                    │  Pro Participant: 1 WS   │
                                    │  → OpenAI Realtime API   │
                                    │  → Alle Berechnungen     │
                                    │  → TTS → LiveKit Track   │
                                    └────────────────┬────────┘
                                                     │
                                    ┌────────────────▼────────┐
                                    │  Railway: API Service    │
                                    │  FastAPI / Uvicorn       │
                                    │  Session CRUD, Tokens    │
                                    │  Webhooks, Export        │
                                    └────────────────┬────────┘
                                                     │
                          ┌──────────────────────────▼────────┐
                          │  Supabase (PostgreSQL 17)          │
                          │  16 Tabellen + pgvector 0.8        │
                          │  Realtime → Browser (read-only)    │
                          └───────────────────────────────────┘
```

**Goldene Regeln:**
1. Browser schreibt **nie** direkt in Supabase — immer via FastAPI
2. OpenAI Keys sind **nie** im Browser — nur im Agent/API
3. Der Agent ist **alleiniger** Owner der Decision-Engine
4. Alle DB-Writes im Agent laufen **nur** via `SupabaseWriter`
5. Modul-Fehler dürfen Transkription **nie** stoppen

---

## 2. Stack

| Layer | Technologie | Version |
|-------|------------|---------|
| Frontend Framework | Next.js | 16.x |
| Frontend Runtime | React | 19.x |
| Sprache Frontend | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Graph-UI | @xyflow/react | latest |
| Charts | recharts | latest |
| Backend API | FastAPI | 0.115.x |
| Backend Sprache | Python | 3.13 |
| Validation | Pydantic | v2 |
| Agent SDK | livekit-agents | 1.4.x |
| LLM/TTS/Embeddings | OpenAI | gpt-4o-2024-11-20 |
| Transkription | OpenAI Realtime API | gpt-4o-transcribe |
| Embeddings | OpenAI | text-embedding-3-small |
| TTS | OpenAI | tts-1-hd |
| Datenbank | Supabase | PostgreSQL 17 + pgvector 0.8 |
| Cache | Railway Redis | 7.x |
| Video | LiveKit Cloud | latest |
| Auth (Phase 3) | Clerk | latest |
| Billing (Phase 3) | Stripe | latest |

---

## 3. Repository-Struktur

```
brainstorming-backend/          Railway: 2 Services
  api/
    main.py                     Service 1: uvicorn api.main:app --port 8000
    routers/
      sessions.py               POST/GET/PATCH /api/sessions
      participants.py           Participant lifecycle
      livekit.py                Token-Generierung, Webhooks
      modules.py                Module-Config pro Session
      export.py                 Session-Export JSON
    middleware/
      rate_limit.py             Sliding-Window Rate Limiting
      auth.py                   Phase 3: Clerk JWT Validation
    services/
      livekit.py                LiveKit SDK Wrapper
  agent/
    main.py                     Service 2: python -m agent.main
    session_agent.py            Haupt-Entrypoint pro Room
    transcription/
      realtime_client.py        OpenAI Realtime WebSocket pro Participant
      speaker_tracker.py        Speaking-Time-Tracking
    modules/
      base.py                   BaseModule ABC
      participation.py          Partizipations-Metriken
      semantic.py               Semantische Dynamik + Embeddings
      state_inference.py        5-Zustands-Maschine
      decision_engine.py        4-Phasen Policy-Engine
      idea_extraction.py        LLM Ideen-Extraktion
      live_summary.py           Rolling Summary (60s)
      goal_tracker.py           Ziel-Tracking (Embedding-Heat + LLM)
      rule_check.py             LLM Regel-Prüfung
    interventions/
      moderator.py              GPT-4o → TTS → LiveKit Audio
      ally.py                   Ally-Impuls (Szenario B)
    prompts/
      moderator.py              Alle Moderator-Prompts (DE + EN)
      ally.py                   Ally-Prompts (DE + EN)
      extraction.py             Ideen-Extraktion-Prompts
      rule_check.py             Regel-Prüfungs-Prompts
      summary.py                Zusammenfassungs-Prompts
      goals.py                  Ziel-Bewertungs-Prompts
    sync/
      supabase_writer.py        EINZIGER Ort für DB-Writes im Agent
  shared/
    config.py                   Settings via Pydantic BaseSettings
    database.py                 Supabase Client (service role)
    redis_client.py             Redis Client
    types.py                    Pydantic Models
  tests/
  supabase/schema.sql           DB-Schema (einmal ausführen)
  requirements.txt
  Procfile                      api: uvicorn ...\nagent: python -m agent.main

brainstorming-frontend/         Vercel: 1 Service
  app/
    page.tsx                    Landing: Session erstellen / Join-Code
    dashboard/page.tsx          Session-Liste mit Status
    join/[code]/page.tsx        Join-Flow: Name eingeben
    session/[id]/page.tsx       Haupt-Session-View
  components/
    session/
      VideoGrid.tsx             LiveKit Video-Grid
      TranscriptFeed.tsx        Live-Transkript mit Speaker-Farben
      MetricsPanel.tsx          Partizipation + Semantik Charts
      IdeaBoard.tsx             React Flow Ideen-Graph
      InterventionOverlay.tsx   Toast-Overlay bei Interventionen
      GoalsPanel.tsx            Ziel-Fortschritt
      SummaryPanel.tsx          Rolling Summary
    setup/
      CreateSession.tsx         Session-Erstellung mit Modul-Wahl
      ModuleSelector.tsx        Szenarien: Keine / Moderation / Moderation+Ally
  lib/
    api-client.ts               HTTP-Client für FastAPI
    supabase/client.ts          Browser Supabase Client (anon key)
    realtime/                   7 Read-only Realtime Hooks
    hooks/useSessionData.ts     Composition-Hook
  types/index.ts                TypeScript Types (matching DB Schema)
  _archive/                     Alter Frontend-Code als Referenz für Backend
```

---

## 4. Datenbank-Schema (16 Tabellen)

```sql
-- Bereits deployed in Supabase. Nur zur Referenz.

workspaces (id, name, plan, owner_id)
workspace_members (workspace_id, user_id, role)
sessions (
  id UUID PK,
  title TEXT,
  join_code VARCHAR(8) UNIQUE,       -- z.B. "BRN-447"
  livekit_room TEXT,
  status TEXT,                        -- scheduled|active|ended
  moderator_enabled BOOLEAN,
  ally_enabled BOOLEAN,
  language VARCHAR(10),               -- "de-CH" | "en-US"
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  workspace_id UUID FK
)
session_participants (
  id UUID PK,
  session_id UUID FK,
  display_name TEXT,
  livekit_identity TEXT,
  role TEXT,                          -- host|participant
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ
)
session_modules (session_id FK, module_key TEXT, enabled BOOLEAN, config JSONB)
transcript_segments (
  id UUID PK,
  session_id UUID FK,
  speaker_identity TEXT,
  speaker_name TEXT,
  text TEXT,
  is_final BOOLEAN,
  language TEXT,
  embedding vector(1536),             -- text-embedding-3-small
  created_at TIMESTAMPTZ
)
metric_snapshots (
  id UUID PK,
  session_id UUID FK,
  participation JSONB,                -- ParticipationMetrics
  semantic_dynamics JSONB,            -- SemanticDynamicsMetrics
  inferred_state JSONB,               -- ConversationStateInference
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
engine_state (
  id UUID PK,
  session_id UUID FK UNIQUE,
  phase TEXT,                         -- MONITORING|CONFIRMING|POST_CHECK|COOLDOWN
  current_state TEXT,                 -- 5 Zustands-Namen
  phase_entered_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  intervention_count INT,
  last_heartbeat TIMESTAMPTZ
)
interventions (
  id UUID PK,
  session_id UUID FK,
  intent TEXT,                        -- PARTICIPATION_REBALANCING etc.
  trigger TEXT,                       -- state|rule_violation|goal_refocus
  text TEXT,                          -- Gesprochener Text
  audio_duration_ms INT,
  metrics_at_intervention JSONB,
  recovery_score FLOAT,
  recovered BOOLEAN,
  created_at TIMESTAMPTZ
)
ideas (
  id UUID PK,
  session_id UUID FK,
  title TEXT,
  description TEXT,
  author_name TEXT,
  idea_type TEXT,                     -- brainstorming_idea|ally_intervention|action_item
  position_x FLOAT,
  position_y FLOAT,
  color TEXT,
  is_deleted BOOLEAN,
  created_at TIMESTAMPTZ
)
idea_connections (
  id UUID PK,
  session_id UUID FK,
  source_idea_id UUID FK,
  target_idea_id UUID FK,
  connection_type TEXT,               -- builds_on|contrasts|supports|refines
  created_at TIMESTAMPTZ
)
session_summary (
  id UUID PK,
  session_id UUID FK UNIQUE,
  text TEXT,
  updated_at TIMESTAMPTZ
)
session_goals (
  id UUID PK,
  session_id UUID FK,
  label TEXT,
  description TEXT,
  status TEXT,                        -- not_started|mentioned|partially_covered|covered
  heat_score FLOAT,
  notes TEXT,
  updated_at TIMESTAMPTZ
)
agent_jobs (
  id UUID PK,
  session_id UUID FK UNIQUE,
  status TEXT,                        -- starting|running|ended|error
  last_heartbeat TIMESTAMPTZ
)
usage_events (session_id, event_type, payload JSONB, created_at)
intervention_annotations (intervention_id FK, annotation TEXT, created_by TEXT)
```

**Supabase Realtime aktiviert für:**
`transcript_segments`, `metric_snapshots`, `interventions`, `ideas`, `idea_connections`, `session_summary`, `engine_state`, `session_goals`

---

## 5. Aktueller Stand (März 2026)

### ✅ Fertig und funktionierend

**Infrastruktur:**
- Railway: Projekt aufgesetzt, Redis deployed und online
- Supabase: Schema deployed (16 Tabellen), pgvector aktiv, Realtime konfiguriert
- LiveKit Cloud: Account, Projekt, API Keys vorhanden

**Backend API (FastAPI):**
- Session CRUD (erstellen, abrufen, listen, beenden)
- Join via 6-stelligem Code (z.B. "BRN-447")
- LiveKit Token-Generierung
- Webhook-Handler (room_finished, participant_joined/left)
- CORS konfiguriert (Phase 1: offen)
- Lokaler Smoke-Test bestanden (Session + Join + Token)

**Agent (Grundstruktur):**
- Worker-Entrypoint (`WorkerType.ROOM`, auto-dispatch)
- Session-Agent Lifecycle (connect → load session → setup → shutdown)
- SupabaseWriter Grundstruktur
- Alle 8 Module als Stubs vorhanden
- Heartbeat-Loop (Redis + DB)
- Tick-Loop (Intervall-System: 1s, 4s, 5s, 60s, 90s)

**Frontend:**
- Build sauber (5 Routes)
- Session erstellen → funktioniert
- Session beitreten via Join-Code → funktioniert
- LiveKit Video verbindet → funktioniert (Kamera + Audio)
- 7 Realtime-Hooks subscribed und warten auf Backend-Daten
- Dark Glassmorphism Design implementiert
- Alle Panel-Komponenten vorhanden (warten auf Daten)

### 🔧 In Arbeit (Fixes nach letzter Review)

**Backend — kritische Fixes ausstehend:**
1. `realtime_client.py`: Zurück auf offizielle OpenAI SDK (`client.beta.realtime.connect()`) — Raw WebSocket entfernen
2. `session_agent.py`: `ctx.wait_for_shutdown()` korrekt implementieren
3. Token-Endpoint: nimmt `session_id`, holt `livekit_room` selbst aus DB
4. CORS: als `ALLOWED_ORIGINS` ENV-Variable vorbereiten

**Frontend — Fixes ausstehend:**
1. Token-Flow: kein sessionStorage — über URL-Parameter (`?name=&identity=`)
2. VideoGrid: Disconnect-Redirect erst nach erfolgter Verbindung

### ⏳ Noch nicht gestartet
- Transkriptions-Pipeline live getestet (End-to-End Segment im Browser)
- Metriken-Berechnung
- State Inference
- Decision Engine
- Interventionen (TTS + Audio-Inject)
- Ideen-Extraktion
- Live Summary
- Goal Tracking
- Railway Deployment
- Clerk Auth / Stripe (Phase 3)

---

## 6. Implementierungs-Roadmap

### Philosophie
Jede Stufe muss vollständig verifiziert sein bevor die nächste startet. Kein Weitergehen wenn etwas wackelt. Die Grundlage (Transkription) trägt alles andere.

```
STUFE 1-4: Transkription stabil      ← AKTUELLE PHASE
STUFE 5-7: Metriken-Engine           ← NÄCHSTE PHASE
STUFE 8-9: State + Decision          ← DANACH
STUFE 10:  Interventionen            ← KI-KERN
STUFE 11:  LLM-Features              ← VOLLSTÄNDIG
STUFE 12:  Deployment                ← LAUNCH-BEREIT
STUFE 13:  SaaS-Layer                ← MONETARISIERUNG
```

---

### Stufe 1: Transkription End-to-End ← JETZT

**Ziel:** Gesprochenes Wort erscheint in Supabase `transcript_segments`

**Backend (agent):**
```
realtime_client.py — open_transcription():
  1. client.beta.realtime.connect(model="gpt-4o-transcribe") [SDK, NICHT raw WS]
  2. session.update: input_audio_format=pcm16, server_vad, near_field
  3. stream_audio(): rtc.AudioStream(track, sample_rate=24000, num_channels=1) → base64 → append
  4. receive_transcripts(): event.type == "...completed" → writer.write_segment()
  5. asyncio.gather(stream_audio(), receive_transcripts(), return_exceptions=True)
  6. Retry-Loop: MAX_RETRIES=3, exponential backoff (1s, 2s, 4s)
```

**Verifikation:**
```sql
SELECT speaker_name, text, created_at FROM transcript_segments ORDER BY created_at DESC LIMIT 5;
```
→ Rows vorhanden nach gesprochenem Text ✓

**Dann Frontend:**
- TranscriptFeed zeigt Segmente live (Realtime-Hook bereits verdrahtet)
- Speaker-Name farbkodiert (Hash aus identity → Farbe)
- Auto-Scroll zum neuesten

---

### Stufe 2: Multi-Participant

**Ziel:** 2+ Sprecher, korrekt getrennte `speaker_identity`

**Test:** 2 Browser-Tabs, beide joinen, beide sprechen → eigene Rows in DB

---

### Stufe 3: Session-Lifecycle sauber

**Ziel:** Session-Start → Ende → kein hängender Agent

**Checks:**
- `sessions.status = 'ended'` nach POST `/api/sessions/{id}/end`
- `agent_jobs.status = 'ended'`
- `session_participants.left_at` gesetzt bei Disconnect
- Agent macht `on_session_end()` auf allen Modulen

---

### Stufe 4: Embeddings (Background)

**Ziel:** `embedding IS NOT NULL` für alle finalen Segmente

**Implementierung** (bereits in Abschnitt 18 spezifiziert):
```python
asyncio.create_task(self._generate_embedding(segment_id, text))
# text-embedding-3-small → vector(1536) → UPDATE transcript_segments
```

---

### Stufe 5: Partizipations-Metriken ← NÄCHSTE GROSSE PHASE

**Ziel:** `metric_snapshots` mit echten Partizipations-Daten alle 30s

**Datenbasis:** Alle `transcript_segments` der Session im 300s-Fenster

**Formeln:** → Abschnitt 7 (vollständige Spezifikation)

**Output nach Supabase:**
```json
{
  "participation": {
    "volume_share": {"alice": 0.45, "bob": 0.35, "carol": 0.20},
    "turn_share": {"alice": 0.40, "bob": 0.38, "carol": 0.22},
    "gini_imbalance": 0.23,
    "silent_participant_ratio": 0.0,
    "dominance_streak_score": 0.18,
    "turn_share_gini": 0.19,
    "participation_risk_score": 0.21
  }
}
```

→ Frontend MetricsPanel zeigt Balken-Charts

---

### Stufe 6: Semantische Metriken

**Ziel:** Semantik-Teil von `metric_snapshots` befüllt

**Voraussetzung:** Embeddings aus Stufe 4 vorhanden

**Formeln:** → Abschnitt 8 (vollständige Spezifikation)

**Output:**
```json
{
  "semantic_dynamics": {
    "novelty_rate": 0.34,
    "cluster_concentration": 0.42,
    "exploration_elaboration_ratio": 0.61,
    "semantic_expansion_score": 0.15
  }
}
```

---

### Stufe 7: State Inference

**Ziel:** `engine_state.current_state` wird gesetzt, alle 5s aktualisiert

**Input:** MetricSnapshot (Stufe 5+6)
**Output:** Einer von 5 Zuständen + Konfidenz-Score
**Formeln:** → Abschnitt 9

---

### Stufe 8: Decision Engine

**Ziel:** Engine wechselt durch 4 Phasen, `interventions`-Tabelle wird befüllt (ohne Audio)

**Phasen:** MONITORING → CONFIRMING (45s) → POST_CHECK (180s) → COOLDOWN (180s)
**Spezifikation:** → Abschnitt 10

---

### Stufe 9: TTS + Audio-Injection

**Ziel:** Moderator-Text wird als Sprachausgabe im LiveKit Room für alle hörbar

**Pipeline:**
```
gpt-4o text → tts-1-hd PCM → rtc.AudioSource → LocalAudioTrack → Room publish
```
**Spezifikation:** → Abschnitt 11

---

### Stufe 10: LLM-Features (parallel entwickelbar nach Stufe 4)

| Feature | Modul | Intervall | LLM |
|---------|-------|-----------|-----|
| Ideen-Extraktion | `idea_extraction.py` | 4s (on_segment) | gpt-4o |
| Ideen-Verbindungen | `idea_extraction.py` | periodisch | gpt-4o-mini |
| Live Summary | `live_summary.py` | 60s | gpt-4o-mini |
| Goal Tracking Heat | `goal_tracker.py` | 5s (embedding) | — |
| Goal Assessment | `goal_tracker.py` | 90s | gpt-4o-mini |
| Regel-Prüfung | `rule_check.py` | on_segment | gpt-4o-mini |

---

### Stufe 11: Railway Deployment

**Checklist:**
- `Procfile` korrekt: `api: uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- `agent: python -m agent.main dev` (mit --url + --api-key Flags für Railway)
- Alle ENV-Variablen im Railway Dashboard gesetzt
- Redis: interne Railway URL (`redis://redis.railway.internal:6379`)
- ALLOWED_ORIGINS: auf Vercel-Domain setzen
- Health-Check: `GET /health → 200`
- LiveKit Webhook-URL: auf Railway API-URL setzen

---

### Stufe 12: SaaS-Layer (Phase 3)

- Clerk Auth: Organization = Workspace, User = Member
- Stripe: Subscription-Pläne (Trial/Starter/Professional/Academic)
- RLS in Supabase aktivieren
- Usage-Tracking: `usage_events` mit Kosten pro Session
- CORS einschränken

---

## 7. Partizipations-Metriken — Vollständige Spezifikation

**Datenbasis:** Alle `transcript_segments` der letzten `WINDOW_SECONDS` (300s) der Session.

### 7.1 Hilfsfunktionen

```python
def gini_coefficient(values: list[float]) -> float:
    """Misst Ungleichheit. 0 = perfekt gleich, 1 = alles bei einer Person."""
    if not values or len(values) == 1:
        return 0.0
    arr = sorted(values)
    n = len(arr)
    total = sum(arr)
    if total == 0:
        return 0.0
    cumulative = sum((i + 1) * v for i, v in enumerate(arr))
    return (2 * cumulative) / (n * total) - (n + 1) / n

def count_words(text: str) -> int:
    """Wörter zählen. Deutsch/Englisch kompatibel."""
    return len(text.strip().split())
```

### 7.2 Volume Share (Wort-Anteil pro Sprecher)

```python
def compute_volume_share(segments: list[dict]) -> dict[str, float]:
    """
    Anteil der gesprochenen Wörter pro Sprecher im Zeitfenster.
    segments: Liste von transcript_segments mit speaker_identity + text
    """
    word_counts: dict[str, int] = {}
    for seg in segments:
        identity = seg["speaker_identity"]
        word_counts[identity] = word_counts.get(identity, 0) + count_words(seg["text"])
    
    total = sum(word_counts.values())
    if total == 0:
        return {}
    return {k: v / total for k, v in word_counts.items()}
```

### 7.3 Turn Share (Segment-Anteil pro Sprecher)

```python
def compute_turn_share(segments: list[dict]) -> dict[str, float]:
    """
    Anteil der Gesprächsrunden (finaler Segmente) pro Sprecher.
    """
    final_segments = [s for s in segments if s.get("is_final", True)]
    turn_counts: dict[str, int] = {}
    for seg in final_segments:
        identity = seg["speaker_identity"]
        turn_counts[identity] = turn_counts.get(identity, 0) + 1
    
    total = sum(turn_counts.values())
    if total == 0:
        return {}
    return {k: v / total for k, v in turn_counts.items()}
```

### 7.4 Silent Participant Ratio

```python
THRESHOLD_SILENT = 0.10  # Sprecher mit < 10% Wort-Anteil gilt als "still"

def compute_silent_participant_ratio(
    volume_share: dict[str, float],
    all_participant_identities: list[str]
) -> float:
    """
    Anteil der Teilnehmer die weniger als 10% gesprochen haben.
    Zählt auch Teilnehmer die gar nicht im volume_share sind (= 0%).
    """
    n = len(all_participant_identities)
    if n == 0:
        return 0.0
    
    silent_count = 0
    for identity in all_participant_identities:
        share = volume_share.get(identity, 0.0)
        if share < THRESHOLD_SILENT:
            silent_count += 1
    
    return silent_count / n
```

### 7.5 Dominance Streak Score

```python
def compute_dominance_streak_score(segments: list[dict]) -> float:
    """
    Längste ununterbrochene Reihe desselben Sprechers, normalisiert auf [0, 1].
    0 = perfekter Wechsel, 1 = eine Person redet immer.
    """
    if not segments:
        return 0.0
    
    final_segs = [s for s in segments if s.get("is_final", True)]
    if len(final_segs) < 2:
        return 0.0
    
    max_streak = 1
    current_streak = 1
    
    for i in range(1, len(final_segs)):
        if final_segs[i]["speaker_identity"] == final_segs[i-1]["speaker_identity"]:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 1
    
    # Normalisieren: max möglicher Streak = alle Segmente
    return (max_streak - 1) / max(len(final_segs) - 1, 1)
```

### 7.6 Participation Risk Score (Composite)

```python
WEIGHTS = {
    "gini": 0.35,
    "silent": 0.25,
    "dominance": 0.25,
    "turn_gini": 0.15
}

def compute_participation_risk_score(
    gini_imbalance: float,
    silent_participant_ratio: float,
    dominance_streak_score: float,
    turn_share_gini: float
) -> float:
    """
    Gewichteter Composite-Score. 0 = gesund, 1 = hohes Risiko.
    Gewichtung: 35% Gini, 25% Silent, 25% Dominanz, 15% Turn-Gini
    """
    return (
        WEIGHTS["gini"] * gini_imbalance
        + WEIGHTS["silent"] * silent_participant_ratio
        + WEIGHTS["dominance"] * dominance_streak_score
        + WEIGHTS["turn_gini"] * turn_share_gini
    )
```

### 7.7 Vollständige compute_participation()

```python
def compute_participation_metrics(
    segments: list[dict],
    all_participant_identities: list[str]
) -> dict:
    """
    Hauptfunktion: Berechnet alle Partizipations-Metriken.
    Gibt dict zurück das als JSONB in metric_snapshots.participation gespeichert wird.
    """
    volume_share = compute_volume_share(segments)
    turn_share = compute_turn_share(segments)
    
    volume_values = list(volume_share.values()) or [0.0]
    turn_values = list(turn_share.values()) or [0.0]
    
    gini_imbalance = gini_coefficient(volume_values)
    turn_share_gini = gini_coefficient(turn_values)
    silent_ratio = compute_silent_participant_ratio(volume_share, all_participant_identities)
    dominance_streak = compute_dominance_streak_score(segments)
    risk_score = compute_participation_risk_score(
        gini_imbalance, silent_ratio, dominance_streak, turn_share_gini
    )
    
    return {
        "volume_share": volume_share,
        "turn_share": turn_share,
        "gini_imbalance": round(gini_imbalance, 4),
        "silent_participant_ratio": round(silent_ratio, 4),
        "dominance_streak_score": round(dominance_streak, 4),
        "turn_share_gini": round(turn_share_gini, 4),
        "participation_risk_score": round(risk_score, 4),
    }
```

---

## 8. Semantische Dynamik-Metriken — Vollständige Spezifikation

**Voraussetzung:** Embeddings (vector(1536)) vorhanden für alle Segmente.

### 8.1 Kosinus-Ähnlichkeit

```python
import numpy as np

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Kosinus-Ähnlichkeit zwischen zwei Embedding-Vektoren. Range: -1 bis 1."""
    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))
```

### 8.2 Novelty Rate

```python
NOVELTY_COSINE_THRESHOLD = 0.45  # Unter diesem Wert = "neue" Idee

def compute_novelty_rate(
    segments_with_embeddings: list[dict],
    window_size: int = 300
) -> float:
    """
    Anteil der Segmente die semantisch neu sind (nicht ähnlich zu vorherigen).
    Vergleicht jedes Segment mit allen vorherigen im Fenster.
    
    segments_with_embeddings: list von dicts mit "embedding" und "created_at"
    Nur Segmente mit embedding IS NOT NULL berücksichtigen.
    """
    eligible = [s for s in segments_with_embeddings if s.get("embedding")]
    if len(eligible) < 2:
        return 0.5  # Neutral wenn zu wenig Daten
    
    novel_count = 0
    for i, seg in enumerate(eligible):
        preceding = eligible[max(0, i - 10):i]  # Max 10 Vorgänger
        if not preceding:
            novel_count += 1  # Erstes Segment ist immer neu
            continue
        
        max_similarity = max(
            cosine_similarity(seg["embedding"], prev["embedding"])
            for prev in preceding
        )
        if max_similarity < NOVELTY_COSINE_THRESHOLD:
            novel_count += 1
    
    return novel_count / len(eligible)
```

### 8.3 Cluster-Bildung (Greedy Centroid Clustering)

```python
CLUSTER_MERGE_THRESHOLD = 0.35  # Unter diesem Wert = anderes Cluster

def compute_clusters(segments_with_embeddings: list[dict]) -> list[list[dict]]:
    """
    Greedy Centroid Clustering: Segment wird dem nächsten Cluster zugeordnet
    wenn Ähnlichkeit > CLUSTER_MERGE_THRESHOLD, sonst neues Cluster.
    Gibt Liste von Clusters zurück (jedes Cluster = Liste von Segmenten).
    """
    eligible = [s for s in segments_with_embeddings if s.get("embedding")]
    if not eligible:
        return []
    
    clusters: list[list[dict]] = []
    centroids: list[list[float]] = []
    
    for seg in eligible:
        emb = seg["embedding"]
        
        if not centroids:
            clusters.append([seg])
            centroids.append(emb)
            continue
        
        similarities = [cosine_similarity(emb, c) for c in centroids]
        best_idx = int(np.argmax(similarities))
        
        if similarities[best_idx] >= CLUSTER_MERGE_THRESHOLD:
            clusters[best_idx].append(seg)
            # Centroid aktualisieren (laufendes Mittel)
            n = len(clusters[best_idx])
            centroids[best_idx] = [
                (c * (n-1) + e) / n
                for c, e in zip(centroids[best_idx], emb)
            ]
        else:
            clusters.append([seg])
            centroids.append(emb)
    
    return clusters
```

### 8.4 Cluster Concentration (HHI)

```python
def compute_cluster_concentration(clusters: list[list]) -> float:
    """
    Herfindahl-Hirschman Index über Cluster-Größen.
    0 = viele gleichgroße Cluster (diverse Diskussion)
    1 = alles in einem Cluster (monotone Diskussion)
    """
    if not clusters:
        return 0.0
    
    total = sum(len(c) for c in clusters)
    if total == 0:
        return 0.0
    
    shares = [len(c) / total for c in clusters]
    return sum(s * s for s in shares)
```

### 8.5 Exploration/Elaboration Ratio

```python
EXPLORATION_COSINE_THRESHOLD = 0.30  # Unter diesem = Exploration (neue Richtung)
ELABORATION_COSINE_THRESHOLD = 0.50  # Über diesem = Elaboration (Vertiefung)

def compute_exploration_elaboration_ratio(
    segments_with_embeddings: list[dict]
) -> float:
    """
    0 = nur Vertiefung bestehender Ideen
    1 = nur neue Richtungen erkundet
    0.5 = ausgewogen
    """
    eligible = [s for s in segments_with_embeddings if s.get("embedding")]
    if len(eligible) < 3:
        return 0.5
    
    exploration_count = 0
    elaboration_count = 0
    
    for i in range(1, len(eligible)):
        preceding = eligible[max(0, i-5):i]
        avg_similarity = np.mean([
            cosine_similarity(eligible[i]["embedding"], p["embedding"])
            for p in preceding
        ])
        
        if avg_similarity < EXPLORATION_COSINE_THRESHOLD:
            exploration_count += 1
        elif avg_similarity > ELABORATION_COSINE_THRESHOLD:
            elaboration_count += 1
    
    total = exploration_count + elaboration_count
    if total == 0:
        return 0.5
    return exploration_count / total
```

### 8.6 Semantic Expansion Score

```python
def compute_semantic_expansion_score(
    clusters_now: list[list],
    clusters_prev: list[list],
    novelty_now: float,
    novelty_prev: float
) -> float:
    """
    Trend-Änderung: Wächst die Diskussion (positiv) oder verengt sie sich (negativ)?
    Range: -1 bis 1
    
    Positiv: mehr Cluster, höhere Novelty → Expansion
    Negativ: weniger Cluster, niedrigere Novelty → Konvergenz
    """
    concentration_now = compute_cluster_concentration(clusters_now)
    concentration_prev = compute_cluster_concentration(clusters_prev)
    
    concentration_delta = concentration_prev - concentration_now  # Positiv wenn weniger konzentriert
    novelty_delta = novelty_now - novelty_prev
    
    raw = 0.5 * concentration_delta + 0.5 * novelty_delta
    return float(np.clip(raw * 2, -1.0, 1.0))  # Auf [-1, 1] skalieren
```

### 8.7 Fallback ohne Embeddings (Jaccard)

```python
def jaccard_similarity(text_a: str, text_b: str) -> float:
    """Wort-basierte Jaccard-Ähnlichkeit als Fallback wenn keine Embeddings."""
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a and not words_b:
        return 1.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)

JACCARD_NOVELTY_THRESHOLD = 0.40  # Fallback-Schwelle
```

### 8.8 Vollständige compute_semantic_dynamics()

```python
def compute_semantic_dynamics_metrics(
    segments_with_embeddings: list[dict],
    previous_snapshot: dict | None = None
) -> dict:
    """
    Hauptfunktion: Berechnet alle semantischen Metriken.
    Gibt dict zurück für metric_snapshots.semantic_dynamics JSONB.
    """
    # Versuche mit Embeddings, sonst Jaccard-Fallback
    has_embeddings = any(s.get("embedding") for s in segments_with_embeddings)
    
    if has_embeddings:
        novelty_rate = compute_novelty_rate(segments_with_embeddings)
        clusters = compute_clusters(segments_with_embeddings)
        cluster_concentration = compute_cluster_concentration(clusters)
        exploration_ratio = compute_exploration_elaboration_ratio(segments_with_embeddings)
    else:
        # Jaccard-Fallback
        novelty_rate = _jaccard_novelty_rate(segments_with_embeddings)
        clusters = []
        cluster_concentration = 0.5
        exploration_ratio = 0.5
    
    # Expansion Score braucht vorherigen Snapshot
    if previous_snapshot and "semantic_dynamics" in previous_snapshot:
        prev = previous_snapshot["semantic_dynamics"]
        novelty_prev = prev.get("novelty_rate", novelty_rate)
        # Vereinfacht: wenn vorherige Cluster-Konzentration vorhanden
        prev_concentration = prev.get("cluster_concentration", cluster_concentration)
        concentration_delta = prev_concentration - cluster_concentration
        novelty_delta = novelty_rate - novelty_prev
        raw = 0.5 * concentration_delta + 0.5 * novelty_delta
        expansion_score = float(np.clip(raw * 2, -1.0, 1.0))
    else:
        expansion_score = 0.0
    
    return {
        "novelty_rate": round(novelty_rate, 4),
        "cluster_concentration": round(cluster_concentration, 4),
        "exploration_elaboration_ratio": round(exploration_ratio, 4),
        "semantic_expansion_score": round(expansion_score, 4),
        "cluster_count": len(clusters),
        "has_embeddings": has_embeddings,
    }
```

---

## 9. State Inference — Vollständige Spezifikation

**5 Gesprächszustände** mit Hysterese und Tiebreaker-Logik.

### 9.1 Konfidenz-Berechnungen

```python
from dataclasses import dataclass

HYSTERESIS_MARGIN = 0.08  # Neuer Zustand braucht >= 0.08 mehr Konfidenz
TIEBREAK_MARGIN = 0.03    # Risiko-Zustände gewinnen innerhalb dieser Marge
MIN_CONFIDENCE = 0.45     # Mindest-Konfidenz für Intervention

@dataclass
class StateConfidences:
    healthy_exploration: float
    healthy_elaboration: float
    dominance_risk: float
    convergence_risk: float
    stalled_discussion: float


def compute_state_confidences(metrics: dict) -> StateConfidences:
    """
    Berechnet Konfidenz-Score (0-1) für jeden der 5 Zustände.
    metrics: Kombiniertes dict aus participation + semantic_dynamics
    """
    p = metrics.get("participation", {})
    s = metrics.get("semantic_dynamics", {})
    
    # Metriken extrahieren mit Defaults
    risk = p.get("participation_risk_score", 0.5)
    gini = p.get("gini_imbalance", 0.5)
    silent = p.get("silent_participant_ratio", 0.0)
    dominance = p.get("dominance_streak_score", 0.0)
    novelty = s.get("novelty_rate", 0.5)
    concentration = s.get("cluster_concentration", 0.5)
    exploration = s.get("exploration_elaboration_ratio", 0.5)
    expansion = s.get("semantic_expansion_score", 0.0)
    
    # Hilfsfunktionen
    def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))
    def expansion_bonus(): return clamp(expansion * 0.5 + 0.5, 0, 0.3)
    def stagnation_penalty(duration_s: float = 0): return clamp(duration_s / 300, 0, 0.4)
    
    # 1. HEALTHY_EXPLORATION: Breite Erkundung, gute Beteiligung
    healthy_exploration = (
        0.25 * (1 - risk)
        + 0.30 * novelty
        + 0.20 * clamp(expansion + 0.5)
        + 0.25 * exploration
    )
    
    # 2. HEALTHY_ELABORATION: Vertiefung ohne Beteiligungsrisiko
    if risk > 0.5:
        healthy_elaboration = 0.0  # Gate: Kein "gesund" wenn Beteiligungsrisiko hoch
    else:
        healthy_elaboration = (
            0.20 * (1 - risk)
            + 0.25 * (1 - novelty)
            + 0.25 * (1 - exploration)
            + 0.15 * (1 - concentration)
            + 0.15 * expansion_bonus()
        ) * (1 - stagnation_penalty())
    
    # 3. DOMINANCE_RISK: Ungleiche Beteiligung
    dominance_risk = (
        0.35 * risk
        + 0.25 * silent
        + 0.20 * dominance
        + 0.20 * gini
    )
    
    # 4. CONVERGENCE_RISK: Ideen verengen sich
    convergence_risk = (
        0.25 * concentration
        + 0.20 * (1 - novelty)
        + 0.20 * (1 - exploration)
        + 0.35 * clamp(-expansion)  # Negatives Expansion = Konvergenz
    )
    
    # 5. STALLED_DISCUSSION: Stagnation
    # stagnation_duration: Sekunden seit letztem neuen Segment (kommt aus agent_state)
    stagnation_s = metrics.get("stagnation_duration_seconds", 0)
    stalled_discussion = (
        0.25 * (1 - novelty)
        + 0.30 * clamp(stagnation_s / 180)  # 180s = volle Stagnation
        + 0.25 * clamp(-expansion)
        + 0.20 * (1 - clamp(expansion + 0.5))  # diversity development proxy
    )
    
    return StateConfidences(
        healthy_exploration=clamp(healthy_exploration),
        healthy_elaboration=clamp(healthy_elaboration),
        dominance_risk=clamp(dominance_risk),
        convergence_risk=clamp(convergence_risk),
        stalled_discussion=clamp(stalled_discussion),
    )
```

### 9.2 Zustand mit Hysterese wählen

```python
# Risiko-Priorität (gewinnt innerhalb TIEBREAK_MARGIN)
RISK_PRIORITY = [
    "stalled_discussion",
    "dominance_risk",
    "convergence_risk",
    "healthy_exploration",
    "healthy_elaboration",
]

def infer_conversation_state(
    metrics: dict,
    previous_state: str | None,
    previous_confidence: float = 0.0,
) -> dict:
    """
    Bestimmt den aktuellen Gesprächszustand mit Hysterese.
    
    Returns dict mit:
      state, confidence, secondary_state, secondary_confidence, criteria_snapshot
    """
    conf = compute_state_confidences(metrics)
    scores = {
        "healthy_exploration": conf.healthy_exploration,
        "healthy_elaboration": conf.healthy_elaboration,
        "dominance_risk": conf.dominance_risk,
        "convergence_risk": conf.convergence_risk,
        "stalled_discussion": conf.stalled_discussion,
    }
    
    # Höchsten Score finden
    best_state = max(scores, key=scores.get)
    best_score = scores[best_state]
    
    # Tiebreaker: Risiko-Zustände bevorzugen innerhalb TIEBREAK_MARGIN
    for risk_state in RISK_PRIORITY:
        if risk_state == best_state:
            break
        if scores[risk_state] >= best_score - TIEBREAK_MARGIN:
            best_state = risk_state
            best_score = scores[risk_state]
            break
    
    # Hysterese: Zustandswechsel nur wenn deutlich besser
    if (previous_state and
        previous_state != best_state and
        best_score < previous_confidence + HYSTERESIS_MARGIN):
        # Beim aktuellen Zustand bleiben
        best_state = previous_state
        best_score = scores[previous_state]
    
    # Sekundär-Zustand
    remaining = {k: v for k, v in scores.items() if k != best_state}
    secondary_state = max(remaining, key=remaining.get) if remaining else None
    secondary_confidence = remaining.get(secondary_state, 0.0) if secondary_state else 0.0
    
    return {
        "state": best_state,
        "confidence": round(best_score, 4),
        "secondary_state": secondary_state,
        "secondary_confidence": round(secondary_confidence, 4),
        "criteria_snapshot": {k: round(v, 4) for k, v in scores.items()},
    }
```

---

## 10. Decision Engine — Vollständige Spezifikation

### 10.1 Vier Phasen

```
MONITORING → (Risiko erkannt, Persistenz >= 70%) → CONFIRMING (45s)
CONFIRMING → (bestätigt) → POST_CHECK (180s Warten)
POST_CHECK → (erholt) → MONITORING
POST_CHECK → (nicht erholt, Szenario B) → Ally-Eskalation → COOLDOWN (180s)
POST_CHECK → (nicht erholt, Szenario A) → MONITORING
COOLDOWN → (abgelaufen) → MONITORING
```

### 10.2 Konfigurationsparameter

```python
# agent/modules/decision_engine.py — Konstanten

WINDOW_SECONDS = 300            # Analyse-Fenster
ANALYZE_EVERY_SECONDS = 5       # Metriken alle 5s berechnen
CONFIRMATION_SECONDS = 45       # Bestätigungszeit für Risiko-Zustand
POST_CHECK_SECONDS = 180        # Wartezeit nach Intervention
COOLDOWN_SECONDS = 180          # Abkühlzeit
PERSISTENCE_THRESHOLD = 0.70    # 70% der Snapshots im Bestätigungs-Fenster müssen gleichen Zustand zeigen
MAX_INTERVENTIONS_PER_10MIN = 3 # Rate-Limit (Sliding Window)
MIN_CONFIDENCE = 0.45           # Mindest-Konfidenz für Intervention
RULE_VIOLATION_COOLDOWN_S = 15  # Cooldown zwischen Regel-Interventionen
```

### 10.3 Intent-Mapping

```python
STATE_TO_INTENT = {
    "dominance_risk": "PARTICIPATION_REBALANCING",
    "convergence_risk": "PERSPECTIVE_BROADENING",
    "stalled_discussion": "REACTIVATION",
}
# Ally: "ALLY_IMPULSE" (Szenario B, nach fehlgeschlagener Erholung)
# Regel: "NORM_REINFORCEMENT"
# Ziel: "GOAL_REFOCUS"
```

### 10.4 Persistenz-Check

```python
def check_persistence(
    state_history: list[dict],  # Letzte N Snapshots mit "state" und "created_at"
    current_state: str,
    window_seconds: float = CONFIRMATION_SECONDS
) -> bool:
    """
    Sind >= 70% der Snapshots im Bestätigungs-Fenster im selben Zustand?
    """
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=window_seconds)
    recent = [s for s in state_history if s["created_at"] >= cutoff]
    
    if len(recent) < 3:  # Zu wenig Daten
        return False
    
    matching = sum(1 for s in recent if s["state"] == current_state)
    return (matching / len(recent)) >= PERSISTENCE_THRESHOLD
```

### 10.5 Erholungs-Evaluation (Recovery Check)

```python
def evaluate_recovery(
    intent: str,
    metrics_now: dict,
    metrics_at_intervention: dict,
) -> dict:
    """
    Prüft ob sich die Situation nach der Intervention erholt hat.
    Returns: {recovered: bool, score: float, details: dict}
    """
    p_now = metrics_now.get("participation", {})
    p_prev = metrics_at_intervention.get("participation", {})
    s_now = metrics_now.get("semantic_dynamics", {})
    s_prev = metrics_at_intervention.get("semantic_dynamics", {})
    
    def clamp(v, lo=0.0, hi=1.0): return max(lo, min(hi, v))
    
    if intent == "PARTICIPATION_REBALANCING":
        prev_risk = p_prev.get("participation_risk_score", 0.5)
        curr_risk = p_now.get("participation_risk_score", 0.5)
        risk_delta = (prev_risk - curr_risk) / max(prev_risk, 0.01)
        
        silent_improved = (p_prev.get("silent_participant_ratio", 0) 
                          - p_now.get("silent_participant_ratio", 0)) > 0
        turn_improved = (p_prev.get("turn_share_gini", 0.5) 
                        - p_now.get("turn_share_gini", 0.5)) > 0.05
        
        recovered = risk_delta >= 0.15 and (silent_improved or turn_improved)
        score = 0.6 * risk_delta + 0.4 * (
            (p_prev.get("silent_participant_ratio", 0) - p_now.get("silent_participant_ratio", 0))
        )
    
    elif intent == "PERSPECTIVE_BROADENING":
        novelty_delta = s_now.get("novelty_rate", 0) - s_prev.get("novelty_rate", 0)
        concentration_delta = s_prev.get("cluster_concentration", 0) - s_now.get("cluster_concentration", 0)
        
        recovered = novelty_delta >= 0.10 and concentration_delta >= 0.08
        score = 0.5 * novelty_delta + 0.5 * concentration_delta
    
    elif intent == "REACTIVATION":
        novelty_delta = s_now.get("novelty_rate", 0) - s_prev.get("novelty_rate", 0)
        expansion_now = s_now.get("semantic_expansion_score", 0)
        expansion_prev = s_prev.get("semantic_expansion_score", 0)
        expansion_delta = expansion_now - expansion_prev
        
        novelty_improved = novelty_delta >= 0.10
        expansion_improved = expansion_now > 0 or expansion_delta >= 0.20
        
        recovered = novelty_improved and expansion_improved
        score = clamp(0.5 * (novelty_delta / 0.3) + 0.5 * (expansion_delta / 0.5))
    
    elif intent == "ALLY_IMPULSE":
        improvements = sum([
            s_now.get("novelty_rate", 0) - s_prev.get("novelty_rate", 0) >= 0.05,
            p_prev.get("participation_risk_score", 0) - p_now.get("participation_risk_score", 0) >= 0.05,
        ])
        recovered = improvements >= 1
        score = improvements / 2
    
    else:
        recovered = False
        score = 0.0
    
    return {
        "recovered": recovered,
        "score": round(clamp(score), 4),
    }
```

---

## 11. Interventions-Pipeline — TTS + Audio-Injection

### 11.1 Moderator-Intervention

```python
# agent/interventions/moderator.py

async def execute_moderator_intervention(
    intent: str,
    metrics: dict,
    recent_segments: list[dict],
    room: rtc.Room,
    session: dict,
    writer,
) -> dict | None:
    """
    1. GPT-4o generiert Moderations-Text (1-2 Sätze)
    2. tts-1-hd konvertiert zu PCM Audio
    3. LiveKit AudioTrack publizieren → alle Participants hören es
    4. Intervention in Supabase speichern → Browser-Overlay via Realtime
    """
    from openai import AsyncOpenAI
    client = AsyncOpenAI()
    
    # 1. Text generieren
    system_prompt = MODERATOR_PROMPTS[session.get("language", "de-CH")]["system"]
    user_prompt = build_user_prompt(intent, metrics, recent_segments, session)
    
    completion = await client.chat.completions.create(
        model="gpt-4o-2024-11-20",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        max_tokens=150,
        temperature=0.7,
    )
    text = completion.choices[0].message.content.strip()
    
    if not text:
        return None
    
    # 2. TTS generieren (PCM16, 24kHz)
    tts_response = await client.audio.speech.create(
        model="tts-1-hd",
        voice="nova",  # Angenehme, neutrale Stimme
        input=text,
        response_format="pcm",  # PCM16 direkt
    )
    audio_bytes = tts_response.content
    
    # 3. Als LiveKit AudioTrack publishen
    duration_ms = await publish_audio_to_room(audio_bytes, room)
    
    # 4. In Supabase speichern → Realtime → Browser-Overlay
    intervention = await writer.write_intervention({
        "session_id": session["id"],
        "intent": intent,
        "trigger": "state",
        "text": text,
        "audio_duration_ms": duration_ms,
        "metrics_at_intervention": metrics,
    })
    
    logger.info(f"Intervention executed: {intent} — '{text[:60]}...'")
    return intervention


async def publish_audio_to_room(
    audio_bytes: bytes,
    room: rtc.Room,
    sample_rate: int = 24000,
    num_channels: int = 1,
) -> int:
    """
    Publiziert PCM16-Audio als LiveKit-Track.
    Alle Participants im Room hören es.
    Returns: Dauer in Millisekunden.
    """
    source = rtc.AudioSource(sample_rate=sample_rate, num_channels=num_channels)
    track = rtc.LocalAudioTrack.create_audio_track("moderator", source)
    
    options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    publication = await room.local_participant.publish_track(track, options)
    
    # Audio in 10ms Chunks senden
    CHUNK_MS = 10
    bytes_per_sample = 2  # PCM16 = 2 bytes
    samples_per_chunk = (sample_rate * CHUNK_MS) // 1000
    bytes_per_chunk = samples_per_chunk * num_channels * bytes_per_sample
    
    total_samples = len(audio_bytes) // bytes_per_sample
    duration_ms = (total_samples * 1000) // sample_rate
    
    for i in range(0, len(audio_bytes), bytes_per_chunk):
        chunk = audio_bytes[i:i + bytes_per_chunk]
        if len(chunk) < bytes_per_chunk:
            chunk = chunk + bytes(bytes_per_chunk - len(chunk))  # Padding
        
        frame = rtc.AudioFrame(
            data=chunk,
            sample_rate=sample_rate,
            num_channels=num_channels,
            samples_per_channel=samples_per_chunk,
        )
        await source.capture_frame(frame)
        await asyncio.sleep(CHUNK_MS / 1000)
    
    # Track nach Wiedergabe wieder entfernen
    await room.local_participant.unpublish_track(publication.sid)
    return duration_ms
```

---

## 12. LLM-Features

### 12.1 Ideen-Extraktion

```python
# agent/modules/idea_extraction.py
# Intervall: on_segment + alle 4s

EXTRACTION_PROMPT_DE = """
Analysiere die folgenden neuen Transkript-Segmente einer Brainstorming-Session.

BESTEHENDE IDEEN (nicht nochmals extrahieren):
{existing_titles}

NEUE SEGMENTE:
{new_segments}

Extrahiere neue, eigenständige Ideen die noch nicht in der Liste sind.
Gib NUR JSON zurück:
{
  "ideas": [
    {
      "title": "Kurzer Titel (max 5 Wörter)",
      "description": "1-2 Sätze Beschreibung",
      "author_name": "Sprecher-Name oder 'Gruppe'",
      "idea_type": "brainstorming_idea",
      "builds_on": "Titel einer bestehenden Idee oder null"
    }
  ]
}

Wenn keine neuen Ideen: {"ideas": []}
"""

# Verbindungs-Typen: builds_on | contrasts | supports | refines
```

### 12.2 Live Summary

```python
# agent/modules/live_summary.py
# Intervall: 60s

SUMMARY_PROMPT_DE = """
Erstelle eine kurze Rolling-Zusammenfassung dieser Brainstorming-Session.

VORHERIGE ZUSAMMENFASSUNG:
{previous_summary}

NEUESTE TRANSKRIPT-SEGMENTE (letzte 5 Minuten):
{recent_segments}

EXTRAHIERTE IDEEN:
{ideas}

Erstelle eine neue Zusammenfassung (max 3 Absätze):
1. Was wurde bisher diskutiert?
2. Welche Hauptideen sind entstanden?
3. Was ist die aktuelle Richtung?

Antworte nur mit dem Zusammenfassungs-Text, keine Überschriften.
"""
```

### 12.3 Goal Tracking

```python
# agent/modules/goal_tracker.py
# Embedding-Heat: 5s (deterministisch)
# LLM-Assessment: 90s

def compute_goal_heat(
    goal: dict,
    recent_embeddings: list[list[float]],
    goal_embedding: list[float],
) -> float:
    """
    Embedding-basierte Nähe der Diskussion zum Ziel.
    0 = Ziel wurde nicht berührt, 1 = Ziel im Mittelpunkt.
    """
    if not recent_embeddings or not goal_embedding:
        return 0.0
    similarities = [cosine_similarity(emb, goal_embedding) for emb in recent_embeddings]
    return max(similarities)

GOAL_ASSESSMENT_PROMPT_DE = """
Bewerte den Fortschritt dieser Brainstorming-Session für jedes definierte Ziel.

ZIELE:
{goals}

AKTUELLE ZUSAMMENFASSUNG:
{summary}

AKTUELLE TRANSKRIPT-SEGMENTE:
{segments}

Für jedes Ziel, klassifiziere als:
- "not_started": Nicht angesprochen
- "mentioned": Kurz erwähnt, nicht vertieft
- "partially_covered": Diskutiert aber nicht abgeschlossen
- "covered": Ausreichend behandelt

Gib NUR JSON zurück:
{"assessments": [{"goal_id": "...", "status": "...", "notes": "..."}]}
"""
```

---

## 13. Moderator-Prompts (vollständig)

### 13.1 System-Prompt (Deutsch)

```
Du bist ein erfahrener Brainstorming-Moderator. Deine Aufgabe ist es,
die Gruppendiskussion durch kurze, prozessbezogene Beobachtungen sanft zu lenken.

WICHTIGE REGELN:
1. Mache NUR Prozessreflexionen — trage NIEMALS eigene Ideen bei
2. Maximal 1-2 kurze Sätze
3. Sei neutral, ermutigend und konstruktiv
4. Formuliere als Fragen oder sanfte Prozess-Vorschläge
5. Fokussiere auf Gruppendynamik, nicht auf Inhalte
6. Antworten müssen für Sprachausgabe geeignet sein
7. Adressiere NIEMALS einzelne Personen direkt
```

### 13.2 User-Prompts nach Intent

| Intent | Metriken-Kontext | Anweisung |
|--------|-----------------|-----------|
| `PARTICIPATION_REBALANCING` | risk_score, silent_ratio, dominance_streak | "Sanfte Prozessreflexion um ausgewogenere Beteiligung anzuregen" |
| `PERSPECTIVE_BROADENING` | concentration, novelty_rate, exploration_ratio | "Ermutigung verschiedene Blickwinkel zu erkunden" |
| `REACTIVATION` | stagnation_seconds, novelty_rate, expansion_score | "Energetisierende Prozessreflexion bei Stagnation" |
| `GOAL_REFOCUS` | covered_goals, uncovered_goals, suggested_topics | "Sanfte Erinnerung an noch offene Diskussionsthemen" |
| `NORM_REINFORCEMENT` | rule, evidence, severity | "Normen-Verstärkung ohne Beschuldigung" |

### 13.3 Ally-System-Prompt (Deutsch)

```
Du bist ein kreativer Verbündeter in einer Brainstorming-Sitzung.
Deine Aufgabe: frische Energie und neue Perspektiven einbringen wenn die Gruppe feststeckt.

WICHTIGE REGELN:
1. Gib EINEN kurzen, kreativen Impuls oder unerwarteten Blickwinkel
2. Maximal 1-2 Sätze
3. Gib KEINE fertigen Lösungen vor — rege zum Nachdenken an
4. Sei spielerisch und energetisierend
5. Verwende Sprache die Neugier weckt und Perspektivwechsel erzwingt
6. Antworten müssen für Sprachausgabe geeignet sein
7. Wiederhole KEINE Themen aus vorherigen Interventionen
```

---

## 14. Modul-Timing und Orchestrierung

### 14.1 Tick-Intervalle

```python
# agent/session_agent.py — tick_loop()

TICK_INTERVALS = {
    "1s":  1.0,   # Decision Engine: Phase-Evaluation
    "4s":  4.0,   # Idea Extraction: neue Segmente verarbeiten
    "5s":  5.0,   # Participation + Semantic + State + Goal Heat
    "30s": 30.0,  # Metric Snapshot persistieren
    "60s": 60.0,  # Live Summary
    "90s": 90.0,  # Goal LLM Assessment
}

# Stagger-Offsets (verhindern gleichzeitige DB-Hits)
STAGGER = {
    "participation": 0.5,    # +500ms nach 5s-Tick
    "decision_engine": 1.5,  # +1500ms nach 1s-Tick
    "idea_extraction": 2.5,  # +2500ms nach 4s-Tick
}
```

### 14.2 Modul-Zuständigkeiten

| Modul | on_segment | on_tick | Schreibt nach |
|-------|-----------|---------|---------------|
| `participation.py` | Segment-Count | `5s` | `metric_snapshots.participation` |
| `semantic.py` | Embedding laden | `5s` | `metric_snapshots.semantic_dynamics` |
| `state_inference.py` | — | `5s` | `engine_state.current_state` |
| `decision_engine.py` | — | `1s` | `interventions` |
| `idea_extraction.py` | Queue | `4s` | `ideas`, `idea_connections` |
| `live_summary.py` | — | `60s` | `session_summary` |
| `goal_tracker.py` | — | `5s` (heat) + `90s` (LLM) | `session_goals` |
| `rule_check.py` | LLM-Check | — | `interventions` |

---

## 15. Frontend — Panels und Datenbindung

### 15.1 TranscriptFeed

```typescript
// Datenbasis: useRealtimeSegments() → TranscriptSegment[]
// Display:
// - Speaker-Name farbkodiert (hashCode(identity) → Farbe aus Palette)
// - Timestamp: formatDistanceToNow(created_at)
// - Auto-Scroll: useEffect → ref.current?.scrollIntoView()
// - Leerzustand: "Warte auf erste Wortmeldung..."
```

### 15.2 MetricsPanel

```typescript
// Datenbasis: useRealtimeMetrics() → MetricSnapshot[]
// Neuester Snapshot anzeigen:

// TAB 1 — Beteiligung:
//   BarChart: volume_share (Wörter pro Sprecher)
//   Badge: participation_risk_score (grün/gelb/orange/rot)
//   Kennzahlen: gini_imbalance, silent_participant_ratio

// TAB 2 — Dynamik:
//   Badge: inferred_state (farbkodiert nach Zustand)
//   LineChart: novelty_rate über Zeit (letzte 10 Snapshots)
//   Gauge: cluster_concentration (0-1)
//   Badge: exploration_elaboration_ratio

// Leerzustand: "Metriken erscheinen nach den ersten 2 Minuten..."
```

### 15.3 InterventionOverlay

```typescript
// Datenbasis: useRealtimeInterventions()
// Toast-Overlay:
//   - Erscheint wenn neue Intervention via Realtime ankommt
//   - 8s anzeigen, dann fade-out
//   - Intent-basiertes Styling:
//     PARTICIPATION_REBALANCING → blau
//     PERSPECTIVE_BROADENING → violett
//     REACTIVATION → orange
//     ALLY_IMPULSE → grün
//     NORM_REINFORCEMENT → gelb
//   - Großer Text, gut lesbar während Gespräch
```

### 15.4 IdeaBoard

```typescript
// Datenbasis: useRealtimeIdeas() + useRealtimeConnections()
// @xyflow/react Knoten-Graph:
//   - Sticky-Note-artige Knoten
//   - Farb-Kodierung nach idea_type
//   - Gerichtete Kanten (builds_on/contrasts/supports/refines)
//   - Drag-and-Drop → PATCH /api/ideas (position_x/y)
//   - Auto-Layout-Button (@dagrejs/dagre)
```

### 15.5 GoalsPanel

```typescript
// Datenbasis: useRealtimeGoals() → SessionGoal[]
// Pro Ziel:
//   - Status-Punkt: rot (not_started) / gelb (mentioned) / blau (partially_covered) / grün (covered)
//   - Heat-Balken: heat_score 0-1
//   - LLM-Notizen: notes
// Gesamt-Fortschrittsbalken oben
```

---

## 16. API-Contracts

### 16.1 Sessions

```
POST /api/sessions
Body:  { title, moderator_enabled, ally_enabled, language, workspace_id? }
Response: { id, title, join_code, livekit_room, status, moderator_enabled, ally_enabled, language, created_at }

GET /api/sessions
Response: { sessions: [...] }

GET /api/sessions/{id}
Response: { session, participants, modules }

PATCH /api/sessions/{id}
Body: { status: "ended" }

POST /api/sessions/join
Body: { code, display_name }
Response: { session, participant, livekit_token }

POST /api/livekit/token
Body: { session_id, identity, display_name }
Response: { token, room, url }

POST /api/webhooks/livekit
Body: LiveKit webhook payload
```

### 16.2 Ideas (vom Frontend)

```
POST /api/ideas
Body: { session_id, title, description, author_name, idea_type }

PATCH /api/ideas/{id}
Body: { position_x?, position_y?, color?, is_deleted? }

GET /api/ideas?session_id=...
Response: { ideas: [...] }

GET /api/ideas/connections?session_id=...
Response: { connections: [...] }
```

---

## 17. Umgebungsvariablen

### Backend (.env)

```env
# OpenAI
OPENAI_API_KEY=sk-...

# LiveKit
LIVEKIT_URL=wss://xxx.livekit.cloud
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=xxx

# Supabase (Service Role — nie im Frontend!)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (Railway internal)
REDIS_URL=redis://redis.railway.internal:6379

# API
PORT=8000
ALLOWED_ORIGINS=*  # → https://deine-app.vercel.app beim Launch

# Railway internal
RAILWAY_ENVIRONMENT=production
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000  # → Railway URL beim Deploy
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # NICHT service_role!
NEXT_PUBLIC_LIVEKIT_URL=wss://xxx.livekit.cloud
```

---

## 18. Pricing-Modell (Phase 3)

| Plan | Preis | Sessions/Monat | Participants | Features |
|------|-------|---------------|-------------|---------|
| Trial | Kostenlos | 5 | 8 | Alle Features, 90 Min. |
| Starter | $49/Mo | 15 | 8 | Alle Features |
| Professional | $199/Mo | 75 | 15 | Alle Features + Analytics |
| Academic | $99/Mo | 75 | 15 | Alle Features (Verifikation nötig) |
| Enterprise | Ab $800/Mo | Custom | Custom | On-Premise Option |

Credit-Packs: 10/$29, 50/$119, 200/$399 (1 Session = bis 8 Participants, 90 Min.)

---

## 19. Implementierungs-Prompts (Aktuell, März 2026)

### 19.1 Prompt: Backend — Transkription fertigstellen (JETZT)

```
Lies CLAUDE.md. Aktueller Stand und sofortige Aufgaben:

STATUS: FastAPI läuft. Agent-Grundstruktur vorhanden. Transkription wurde
auf Raw WebSocket umgebaut — muss zurück auf offizielle SDK.

FIXES (in dieser Reihenfolge):

FIX 1 — realtime_client.py: Zurück auf SDK
  async with client.beta.realtime.connect(model="gpt-4o-transcribe") as conn:
      await conn.session.update(session={
          "input_audio_format": "pcm16",
          "input_audio_transcription": {"model": "gpt-4o-transcribe", "language": "de"},
          "turn_detection": {"type": "server_vad", "threshold": 0.5, "silence_duration_ms": 600, "prefix_padding_ms": 300},
          "input_audio_noise_reduction": {"type": "near_field"}
      })
      await asyncio.gather(stream_audio(), receive_transcripts(), return_exceptions=True)
  
  Falls "gpt-4o-transcribe" nicht verfügbar: "gpt-4o-realtime-preview" als Fallback.
  Retry-Loop: MAX_RETRIES=3, backoff 1s/2s/4s.
  Audio: rtc.AudioStream(track, sample_rate=24000, num_channels=1)
  Segment-Filter: len(text.strip()) < 2 → ignorieren

FIX 2 — session_agent.py: Lifecycle
  pip show livekit-agents → Version prüfen
  ctx.wait_for_shutdown() korrekt verwenden
  on_participant_connected: asyncio.create_task(open_transcription(...))

FIX 3 — api/routers/livekit.py: Token-Endpoint
  Body: { session_id, identity, display_name }
  Backend holt livekit_room selbst aus DB anhand session_id
  NICHT room als Parameter akzeptieren

FIX 4 — shared/config.py + api/main.py:
  allowed_origins: list[str] = ["*"]  → via ENV ALLOWED_ORIGINS

DANACH VERIFIZIEREN:
  python -m agent.main starten
  Session via API erstellen
  2 Browser-Tabs joinen
  Sprechen → Logs zeigen "[alice]: ..."?
  SELECT text, speaker_name FROM transcript_segments ORDER BY created_at DESC LIMIT 5;
  Frontend TranscriptFeed zeigt Segmente live?

NÄCHSTE STUFE NACH VERIFIKATION: Stufe 4 (Embeddings als Background-Task)
```

---

### 19.2 Prompt: Backend — Metriken-Engine (NACH Transkription)

```
Lies CLAUDE.md. Transkription läuft und Segmente sind in Supabase.
Jetzt: Partizipations- und Semantik-Metriken.

ZIEL: metric_snapshots enthält alle 30s echte Daten.

STUFE 5 — participation.py implementieren:
Alle Formeln exakt aus Abschnitt 7 der Anforderungen portieren:
  - gini_coefficient(values)
  - compute_volume_share(segments)
  - compute_turn_share(segments)
  - compute_silent_participant_ratio(volume_share, all_identities)
  - compute_dominance_streak_score(segments)
  - compute_participation_risk_score(gini, silent, dominance, turn_gini)
  - compute_participation_metrics(segments, all_participant_identities)

Datenbasis: Letzte 300s Segmente aus agent_state.segments
Alle aktiven Participant-Identities aus session_participants WHERE left_at IS NULL

on_tick("5s"):
  segments_window = [s for s in state.segments if s["created_at"] > now - 300s]
  participants = await writer.get_active_participants(session_id)
  metrics = compute_participation_metrics(segments_window, [p["livekit_identity"] for p in participants])
  state.latest_participation = metrics

on_tick("30s"):
  await writer.write_metric_snapshot(session_id, state.latest_participation, state.latest_semantic)

VERIFIKATION:
SELECT participation->>'participation_risk_score' as risk,
       participation->>'gini_imbalance' as gini
FROM metric_snapshots ORDER BY created_at DESC LIMIT 3;

STUFE 6 — semantic.py implementieren:
Voraussetzung: Embeddings vorhanden (Stufe 4)
Alle Formeln aus Abschnitt 8 portieren (numpy verwenden):
  - cosine_similarity(a, b)
  - compute_novelty_rate(segments_with_embeddings)
  - compute_clusters(segments_with_embeddings)
  - compute_cluster_concentration(clusters)
  - compute_exploration_elaboration_ratio(segments_with_embeddings)
  - compute_semantic_dynamics_metrics(segments_with_embeddings, previous_snapshot)

STUFE 7 — state_inference.py implementieren:
Formeln exakt aus Abschnitt 9 portieren:
  - compute_state_confidences(metrics)
  - infer_conversation_state(metrics, previous_state, previous_confidence)
Ergebnis → engine_state.current_state updaten via writer

ARCHITEKTUR-REGELN:
- Alle Schreiboperationen nur via supabase_writer.py
- Numpy für Vektor-Operationen (bereits in requirements.txt?)
- Fehler in Modulen loggen aber nicht re-raisen (try/except)
- Embedding-Generierung immer asyncio.create_task, nie await
```

---

### 19.3 Prompt: Backend — Decision Engine + Interventionen

```
Lies CLAUDE.md. Metriken laufen, State Inference läuft.
Jetzt: Decision Engine und erste echte Interventionen.

STUFE 8 — decision_engine.py:
Formeln exakt aus Abschnitt 10:
  - check_persistence(state_history, current_state, window_seconds=45)
  - evaluate_recovery(intent, metrics_now, metrics_at_intervention)
  - STATE_TO_INTENT Mapping
  - 4-Phasen-Maschine: MONITORING → CONFIRMING → POST_CHECK → COOLDOWN
  - Rate-Limiting: MAX 3 Interventionen pro 10min (Sliding Window)
  - Szenario-Check: session.moderator_enabled für Moderator, ally_enabled für Ally

on_tick("1s"):
  state = infer current state from latest metrics
  evaluate phase machine
  if shouldIntervene and within rate limit:
    asyncio.create_task(execute_moderator_intervention(...))

Erst ohne TTS testen:
  - interventions Tabelle wird befüllt
  - Browser zeigt Overlay (via Realtime)
  - Dann TTS hinzufügen

STUFE 9 — TTS + Audio:
Exakt nach Abschnitt 11:
  execute_moderator_intervention() → GPT-4o text → tts-1-hd PCM → publish_audio_to_room()
  publish_audio_to_room(): AudioSource → LocalAudioTrack → 10ms Chunks

VERIFIKATION:
  Session starten, 1 Person dominiert ~60s
  → interventions Tabelle: neue Row?
  → Browser: Overlay erscheint?
  → Audio: Alle Participants hören Moderation?
```

---

### 19.4 Prompt: Frontend — Panels polieren (parallel möglich nach Stufe 5)

```
Lies CLAUDE.md. Backend schreibt Metriken und Interventionen.
Frontend-Panels verdrahten und polieren.

PRIORITÄT 1 — TranscriptFeed (bereits wartet):
  Speaker-Name farbkodiert: hashStringToColor(identity) → Array von 6 Farben
  Timestamp: "vor 2 min" (date-fns formatDistanceToNow)
  Auto-Scroll: useRef + scrollIntoView({behavior: "smooth"})
  Leerzustand mit Pulse-Animation: "Warte auf erste Wortmeldung..."

PRIORITÄT 2 — MetricsPanel mit echten Daten:
  Neuesten metric_snapshot aus useRealtimeMetrics()[0]
  Tab 1 — Beteiligung:
    BarChart (recharts): {speaker: name, wörter: count} Array aus volume_share
    Badge participation_risk_score: <0.3 grün / <0.5 gelb / <0.7 orange / >0.7 rot
  Tab 2 — Dynamik:
    Badge inferred_state: HEALTHY_EXPLORATION=grün, DOMINANCE_RISK=orange, etc.
    Gauge cluster_concentration (0-1 als halbkreis)
    LineChart: novelty_rate letzte 10 Snapshots
  Leerzustand: "Metriken erscheinen nach den ersten 2 Minuten..."

PRIORITÄT 3 — InterventionOverlay polieren:
  Toast-Overlay unten-mitte (fixed positioning)
  Intent-Icon + Text + fade-out nach 8s
  Styling nach intent (siehe Abschnitt 15.3)

PRIORITÄT 4 — Dashboard verbessern:
  Sessions gruppieren: active (grüner Pulse) / scheduled / ended
  Join-Code prominent: Copy-Button
  "Aktiv seit X Minuten" für aktive Sessions

ARCHITEKTUR-REGELN:
  Browser schreibt NIE direkt in Supabase
  Token via URL-Parameter weitergeben (kein sessionStorage)
  Alle API-Calls über lib/api-client.ts
```

---

*Dieses Dokument ist die einzige Quelle der Wahrheit. Stand März 2026, v3.0.*
*Beide CLAUDE.md-Dateien in den Repos referenzieren dieses Dokument und den jeweiligen Prompt aus Abschnitt 19.*