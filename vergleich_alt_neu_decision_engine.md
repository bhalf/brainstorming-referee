# Vergleich: Altes System (_archive) vs. Neues Backend — Decision Engine

**Erstellt:** 2026-03-17
**Quellen Alt:** `_archive/lib/state/inferConversationState.ts`, `_archive/lib/decision/interventionPolicy.ts`, `_archive/lib/decision/postCheck.ts`, `_archive/lib/decision/interventionExecutor.ts`, `_archive/lib/decision/ruleViolationChecker.ts`, `_archive/lib/decision/transcriptContext.ts`, `_archive/lib/config.ts`
**Quelle Neu:** Backend-Dokument "Decision Engine & Interventions — Deep Dive"

---

## 1. State Inference — Formel-Unterschiede

### 1.1 HEALTHY_EXPLORATION

| Aspekt | Alt (`inferConversationState.ts:55-73`) | Neu (Backend-Dokument) |
|--------|---|---|
| Formel | `(0.25*(1-risk) + 0.30*novelty + 0.20*clamp(expansion+0.5, 0, 1) + 0.25*explorationRatio) * (1 - stagnationPenalty)` | `(0.25*(1-risk) + 0.30*novelty + 0.20*(expansion+0.5) + 0.25*exploration) * (1 - stagnation_penalty)` |
| Hard Gate | `if (risk > 0.5) return 0` (Zeile 61) | **Nicht explizit erwähnt** im Dok — nur bei HEALTHY_ELABORATION steht "Vorbedingung: risk ≤ 0.5" |
| Expansion-Term | `clamp(expansion + 0.5, 0, 1)` — explizit geclampt | `(expansion+0.5)` — **kein clamp erwähnt**. Ohne clamp: expansion=0.8 → 1.3 (>1!) |
| Stagnation-Divisor | `/120` (120s) | `/120` (120s) — **identisch** |

**Potenzielle Probleme:**
1. **Hard Gate bei HEALTHY_EXPLORATION fehlt im neuen Dok.** Im alten Code ist es klar: `risk > 0.5 → return 0`. Falls das im Backend fehlt, könnte HEALTHY_EXPLORATION bei stark ungleicher Beteiligung trotzdem hohe Confidence bekommen.
2. **Fehlender Clamp** im Expansion-Term könnte Werte > 1.0 produzieren.

---

### 1.2 HEALTHY_ELABORATION — KRITISCHSTER UNTERSCHIED

| Aspekt | Alt (Zeile 85-107) | Neu |
|--------|---|---|
| Hard Gate | `risk > 0.5 → return 0` | `risk > 0.5 → 0.0` — **identisch** |
| Formel | `0.20*(1-risk) + 0.25*(1-novelty) + 0.25*(1-exploration) + 0.15*concentrationBonus + 0.15*expansionBonus` | `0.20*(1-risk) + 0.25*(1-novelty) + 0.25*(1-exploration) + 0.15*(1-concentration) + 0.15*expansion_bonus` |
| **Concentration-Term** | `0.15 * clamp(clusterConcentration, 0, 1)` → **HOHE Konzentration = GUT** | `0.15 * (1-concentration)` → **NIEDRIGE Konzentration = GUT** |
| **Expansion-Bonus** | `clamp(expansion + 0.3, 0, 1)` → Range [0, 1] | `clamp(expansion*0.5 + 0.5, 0, 0.3)` → Range [0, 0.3] |
| Stagnation-Penalty | `clamp(stagnation/120, 0, 1)` | `(1 - stagnation_penalty)` — gleich |

#### Concentration-Term ist invertiert!

Das ist der gravierendste Unterschied:
- **Alt:** Hohe `clusterConcentration` (= Ideen fokussiert in wenigen Clustern) → hoher HEALTHY_ELABORATION Score. Begründung: "focused deepening of a theme" ist gesunde Vertiefung.
- **Neu:** Hohe `concentration` → NIEDRIGER HEALTHY_ELABORATION Score (weil `1-concentration`). Das bedeutet: das neue System wertet fokussierte Vertiefung negativ statt positiv.

#### Expansion-Bonus — Zahlenbeispiele

| expansion | Alt: `clamp(exp+0.3, 0, 1)` | Neu: `clamp(exp*0.5+0.5, 0, 0.3)` |
|-----------|---|---|
| -1.0 | 0 | 0 |
| -0.3 | 0 | 0.3 |
| 0.0 | 0.3 | 0.3 |
| 0.5 | 0.8 | 0.3 |
| 1.0 | 1.0 | 0.3 |

Das neue System cappt den Bonus bei 0.3, während das alte System bis 1.0 gehen konnte. Bei positivem Expansion hat der Term im alten System viel mehr Einfluss.

#### Konsequenz

Die Kombination aus invertiertem Concentration-Term + reduziertem Expansion-Bonus bedeutet, dass HEALTHY_ELABORATION im neuen System **deutlich andere Situationen erkennt** als im alten. Das alte System sah "fokussierte Vertiefung bei fairem Anteil" als healthy — das neue System eher nicht.

---

### 1.3 DOMINANCE_RISK — Identisch

| Alt (Zeile 116-128) | Neu |
|---|---|
| `0.30*risk + 0.25*silentRatio + 0.20*dominanceStreakScore + 0.25*cumulativeImbalance` | `0.30*risk + 0.25*silent + 0.20*dominance + 0.25*cumulative_imbalance` |

Nur Feldnamen-Unterschiede (camelCase → snake_case). Formel identisch.

---

### 1.4 CONVERGENCE_RISK — Identisch

| Alt (Zeile 139-148) | Neu |
|---|---|
| `0.25*clusterConcentration + 0.20*(1-novelty) + 0.20*(1-explorationRatio) + 0.35*clamp(-expansion, 0, 1)` | `0.25*concentration + 0.20*(1-novelty) + 0.20*(1-exploration) + 0.35*clamp(-expansion)` |

Identisch.

---

### 1.5 STALLED_DISCUSSION — Kleinere Unterschiede

| Aspekt | Alt (Zeile 160-174) | Neu |
|--------|---|---|
| Diversity-Feld | `diversityDevelopment` | `diversity` |
| Fluency-Clamp | `clamp(1 - fluencyRate/6, 0, 1)` | `1 - fluency_rate/6.0` — **kein expliziter Clamp** |

`diversityDevelopment` vs `diversity` — könnten identische Metriken sein (nur umbenannt) oder unterschiedliche Berechnungen. Das muss im Backend-Code verifiziert werden.

---

### 1.6 Auswahllogik — Identisch

| Parameter | Alt | Neu |
|---|---|---|
| HYSTERESIS_MARGIN | 0.08 | 0.08 |
| TIEBREAK_MARGIN | 0.03 | 0.03 |
| MIN_CONFIDENCE | 0.45 | 0.45 |
| Priorität | STALLED > DOMINANCE > CONVERGENCE > HEALTHY_EXPL > HEALTHY_ELAB | Identisch |

---

## 2. Decision Engine — Timing & Phasen

### 2.1 Timing-Werte

| Parameter | Alt (`_archive/lib/config.ts`) | Neu | Unterschied |
|---|---|---|---|
| CONFIRMATION_SECONDS | 45 | 45 | **Identisch** |
| POST_CHECK_SECONDS | 180 | 180 | **Identisch** |
| COOLDOWN_SECONDS | 180 | 180 | **Identisch** |
| MAX_INTERVENTIONS_PER_10MIN | 3 | 3 | **Identisch** |
| DECISION_TICK_MS | 1000 (1s) | 1s | **Identisch** |
| confirming_min_dwell_seconds | **Existiert nicht** | **10s** | **NEU** |

### 2.2 Phasen-Verhalten

| Phase | Alt | Neu | Unterschied |
|---|---|---|---|
| MONITORING→CONFIRMING | Sofort bei Risiko-State | Sofort bei Risiko-State | Gleich |
| CONFIRMING→MONITORING (Self-Resolution) | **Sofort** bei nächstem Healthy-Tick (kein Min-Dwell) | **Erst nach 10s** (`confirming_min_dwell_seconds`) | **NEU: Ping-Pong-Schutz** |
| CONFIRMING→POST_CHECK | Nach 45s, **mit Persistenz-Check** | Nach 45s, **ohne Persistenz-Check** | **FEHLT** (s.u.) |
| POST_CHECK→MONITORING | recovered OR partial | recovered only | **Partial fehlt** |
| POST_CHECK→COOLDOWN | not_recovered (Szenario A) | not_recovered | Gleich |
| POST_CHECK→ALLY (Eskalation) | not_recovered (Szenario B) → ALLY_IMPULSE | **Existiert nicht** | **FEHLT** |

---

## 3. Features im alten System, die im neuen fehlen

### 3a. Fatigue-basierte adaptive Zeiten

**Alt** (`interventionPolicy.ts:143-195`): `analyzeInterventionHistory()` zählt aufeinanderfolgende Fehlschläge und skaliert Timing:

| Consecutive Failures | Confirmation-Multiplikator | Cooldown-Multiplikator |
|---|---|---|
| 0 | 1x (45s) | 1x (180s) |
| 1 | 1.5x (67.5s) | 1.5x (270s) |
| 2+ | 2x (90s) | 2x (360s) |

**Zweck:** Nach wiederholten Fehlschlägen wartet das System länger, bevor es erneut interveniert. Verhindert Frustration bei Teilnehmern.

**Neu:** Nicht vorhanden. Feste 45s/180s/180s unabhängig von der Erfolgshistorie.

**Risiko:** Ohne Fatigue kann das System bei hartnäckigen Problemen alle ~225s intervenieren, selbst wenn vorherige Interventionen wirkungslos waren.

---

### 3b. 70% Persistenz-Check

**Alt** (`interventionPolicy.ts:388-465`): Vor dem Auslösen der Intervention wird ein Sliding-Window-Check durchgeführt:
- ≥70% der Metriken-Snapshots im Bestätigungsfenster müssen in einem Risiko-Zustand gewesen sein
- Zählt **alle** Risiko-Zustände (nicht nur den aktuellen)
- Wählt den **häufigsten** Risiko-Zustand als Ziel-Intent
- Falls <70%: Bestätigungs-Timer wird zurückgesetzt

**Beispiel:** In 45s Bestätigung: 20 Snapshots vorhanden. 10x DOMINANCE_RISK, 6x STALLED_DISCUSSION, 4x HEALTHY. → 16/20 = 80% Risk → OK, feuert für DOMINANCE_RISK (häufigster).

**Neu:** Nicht vorhanden. Wenn 45s vergangen sind und der **aktuelle** State ein Risiko ist, wird sofort interveniert — unabhängig davon, wie oft der State in den 45s gewechselt hat.

**Risiko:** Ohne Persistenz-Check könnte eine Intervention ausgelöst werden, wenn die Situation nur am Ende der 45s kurz als Risiko erscheint, aber die meiste Zeit healthy war.

---

### 3c. Partial Recovery

**Alt** (`interventionPolicy.ts:573-585`, `postCheck.ts`): Drei Recovery-Ergebnisse:
- `recovered`: Hauptkriterien erfüllt → zurück zu MONITORING
- `partial` (score ≥ 0.05): Mindestens ein Kriterium verbessert → zurück zu MONITORING
- `not_recovered`: Keine Verbesserung → COOLDOWN (oder Ally-Eskalation)

**Neu:** Nur zwei Ergebnisse: `recovered` (true/false). Kein Partial-Konzept.

**Risiko:** Ohne Partial-Recovery gehen Fälle mit teilweiser Verbesserung direkt in COOLDOWN (180s Pause), obwohl die Intervention teilweise gewirkt hat. Das alte System hätte in diesen Fällen sofort wieder beobachtet.

---

### 3d. Szenario A/B mit Ally-Eskalationskette

**Alt** (`interventionPolicy.ts:287-290, 589-612`):
- **Szenario A** (`moderation`): Nur Moderator. Nicht recovered → COOLDOWN
- **Szenario B** (`moderation_ally`): Moderator zuerst. Nicht recovered → ALLY_IMPULSE (mit kürzerem Post-Check: max 60s). Ally nicht recovered → COOLDOWN

**Neu:**
- `moderation`: Moderator
- `moderation_ally`: **Ally statt Moderator** (kein "zusätzlich")

**Fundamentaler Unterschied:** Im alten System war Ally die **Eskalation** nach Moderator-Versagen (2-stufig). Im neuen System wird Ally **statt** Moderator verwendet (1-stufig). Es gibt keine Eskalationskette mehr.

**Konsequenz:** In `moderation_ally`-Sessions:

| Aspekt | Alt | Neu |
|--------|-----|-----|
| Erste Intervention | Moderator (sachlich) | Ally (kreativ) |
| Zweite Chance | Ally (kreativ) nach Moderator-Fehlschlag | Keine — direkt COOLDOWN |
| Post-Check für Ally | max 60s | Standard 180s |
| Gesamtchancen pro Zyklus | 2 (Moderator + Ally) | 1 (nur Ally) |

---

### 3e. Lifecycle-Logging

**Alt** (`interventionExecutor.ts:147-212`): Detailliertes 3-Phasen-Logging:
1. `detected` — Risiko erkannt
2. `generated` — LLM-Antwort generiert (mit Latenz-Tracking, Model-Info, Fallback-Flag)
3. `delivered` — Intervention zugestellt (mit TTS-Status, Display-Mode)

**Neu:** Nicht im Dokument erwähnt.

---

### 3f. Model-Routing-Logging

**Alt** (`interventionExecutor.ts:233-244`): Separate `model_routing_logs` Tabelle mit Model-Name, Latenz, Fallback-Status pro LLM-Call.

**Neu:** Nicht im Dokument erwähnt.

---

### 3g. Voice-Settings mit Display-Mode

**Alt** (`interventionExecutor.ts:197-199`): Drei Modi: `voice` / `text` / `both`. Intervention nur gesprochen wenn `displayMode` Voice enthält.

**Neu:** Immer Audio-Injection via LiveKit AudioTrack. Kein konfigurierbarer Display-Mode.

---

## 4. Features im neuen System, die im alten fehlen

| Feature | Beschreibung | Vorteil |
|---------|-------------|---------|
| `confirming_min_dwell_seconds` (10s) | Mindestens 10s in CONFIRMING bevor Self-Resolution erlaubt | Verhindert Ping-Pong bei Grenzwerten |
| Combined Prompts | Moderator + Regelverstoss in einem Satz | Natürlichere Intervention |
| LiveKit AudioTrack injection | Server-side TTS → PCM Frames → LiveKit | Zuverlässiger als Browser-TTS |
| Zwei Stimmen (nova/echo) | Moderator: "nova", Ally: "echo" | Klar unterscheidbar |
| Double-Write Interventions | Erst leer (Decision Engine), dann mit Text (Moderator/Ally) | Ermöglicht asynchrone Generierung |
| Server-side Agent | Backend-Agent tritt als LiveKit-Teilnehmer bei | Kein Leader-Election nötig, eine Instanz |

---

## 5. Recovery-Evaluation — Schwellwert-Vergleich

### 5.1 PARTICIPATION_REBALANCING

| Kriterium | Alt (`postCheck.ts:51-86`) | Neu | Unterschied |
|-----------|---|---|---|
| Risk Delta | ≥ 0.15 (relativ) | ≥ 0.15 (relativ) | Gleich |
| Silent improved | delta ≥ 0.1 **ODER** currSilent === 0 | "gesunken" (kein Schwellwert angegeben) | Unklar |
| Turn-Verteilung | `participationImbalance` (Hoover-Index) delta ≥ 0.05 | `turn_share_gini` (Gini-Koeffizient) delta > 0.05 | **Andere Metrik!** |
| recovered = | risk AND (silent OR turn) | risk AND (silent OR turn) | Gleich |
| Partial | Ja (ANY of 3) | Nein | **Fehlt** |

**Hoover-Index vs. Gini-Koeffizient:** Beide messen Ungleichheit, haben aber unterschiedliche Skalen und Sensitivitäten. Ein Gini-Schwellwert von 0.05 ist nicht äquivalent zu einem Hoover-Schwellwert von 0.05.

---

### 5.2 PERSPECTIVE_BROADENING

| Kriterium | Alt (`postCheck.ts:90-120`) | Neu | Unterschied |
|-----------|---|---|---|
| Novelty delta | ≥ 0.10 | ≥ 0.10 | Gleich |
| Concentration delta | ≥ 0.08 | ≥ 0.08 | Gleich |
| Expansion check | Ja (für partial) | Nein | Fehlt |
| recovered = | novelty AND concentration | novelty AND concentration | Gleich |
| Score | Normalisierte Deltas | Rohe Deltas | Andere Berechnung |
| Partial | Ja | Nein | **Fehlt** |

---

### 5.3 REACTIVATION

| Kriterium | Alt (`postCheck.ts:124-154`) | Neu | Unterschied |
|-----------|---|---|---|
| Novelty delta | ≥ 0.10 | ≥ 0.10 | Gleich |
| Expansion | > 0 ODER delta ≥ 0.20 | > 0 ODER delta ≥ 0.20 | Gleich |
| **Stagnation** | **delta ≥ 30s** | **Fehlt komplett** | **FEHLT** |
| recovered = | novelty AND (expansion **OR stagnation**) | novelty AND expansion | **Strenger!** |
| Partial | Ja | Nein | **Fehlt** |

**Konsequenz:** Im alten System konnte eine REACTIVATION als "recovered" gelten, wenn Novelty stieg UND Stagnation um 30s sank (auch ohne Expansion-Verbesserung). Im neuen System ist das nicht möglich.

---

### 5.4 ALLY_IMPULSE

| Kriterium | Alt (`postCheck.ts:163-192`) | Neu | Unterschied |
|-----------|---|---|---|
| Novelty delta | ≥ **0.02** | ≥ **0.05** | **2.5x strenger** |
| Risk delta | ≥ **0.02** | ≥ **0.05** | **2.5x strenger** |
| Stagnation | ≥ 5s | **Fehlt** | **Entfernt** |
| Anzahl Kriterien | 3 (novelty OR risk OR stagnation) | 2 (novelty OR risk) | Weniger |
| recovered = | ANY of 3 | ANY of 2 | Strenger |

**Kontext-Unterschied:** Im alten System war ALLY_IMPULSE die Eskalation nach Moderator-Versagen — deshalb bewusst lockerere Schwellwerte (0.02). Im neuen System ist der Ally der Erst-Intervenierende — striktere Schwellwerte machen hier Sinn, falls die Eskalationskette bewusst entfernt wurde.

---

## 6. Transkript-Kontext

| Aspekt | Alt (`transcriptContext.ts`) | Neu |
|--------|---|---|
| Segmente für LLM | Letzte **50** Segmente | Letzte **15** Segmente |
| Vorherige Interventionen | Letzte **3** | Moderator: nicht spezifiziert, Ally: letzte **5** |

Weniger Kontext (15 vs 50 Segmente) könnte dazu führen, dass der Moderator wichtige frühere Aussagen nicht referenziert. 50 Segmente bieten mehr Gesprächsverlauf, können aber auch höhere Token-Kosten verursachen.

---

## 7. Architektur-Unterschiede

| Aspekt | Alt | Neu |
|--------|-----|-----|
| Runtime | Client-side (React Hooks, TypeScript) | Server-side (Python/FastAPI) |
| Tick-Loop | `setInterval(1000)` in `useDecisionLoop` | asyncio Task in `session_agent.py` |
| State-Speicher | React `useReducer` + Supabase | Python Objekt + DB |
| LLM-Aufrufe | Browser → Next.js API Route → OpenAI | Python → OpenAI direkt |
| TTS | Browser Web Speech API oder Cloud TTS | OpenAI TTS API → PCM → LiveKit AudioTrack |
| Audio-Zustellung | Browser-Audio (lokal) | LiveKit AudioTrack (alle Teilnehmer) |
| Multi-Tab | Leader Election (`useDecisionOwnership`) | Einzelner Server-Prozess (nicht nötig) |
| Metrik-Persistenz | Fire-and-forget POST an API Routes | Direkte DB-Schreibvorgänge |

---

## 8. Regel-Verletzungs-Prüfung

| Aspekt | Alt (`ruleViolationChecker.ts`) | Neu |
|--------|---|---|
| Throttle | 5s zwischen Checks | Nicht spezifiziert |
| Model | gpt-4o-mini via `/api/rule-check` | Nicht spezifiziert |
| Severity-Filter | Low ignoriert (nur medium/high) | Nicht spezifiziert |
| Cooldown | Kein Cooldown für Rule Violations | Nicht spezifiziert |
| Segmente | Letzte 15 neue Segmente | Nicht spezifiziert |
| Combined Prompt | Nein (separat behandelt) | **Ja** (Moderator + Regelverstoss in einem Satz) |

---

## 9. Zusammenfassung: Was muss geprüft/angepasst werden?

### Kritisch (kann das Verhalten fundamental ändern)

| # | Problem | Alt | Neu | Empfehlung |
|---|---------|-----|-----|------------|
| 1 | HEALTHY_ELABORATION: Concentration-Term invertiert | `0.15 * concentration` (hoch = gut) | `0.15 * (1-concentration)` (hoch = schlecht) | Im Backend-Code prüfen — falls invertiert, zurück auf alte Logik ändern |
| 2 | Fehlende Persistenz-Prüfung (70%-Check) | ≥70% Risk-Snapshots im Fenster nötig | Nur aktueller State zählt | Persistenz-Check einbauen — verhindert falsche Interventionen |
| 3 | Fehlende Ally-Eskalationskette | Moderator → Ally (2-stufig) | Ally statt Moderator (1-stufig) | Bewusste Entscheidung? Falls nicht, Eskalation wieder einbauen |
| 4 | REACTIVATION Recovery ohne Stagnation | novelty AND (expansion OR stagnation) | novelty AND expansion | Stagnation-Kriterium wieder hinzufügen |

### Wichtig (kann Ergebnisse beeinflussen)

| # | Problem | Empfehlung |
|---|---------|------------|
| 5 | Fehlende Fatigue-basierte adaptive Zeiten | Einbauen — verhindert Frustration durch wiederholte wirkungslose Interventionen |
| 6 | Fehlendes Partial-Recovery-Konzept | Einbauen — vermeidet unnötige 180s Cooldowns bei teilweiser Verbesserung |
| 7 | ALLY_IMPULSE Schwellwerte 2.5x strenger (0.02 → 0.05) | OK falls Ally jetzt Erst-Intervenierer ist; problematisch falls noch als Eskalation gedacht |
| 8 | HEALTHY_ELABORATION Expansion-Bonus viel kleiner (max 1.0 → max 0.3) | Formel prüfen — alte Range hatte mehr Differenzierungskraft |
| 9 | `participationImbalance` (Hoover) → `turn_share_gini` (Gini) | Unterschiedliche Metriken! Schwellwert 0.05 muss ggf. kalibriert werden |

### Zu verifizieren (unklar ob Dok-Lücke oder echte Differenz)

| # | Frage | Wie prüfen |
|---|-------|------------|
| 10 | Hard Gate bei HEALTHY_EXPLORATION (`risk > 0.5`) — fehlt im Dok | Backend-Code (`state_inference.py` o.ä.) prüfen |
| 11 | `diversityDevelopment` → `diversity` — gleiche Berechnung? | Backend-Metrik-Code vergleichen |
| 12 | Fehlende Clamps in Formeln — Dok-Ungenauigkeit oder tatsächlich kein Clamping? | Backend-Code prüfen |
