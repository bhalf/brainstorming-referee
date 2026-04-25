# Brainstorming Platform — Frontend

Web-Frontend für die im Rahmen einer Bachelorarbeit (UZH) entwickelte Plattform zur **KI-gestützten Moderation von Brainstorming-Sessions**. Teilnehmende treffen sich in einem Video-Call, der Live-Transkripte, Beteiligungs- und Konvergenz-Metriken berechnet und über eine Decision Engine kontextbasierte Moderator- bzw. Ally-Interventionen einspielt.

> Dieses Repository enthält **nur das Frontend**. Der KI-Agent, die FastAPI-Endpunkte und die Decision Engine liegen im separaten Repository [`brainstorming-backend`](https://github.com/bhalf/brainstorming-backend).

---

## Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Echtzeit-Sync | Supabase Realtime (Postgres) |
| Video / Audio | LiveKit Cloud (`@livekit/components-react`) |
| Charts | Recharts, `@xyflow/react` (Idea-Cluster-Graph) |
| LLM (nur für Interview-Analyse-Tool) | OpenAI SDK |
| Tests | Vitest |

---

## Architektur in einem Satz

Frontend ↔ **Supabase** (Realtime + Auth) ↔ **FastAPI-Backend** ↔ **LiveKit-Agent** (Whisper-Transkription, Decision Engine, LLM-Interventionen).

Konkret:
- Sessions, Workspaces, Ideen, Interventionen werden ausschliesslich über das FastAPI-Backend (`NEXT_PUBLIC_API_URL`) verändert (siehe [`lib/api-client.ts`](lib/api-client.ts)).
- Live-Updates (neue Transkript-Segmente, Metriken, Ideen, Interventionen) werden via Supabase-Realtime-Channels abonniert (siehe [`lib/realtime/`](lib/realtime/)).
- Das Frontend schreibt **nicht** direkt in Supabase — alle Mutationen laufen über die Backend-API.

---

## Features im Überblick

- **Workspace + Session-Setup** — Wizard zum Konfigurieren von Ziel, Teilnehmenden, Moderationslevel und aktiven Modulen.
- **Live-Session** — LiveKit-Video-Grid, Live-Transkript, Idea-Board, Metrics-Panel, Intervention-Overlays.
- **Review-Ansicht** — KPIs, Beteiligungs-Charts, State-Timeline, Cluster-Graph der Ideen, Volltext-Transkript.
- **Interview-Analyse-Tool** (`/interview-analysis`) — Eigenes, in sich geschlossenes Tool für die qualitative Auswertung von Interview-Transkripten (Coding, Matrix, Vergleich, Report-Generierung). Wurde im Rahmen der Bachelorarbeit zur Auswertung der eigenen Interview-Daten gebaut.

---

## Setup

### Voraussetzungen

- **Node.js** ≥ 20
- **npm** (oder `pnpm`/`yarn` — die folgenden Beispiele nutzen `npm`)
- Laufendes **Backend** ([`brainstorming-backend`](https://github.com/bhalf/brainstorming-backend), Default `http://localhost:8000`)
- Zugang zu:
  - **Supabase**-Projekt (Schema einspielen, siehe unten)
  - **LiveKit-Cloud**-Projekt (für Video)
  - **OpenAI**-API-Key (nur fürs Interview-Analyse-Tool)

### 1. Repository klonen & Dependencies installieren

```bash
git clone https://github.com/bhalf/brainstorming-referee.git
cd brainstorming-referee
npm install
```

### 2. Environment-Variablen

`.env.example` nach `.env.local` kopieren und mit echten Werten befüllen:

```bash
cp .env.example .env.local
```

Pflicht-Variablen:

| Variable | Wofür |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL des FastAPI-Backends, z. B. `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-Key (Browser, schreibgeschützt durch RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key (nur für Server-Routes des Interview-Tools) |
| `NEXT_PUBLIC_LIVEKIT_URL` | wss-URL des LiveKit-Cloud-Projekts |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Werden vom Backend genutzt — hier nur, falls Token-Generierung lokal getestet wird |
| `OPENAI_API_KEY` | Nur für Routes unter `/api/interview-analysis/*` |

### 3. Supabase-Schema einspielen

Im Supabase-Dashboard → **SQL Editor**:

1. [`supabase/schema.sql`](supabase/schema.sql) ausführen (Basis-Tabellen für Sessions, Segmente, Metriken, Interventionen).
2. Alle Migrationen aus [`supabase/migrations/`](supabase/migrations/) in alphabetischer Reihenfolge ausführen (zusätzliche Spalten + Tabellen für das Interview-Analyse-Tool, Session-Reports etc.).
3. **Realtime aktivieren** für die Tabellen:
   `transcript_segments`, `metric_snapshots`, `interventions`, `engine_state`,
   `session_ideas`, `session_participants`, `session_summary`, `goals`.

### 4. Backend starten

Siehe README im [`brainstorming-backend`](https://github.com/bhalf/brainstorming-backend)-Repo. Lokal:

```bash
uvicorn api.main:app --reload --port 8000
```

### 5. Dev-Server starten

```bash
npm run dev
```

App läuft unter [http://localhost:3000](http://localhost:3000).

---

## Verfügbare Scripts

```bash
npm run dev     # Next-Dev-Server (Hot Reload)
npm run build   # Production-Build
npm run start   # Production-Server
npm run lint    # ESLint
npm test        # Vitest (einmalig)
npm run test:watch
```

---

## Projekt-Struktur

```
app/
├── page.tsx                         # Landing (Session erstellen / beitreten)
├── dashboard/                       # Übersicht aller eigenen Sessions
├── workspace/[id]/                  # Workspace-Detailansicht
├── session/[id]/                    # Live-Session (Video, Transkript, Metriken)
├── review/[id]/                     # Post-Session-Review (KPIs, Charts)
├── join/[code]/                     # Beitritt per Einladungs-Code
├── join-workspace/                  # Workspace-Beitritt
├── interview-analysis/              # Interview-Auswertungs-Tool (eigenständig)
└── api/interview-analysis/          # Server-Routes des Interview-Tools

components/
├── session/                         # Live-Session-UI (VideoGrid, IdeaBoard, MetricsPanel, …)
├── review/                          # Post-Session-Charts und KPIs
├── setup/                           # CreateSessionWizard + Steps
└── interview-analysis/              # UI fürs Interview-Coding-Tool

lib/
├── api-client.ts                    # Typisierter HTTP-Client gegen das Backend
├── realtime/                        # Supabase-Realtime-Hooks pro Domain
├── supabase/                        # Supabase-Clients (browser + server)
├── hooks/                           # Generische React-Hooks (useSessionData, useMediaQuery, …)
├── interview-analysis/i18n.ts       # i18n fürs Interview-Tool
└── utils/                           # Hilfsfunktionen (Format, IDs, fetchWithRetry)

types/                               # Zentrale TypeScript-Typen
supabase/                            # Schema + Migrationen
__tests__/                           # Vitest-Suiten
```

---

## Tests

```bash
npm test
```

Testabdeckung: Decision-Engine-Policies, State-Inferenz, Metriken-Berechnung (Participation, Semantic Dynamics) und der Supabase-Integrations-Flow. Siehe [`__tests__/`](__tests__/).

---

## Deployment

Empfohlen: **Vercel** (`@vercel/analytics` ist eingebunden).

1. Repo mit Vercel verbinden.
2. Alle Environment-Variablen aus `.env.local` im Vercel-Dashboard hinterlegen.
3. `NEXT_PUBLIC_API_URL` auf die Production-URL des Backends setzen (z. B. Railway-Deployment).

---

## Bachelorarbeit-Kontext

Das System wurde im Rahmen einer Bachelorarbeit an der Universität Zürich entwickelt und in einer kontrollierten Studie mit drei Bedingungen evaluiert:
- **Baseline** — keine Interventionen
- **Szenario A** — nur Moderator-Interventionen
- **Szenario B** — Moderator + Ally-Eskalation

Code, Daten und Auswertungs-Notebooks der Studie sind separat archiviert und nicht Teil dieses Repositories.
