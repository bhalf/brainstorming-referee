# UZH Brainstorming - AI-Assisted Brainstorming Research Prototype

A Next.js prototype for researching AI-assisted brainstorming with live video calls (Jitsi), real-time transcription, and AI interventions.

## Features

- 🎥 **Live Video Calls** via Jitsi Meet (embedded, no login required)
- 🎤 **Real-time Transcription** using Web Speech API
- 📊 **Live Metrics Analysis** (participation balance, repetition, stagnation)
- 🤖 **AI Moderator Interventions** (GPT-powered or fallback responses)
- 💡 **Ally Escalation** (Scenario B) for creative impulses
- 🔊 **Text-to-Speech** for spoken interventions
- 📝 **Session Logging** with JSON export
- ⚙️ **Configurable Parameters** for research experiments

## Experiment Scenarios

| Scenario | Description |
|----------|-------------|
| **Baseline** | No AI interventions (control group) |
| **Scenario A** | Moderator interventions only |
| **Scenario B** | Moderator + Ally escalation |

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome browser (recommended for Speech API support)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file:

```env
# Required for AI-generated responses (optional - fallback responses available)
OPENAI_API_KEY=sk-...
```

### Usage

1. Open http://localhost:3000
2. Configure room name, scenario, and language
3. (Optional) Adjust advanced parameters
4. Click "Start Brainstorming Session"
5. Join the Jitsi video call
6. Enable transcription with the microphone button
7. Monitor metrics in the Debug tab
8. Export session log when finished

## How to Validate Intervention Logic

To ensure the Decision Engine works robustly, you can validate the state machine using the "Debug" panel in the active call:
1. **Scenario Baseline**: In the Setup page, select "Baseline". Verify that no interventions trigger, regardless of metric breaches.
2. **Scenario A (Moderator Only)**: Select Scenario A. Wait for a metric (e.g., Imbalance) to cross its threshold. The **Persistence Timer** in the Debug Panel will start. If the breach holds for `PERSISTENCE_SECONDS` (based on an 75% sliding window history), a **Moderator (Process)** intervention appears. The engine shifts to STABILIZATION, starting the **Post-Check Timer**. Once post-check finishes, if the metrics haven't improved, the system silently returns to OBSERVATION (no Ally escalation).
3. **Scenario B (Escalation to Ally)**: Select Scenario B. Trigger a Moderator intervention as above. Ensure the metrics do *not* improve during the Post-Check. Once the post-check completes, an **Ally (Impulse)** intervention should trigger automatically.
4. **Cooldown Validation**: After any intervention, a **Cooldown** timer starts. No new interventions will fire while this countdown is active, even if metrics are in the red.
5. **API Resilience**: If you temporarily block network access, the API call will log a timeout/error after 12s, show an error in the UI, and the state machine will remain in OBSERVATION to retry on the next tick seamlessly.

## Project Structure

```
/app
  /page.tsx                 # Setup page
  /call/[room]/page.tsx     # Call page with Jitsi
  /api/intervention
    /moderator/route.ts     # Moderator AI endpoint
    /ally/route.ts          # Ally AI endpoint

/components
  /JitsiEmbed.tsx           # Jitsi video embed
  /OverlayPanel.tsx         # Side panel with tabs
  /TranscriptFeed.tsx       # Live transcript display
  /ChatFeed.tsx             # AI intervention messages
  /DebugPanel.tsx           # Metrics & state display
  /VoiceControls.tsx        # TTS settings
  /ExportButton.tsx         # Session export

/lib
  /types.ts                 # TypeScript interfaces
  /config.ts                # Default config & utilities
  /context/SessionContext.tsx  # Global state management
  /transcription/useSpeechRecognition.ts
  /metrics/computeMetrics.ts
  /decision/decisionEngine.ts
  /tts/useSpeechSynthesis.ts
```

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| WINDOW_SECONDS | 180 | Rolling window for metrics |
| ANALYZE_EVERY_MS | 5000 | Metrics computation interval |
| PERSISTENCE_SECONDS | 120 | Threshold breach duration before intervention |
| COOLDOWN_SECONDS | 180 | Min time between interventions |
| POST_CHECK_SECONDS | 90 | Wait before checking improvement |
| THRESHOLD_IMBALANCE | 0.65 | Participation imbalance trigger |
| THRESHOLD_REPETITION | 0.75 | Semantic repetition trigger |
| THRESHOLD_STAGNATION_SECONDS | 180 | Stagnation trigger |
| TTS_RATE_LIMIT_SECONDS | 30 | Min time between TTS outputs |
| MAX_INTERVENTIONS_PER_10MIN | 3 | Safety limit |

## Browser Compatibility

- ✅ Chrome (recommended) - Full support
- ⚠️ Firefox - Limited Speech API support
- ⚠️ Safari - Limited Speech API support
- ❌ Edge - Untested

## Research Notes

This is a research prototype. The AI interventions are designed to:
- Make **process reflections** only (not contribute ideas)
- Be **brief** and **TTS-friendly** (1-2 sentences)
- Focus on **group dynamics** rather than content

Session logs include all data needed for analysis:
- Transcript segments with timestamps
- Metric snapshots over time
- All interventions with triggers
- Active configuration

## License

Research prototype - University of Zurich
