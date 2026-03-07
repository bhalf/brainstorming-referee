// ============================================
// Centralized Help Content Dictionary
// ============================================
// All info/help texts for the entire app in one place.
// Used by the InfoPopover component.
// ============================================

export interface HelpEntry {
  title: string;
  summary: string;
  calculation?: string;
  goodValue?: string;
  badValue?: string;
  relevance?: string;
  technicalNote?: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {

  // ─── Conversation Health Metrics ───────────────────────────

  'metric.participationRisk': {
    title: 'Participation Risk',
    summary: 'Composite score measuring how unevenly participation is distributed across speakers.',
    calculation: '0.35 × Gini imbalance (word volume) + 0.25 × silent participant ratio (<5% share) + 0.25 × dominance streak (consecutive turns) + 0.15 × turn Gini (turn frequency inequality)',
    goodValue: 'Below 55% — all participants contribute meaningfully.',
    badValue: 'Above 55% — one speaker dominates or others are silent. May trigger a rebalancing intervention.',
    relevance: 'Balanced participation leads to more diverse ideas in brainstorming. Dominant speakers can suppress quieter contributors.',
  },

  'metric.novelty': {
    title: 'Novelty',
    summary: 'Fraction of recent statements that introduce semantically new content compared to everything said before.',
    calculation: 'Each of the last 20 segments is compared to all prior segments via cosine similarity on text embeddings. A segment is "novel" if avg similarity < 0.80.',
    goodValue: 'Above 30% — new ideas are flowing into the conversation.',
    badValue: 'Below 30% — ideas are converging or repeating. May trigger a perspective-broadening intervention.',
    relevance: 'High novelty indicates active exploration of the idea space — the core goal of brainstorming.',
    technicalNote: 'Uses OpenAI text-embedding-3-small. Falls back to Jaccard word-set similarity (threshold 0.40) when embeddings unavailable.',
  },

  'metric.concentration': {
    title: 'Concentration',
    summary: 'How strongly the discussion clusters around a few topics versus exploring many.',
    calculation: 'Greedy centroid clustering on embeddings (merge threshold 0.75). Concentration = 0.5 × (1 - clusters/segments) + 0.5 × HHI (Herfindahl index of cluster shares).',
    goodValue: 'Below 70% — topics are well distributed across multiple themes.',
    badValue: 'Above 70% — all ideas cluster into one narrow topic. Indicates groupthink risk.',
    relevance: 'Low concentration means the group explores diverse angles, which improves brainstorming output quality.',
    technicalNote: 'Uses OpenAI embeddings for semantic clustering. Falls back to Jaccard-based clustering without embeddings.',
  },

  'metric.balance': {
    title: 'Balance',
    summary: 'How evenly speaking time is distributed. 100% means everyone speaks equally.',
    calculation: '1 minus the Gini coefficient on speaking time distribution. Uses audio-based speaking time when available, otherwise text length as proxy.',
    goodValue: 'Above 35% — participation is reasonably balanced.',
    badValue: 'Below 35% — one speaker dominates the conversation heavily.',
    relevance: 'Balanced participation ensures all perspectives are heard, especially important in research brainstorming settings.',
  },

  'metric.repetition': {
    title: 'Repetition',
    summary: 'How much consecutive statements repeat the same content.',
    calculation: 'Average cosine similarity between each pair of consecutive segment embeddings (last 30 segments).',
    goodValue: 'Below 75% — content is varied, new perspectives are being added.',
    badValue: 'Above 75% — the conversation is going in circles with the same ideas.',
    relevance: 'High repetition signals the group is stuck and may need a new stimulus to break out of the loop.',
    technicalNote: 'With embeddings: cosine similarity on consecutive pairs. Without: Jaccard word-set similarity on last 10 segments.',
  },

  'metric.stagnation': {
    title: 'Stagnation',
    summary: 'Time (in seconds) since the last truly new idea was introduced.',
    calculation: 'Walks backwards through the last 30 segments. Finds the most recent segment where avg cosine similarity to all prior segments < 0.85. Reports time elapsed since that segment.',
    goodValue: 'Below 180 seconds — fresh content is still being introduced.',
    badValue: 'Above 180 seconds — no new ideas for 3+ minutes. May trigger a reactivation intervention.',
    relevance: 'Extended stagnation means the brainstorming has stalled. A moderator prompt can re-energize the discussion.',
    technicalNote: 'With embeddings: semantic novelty detection. Without: simple time since last segment (no semantic analysis).',
  },

  'metric.diversity': {
    title: 'Diversity',
    summary: 'How broad the vocabulary used in the discussion is.',
    calculation: 'With embeddings: 1 minus average pairwise cosine similarity of all segment pairs. Without: Type-Token Ratio = unique words / total words (words > 2 characters).',
    goodValue: 'Above 30% — good vocabulary breadth, diverse topics being discussed.',
    badValue: 'Below 30% — narrow vocabulary, may indicate limited topic exploration.',
    relevance: 'Vocabulary diversity correlates with the breadth of ideas explored during brainstorming.',
    technicalNote: 'Primary: embedding-based semantic diversity. Fallback: Type-Token Ratio (purely algorithmic).',
  },

  // ─── Conversation States ───────────────────────────────────

  'state.healthyExploration': {
    title: 'Healthy Exploration',
    summary: 'The conversation is in an ideal state: multiple voices are contributing and new ideas are flowing.',
    calculation: '25% low participation risk + 30% novelty rate + 20% expansion score + 25% exploration ratio.',
    goodValue: 'This IS the good state — the system will not intervene.',
    relevance: 'This is the target state for brainstorming. The system monitors to ensure it continues.',
  },

  'state.healthyElaboration': {
    title: 'Healthy Elaboration',
    summary: 'The group is productively deepening existing ideas rather than exploring new ones.',
    calculation: 'Lower novelty is expected, but cluster concentration must be low (ideas spread across sub-themes). Participation risk must be below 0.50.',
    goodValue: 'This is a healthy state — elaboration is a natural and productive phase.',
    relevance: 'Distinguishes productive deepening from problematic convergence. No intervention needed.',
  },

  'state.dominanceRisk': {
    title: 'Dominance Risk',
    summary: 'Participation is becoming imbalanced — one speaker dominates or others are silent.',
    calculation: '35% participation risk + 25% silent participant ratio + 20% dominance streak + 20% Gini imbalance.',
    badValue: 'When confirmed for 30 seconds, triggers a PARTICIPATION_REBALANCING intervention.',
    relevance: 'Imbalanced participation suppresses ideas from quieter participants and reduces brainstorming quality.',
  },

  'state.convergenceRisk': {
    title: 'Convergence Risk',
    summary: 'Ideas are narrowing. The semantic space is contracting rather than expanding.',
    calculation: '35% negative expansion score + 30% cluster concentration + 20% low novelty + 15% low exploration ratio.',
    badValue: 'When confirmed, triggers a PERSPECTIVE_BROADENING intervention to widen the idea space.',
    relevance: 'Convergence means the group is fixating on one direction. A broadening prompt helps explore alternatives.',
  },

  'state.stalledDiscussion': {
    title: 'Stalled Discussion',
    summary: 'No new content is being generated. The conversation is semantically static.',
    calculation: '30% stagnation duration (normalized) + 25% negative expansion + 20% high repetition + 15% high concentration + 10% low novelty.',
    badValue: 'When confirmed, triggers a REACTIVATION intervention to re-energize the discussion.',
    relevance: 'A stalled discussion produces no new ideas. A provocative question or new framing can restart creative flow.',
  },

  // ─── Engine Phases ─────────────────────────────────────────

  'phase.monitoring': {
    title: 'Monitoring',
    summary: 'The engine is observing the conversation, computing metrics every 5 seconds. No intervention timers are active.',
    relevance: 'Default phase. The engine watches for risk states but does not yet act.',
  },

  'phase.confirming': {
    title: 'Confirming',
    summary: 'A risk state has been detected. The engine verifies that it persists before intervening.',
    calculation: 'Requires 70%+ of metric snapshots within the confirmation window to show the same risk state. Default: 30 seconds.',
    relevance: 'Prevents false positives from transient state changes. Only persistent problems trigger interventions.',
  },

  'phase.postCheck': {
    title: 'Post-Check',
    summary: 'An intervention was fired. The engine waits to evaluate whether the conversation recovered.',
    calculation: 'Waits POST_CHECK_SECONDS (default 90s), then evaluates intent-specific recovery metrics. Improvement threshold: 0.15.',
    goodValue: 'Recovery detected — the intervention helped. Engine returns to monitoring.',
    badValue: 'No recovery — in Scenario B, escalates to ally intervention.',
    relevance: 'Measures intervention effectiveness. Enables the escalation logic in Scenario B.',
  },

  'phase.cooldown': {
    title: 'Cooldown',
    summary: 'After an escalation (ally intervention) or post-check, the engine pauses before allowing further interventions.',
    calculation: 'No interventions for COOLDOWN_SECONDS (default 180s).',
    relevance: 'Prevents intervention fatigue. Gives the group time to self-regulate after an intervention.',
  },

  // ─── Configuration Groups ─────────────────────────────────

  'config.windowGroup': {
    title: 'Window & Analysis',
    summary: 'Controls the observation window size and how frequently the AI re-evaluates the conversation.',
    relevance: 'Shorter windows react faster but are noisier. Longer analysis intervals reduce CPU load but delay detection.',
  },

  'config.triggerGroup': {
    title: 'Trigger Timing',
    summary: 'Controls how long a problem must persist before intervention and how long the system pauses between interventions.',
    relevance: 'These settings balance responsiveness against over-intervention. Conservative settings let groups self-correct first.',
  },

  'config.thresholdGroup': {
    title: 'Thresholds',
    summary: 'Numeric thresholds that determine when conversation metrics are considered "breached" and may warrant intervention.',
    relevance: 'Lower thresholds make the system more sensitive (more interventions). Higher thresholds are more conservative.',
  },

  'config.safetyGroup': {
    title: 'Safety Limits',
    summary: 'Hard limits that prevent the AI from intervening too frequently, regardless of metric breaches.',
    relevance: 'Safety nets against runaway intervention loops. Ensures the AI remains a helper, not a distraction.',
  },

  // ─── Configuration Parameters ──────────────────────────────

  'config.windowSeconds': {
    title: 'Window (seconds)',
    summary: 'Size of the rolling time window used for all metric computations.',
    calculation: 'Only transcript segments within the last N seconds are included in metric calculations.',
    goodValue: '120–300 seconds for typical brainstorming. Default: 180s (3 minutes).',
    relevance: 'Shorter window = more responsive to recent changes. Longer window = more stable metrics.',
  },

  'config.analyzeEveryMs': {
    title: 'Analyze Every (ms)',
    summary: 'How often metrics are recomputed.',
    goodValue: '3000–10000ms. Default: 5000ms (every 5 seconds).',
    relevance: 'Lower values give faster response but increase CPU load and API calls for embeddings.',
  },

  'config.persistenceSeconds': {
    title: 'Persistence (seconds)',
    summary: 'Legacy (v1): how long a threshold must be continuously breached before triggering an intervention.',
    calculation: 'Counter starts when a threshold is first breached. Resets if the metric returns to a healthy range.',
    relevance: 'Superseded by CONFIRMATION_SECONDS in v2, but still used for v1 trigger-based interventions.',
  },

  'config.cooldownSeconds': {
    title: 'Cooldown (seconds)',
    summary: 'Minimum time between interventions. No new interventions during this period.',
    goodValue: '120–300 seconds. Default: 180s.',
    relevance: 'Prevents the system from intervening too frequently, which would disrupt natural conversation flow.',
  },

  'config.postCheckSeconds': {
    title: 'Post-Check (seconds)',
    summary: 'Time to wait after an intervention before evaluating recovery.',
    goodValue: '60–120 seconds. Default: 90s.',
    relevance: 'Gives the group enough time to react naturally to the intervention before measuring its effect.',
  },

  'config.confirmationSeconds': {
    title: 'Confirmation (seconds)',
    summary: 'How long a risk state must persist before the engine triggers an intervention.',
    goodValue: '20–60 seconds. Default: 30s.',
    relevance: 'Short enough to react promptly, long enough to filter transient state changes.',
  },

  'config.recoveryThreshold': {
    title: 'Recovery Threshold',
    summary: 'Minimum improvement score needed to count as "recovered" after an intervention.',
    calculation: 'Compares metrics at intervention time vs. after post-check period. Score must exceed this threshold.',
    goodValue: '0.10–0.25. Default: 0.15.',
    relevance: 'If recovery is below this threshold in Scenario B, the system escalates to the ally persona.',
  },

  'config.thresholdImbalance': {
    title: 'Imbalance Threshold',
    summary: 'Gini coefficient above which participation is considered imbalanced.',
    goodValue: '0.50–0.75. Default: 0.65.',
    relevance: 'Controls sensitivity of the Balance metric. Lower = more sensitive to imbalance.',
  },

  'config.thresholdRepetition': {
    title: 'Repetition Threshold',
    summary: 'Semantic similarity rate above which content is considered too repetitive.',
    goodValue: '0.60–0.85. Default: 0.75.',
    relevance: 'Controls when the system detects circular discussions.',
  },

  'config.thresholdStagnation': {
    title: 'Stagnation Threshold (seconds)',
    summary: 'Seconds of no new content before stagnation is flagged.',
    goodValue: '120–300 seconds. Default: 180s.',
    relevance: 'Determines when a pause becomes a stall that needs intervention.',
  },

  'config.maxInterventions': {
    title: 'Max Interventions / 10 min',
    summary: 'Hard limit on interventions within a 10-minute window.',
    goodValue: '2–5. Default: 3.',
    relevance: 'Safety limit to prevent over-intervening regardless of conversation state.',
  },

  'config.ttsRateLimit': {
    title: 'TTS Rate Limit (seconds)',
    summary: 'Minimum time between two consecutive voice outputs.',
    goodValue: '20–60 seconds. Default: 30s.',
    relevance: 'Prevents rapid-fire voice interventions that would disrupt the conversation.',
  },

  // ─── Model Routing ─────────────────────────────────────────

  'model.moderator': {
    title: 'Moderator Model',
    summary: 'LLM used for process-oriented reflections when a risk state is confirmed.',
    calculation: 'Low temperature (0.4) for consistent, predictable outputs. Max 100 tokens.',
    relevance: 'The moderator gently guides the discussion without injecting content. Fast model preferred.',
    technicalNote: 'Default: gpt-4o-mini. Fallback: gpt-3.5-turbo. Provider: OpenAI.',
  },

  'model.ally': {
    title: 'Ally Model',
    summary: 'LLM used for creative impulses during escalation in Scenario B.',
    calculation: 'Higher temperature (0.9) for more creative, varied outputs. Max 80 tokens.',
    relevance: 'The ally persona contributes a concrete idea to model creative behavior and break deadlocks.',
    technicalNote: 'Default: gpt-4o-mini. Only used in Scenario B when moderator intervention does not lead to recovery.',
  },

  'model.embeddings': {
    title: 'Embeddings Model',
    summary: 'Model for computing text embeddings used in semantic similarity metrics.',
    calculation: 'Converts text segments into 1536-dimensional vectors. Cosine similarity measures semantic closeness.',
    relevance: 'Powers novelty, concentration, repetition, stagnation, and diversity metrics.',
    technicalNote: 'Default: text-embedding-3-small. Fallback: text-embedding-ada-002. Cached in localStorage (max 500 entries).',
  },

  'model.transcription': {
    title: 'Transcription Model',
    summary: 'Server-side automatic speech recognition (ASR) via OpenAI Whisper.',
    relevance: 'Disabled by default — the app uses the browser Web Speech API. Enable for better accuracy or non-browser environments.',
    technicalNote: 'Model: whisper-1. When enabled, audio chunks are sent to /api/transcription every 5 seconds.',
  },

  // ─── Voice Settings ────────────────────────────────────────

  'voice.enable': {
    title: 'Enable Voice',
    summary: 'Toggle text-to-speech for AI interventions. When enabled, moderator and ally messages are spoken aloud via the browser TTS engine.',
    relevance: 'Voice output makes interventions more noticeable in live brainstorming sessions.',
  },

  'voice.selection': {
    title: 'Voice Selection',
    summary: 'Choose the TTS voice. Voices marked with a star are enhanced quality (remote/neural) voices.',
    relevance: 'Filtered by session language. Enhanced voices sound more natural but may have higher latency.',
  },

  'voice.rate': {
    title: 'Speech Rate',
    summary: 'Speed multiplier for voice output. 1.0 = normal speed.',
    goodValue: '0.8–1.2 for natural sounding speech.',
    badValue: 'Below 0.5 is very slow, above 1.5 may be hard to understand.',
  },

  'voice.pitch': {
    title: 'Voice Pitch',
    summary: 'Pitch of the voice output. 1.0 = natural pitch.',
    goodValue: '0.8–1.2 for natural sounding speech.',
  },

  'voice.volume': {
    title: 'Volume',
    summary: 'Volume level for voice output as percentage.',
    goodValue: '80–100% for a meeting environment.',
  },

  // ─── Scenarios ─────────────────────────────────────────────

  'scenario.baseline': {
    title: 'Baseline (Control)',
    summary: 'No AI interventions are generated. All metrics are still computed and logged for research comparison.',
    relevance: 'Control group for the experiment. Allows comparing natural brainstorming dynamics against AI-assisted sessions.',
  },

  'scenario.a': {
    title: 'Scenario A: Moderator',
    summary: 'Moderator-only interventions. When a risk state is confirmed, the system generates a process-oriented reflection.',
    calculation: 'Risk detected → 30s confirmation → intervention generated → 90s post-check → result logged.',
    relevance: 'Tests whether subtle process guidance improves brainstorming outcomes.',
  },

  'scenario.b': {
    title: 'Scenario B: Moderator + Ally',
    summary: 'Adds escalation: if the moderator intervention does not lead to recovery, an "ally" persona injects a creative impulse.',
    calculation: 'Moderator fires first → 90s post-check → if no recovery → ally intervention → cooldown.',
    relevance: 'Tests whether a two-tier intervention system (guidance + creative stimulus) outperforms moderator-only.',
  },

  // ─── Intervention Intents ──────────────────────────────────

  'intent.participationRebalancing': {
    title: 'Participation Rebalancing',
    summary: 'Triggered by DOMINANCE_RISK. The moderator encourages underrepresented participants to share their perspective.',
    relevance: 'Aims to redistribute speaking time without directly criticizing the dominant speaker.',
  },

  'intent.perspectiveBroadening': {
    title: 'Perspective Broadening',
    summary: 'Triggered by CONVERGENCE_RISK. The moderator introduces a new angle or asks the group to consider alternatives.',
    relevance: 'Widens the idea space when the group is fixating on one direction.',
  },

  'intent.reactivation': {
    title: 'Reactivation',
    summary: 'Triggered by STALLED_DISCUSSION. The moderator re-energizes the discussion with a provocative question or new framing.',
    relevance: 'Breaks through stagnation when the group has run out of momentum.',
  },

  'intent.allyImpulse': {
    title: 'Ally Impulse',
    summary: 'Scenario B escalation. The ally persona contributes a concrete creative idea to model productive brainstorming behavior.',
    relevance: 'Only fires after a moderator intervention fails to produce recovery. Adds direct content rather than just process guidance.',
    technicalNote: 'Uses higher temperature (0.9) for more creative, unexpected outputs.',
  },

  // ─── Section Headers ───────────────────────────────────────

  'section.conversationHealth': {
    title: 'Conversation Health',
    summary: 'Real-time metrics measuring the quality and dynamics of the brainstorming discussion.',
    calculation: 'All metrics are computed on a rolling 3-minute window, updated every 5 seconds.',
    relevance: 'These metrics drive the AI decision engine. When thresholds are breached persistently, the system intervenes.',
    technicalNote: 'Yellow line = intervention threshold. When a metric crosses the line, the bar turns red.',
  },

  'section.moderatorState': {
    title: 'Moderator State',
    summary: 'Current state of the AI decision engine that controls when and how interventions are generated.',
    calculation: 'The engine cycles through phases: Monitoring → Confirming → Post-Check → Cooldown.',
    relevance: 'Shows what the AI is currently doing and whether an intervention is being prepared or evaluated.',
  },

  'section.speakingShare': {
    title: 'Speaking Share',
    summary: 'Distribution of speaking time across all participants in the current analysis window.',
    calculation: 'Based on audio-level speaking detection (LiveKit isSpeaking) when available, otherwise text length as proxy.',
    badValue: 'Orange highlight when a single speaker exceeds 60% of total speaking time.',
    relevance: 'Quick visual indicator of who is contributing most to the discussion.',
  },

  'section.conversationState': {
    title: 'Conversation State',
    summary: 'The inferred state of the conversation based on all metrics. Determines whether the AI should intervene.',
    calculation: 'Five candidate states are scored using weighted combinations of metrics. The highest-confidence state wins, with risk states given a tiebreak advantage (0.03 margin).',
    relevance: 'This is the primary input to the decision engine. Healthy states = no intervention needed. Risk states may trigger interventions.',
    technicalNote: 'Uses hysteresis (0.08 margin) to prevent flickering between states.',
  },
};

/** Look up a help entry by key. Returns null for unknown keys. */
export function getHelpEntry(key: string): HelpEntry | null {
  return HELP_CONTENT[key] ?? null;
}
