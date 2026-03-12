# Interventionssystem — Vollstaendige Dokumentation

Diese Dokumentation erklaert das gesamte Interventionssystem der Brainstorming-Webapp:
Wie erkennt das System Probleme? Wann greift es ein? Was passiert in Szenario A vs. B?
Wie funktioniert der Rule-Checker? Was bedeuten all die Begriffe?

Alles wird Schritt fuer Schritt erklaert, mit konkreten Zeitangaben und Beispielen.

> **Hinweis:** Die Metriken selbst (wie Novelty, Participation Risk usw. berechnet werden)
> sind in `docs/metrics-documentation.md` dokumentiert. Dieses Dokument erklaert, was
> **nach** der Berechnung passiert — also die Entscheidungslogik.

---

## Inhaltsverzeichnis

1. [Ueberblick: Die drei Szenarien](#1-ueberblick-die-drei-szenarien)
2. [Grundbegriffe einfach erklaert](#2-grundbegriffe-einfach-erklaert)
3. [Der Gesamtablauf auf einen Blick](#3-der-gesamtablauf-auf-einen-blick)
4. [Schritt 1: Metriken berechnen](#4-schritt-1-metriken-berechnen)
5. [Schritt 2: Gespraechszustand erkennen (State Inference)](#5-schritt-2-gespraechszustand-erkennen)
6. [Schritt 3: Die Entscheidungs-Engine (Decision Loop)](#6-schritt-3-die-entscheidungs-engine)
7. [Die vier Phasen der Engine im Detail](#7-die-vier-phasen-der-engine-im-detail)
8. [Szenario A im Detail: Nur Moderator](#8-szenario-a-im-detail)
9. [Szenario B im Detail: Moderator + Ally](#9-szenario-b-im-detail)
10. [Baseline-Szenario: Keine Interventionen](#10-baseline-szenario)
11. [Der Rule-Checker (Brainstorming-Regeln)](#11-der-rule-checker)
12. [Das Fatigue-System (Ermuedungserkennung)](#12-das-fatigue-system)
13. [Recovery-Pruefung: Hat die Intervention gewirkt?](#13-recovery-pruefung)
14. [Alle Sicherheitsmechanismen](#14-alle-sicherheitsmechanismen)
15. [Vollstaendige Zeittabelle](#15-vollstaendige-zeittabelle)
16. [Welche Metriken fliessen wo ein?](#16-welche-metriken-fliessen-wo-ein)
17. [Dateien und Code-Referenzen](#17-dateien-und-code-referenzen)
18. [Glossar](#18-glossar)

---

## 1. Ueberblick: Die drei Szenarien

Die Webapp unterstuetzt drei experimentelle Szenarien fuer Brainstorming-Sessions:

### Baseline (Kontrollgruppe)
- Das System **beobachtet und misst** alles (Metriken, Zustaende, Regelverstoesse)
- Es werden aber **keine Interventionen** an die Teilnehmer ausgegeben
- Alle Daten werden fuer die spaetere Analyse gespeichert
- Zweck: Vergleichsgruppe ohne KI-Einfluss

### Szenario A: Nur Moderator
- Ein **KI-Moderator** greift ein, wenn ein Problem erkannt und bestaetigt wird
- Der Moderator gibt textbasierte Hinweise (optional mit Sprachausgabe)
- Beispiel: "Es waere bereichernd, noch mehr Perspektiven zu hoeren."
- Wenn die Intervention **nicht wirkt**, passiert nichts weiter — das System wartet ab (Cooldown) und versucht es spaeter erneut

### Szenario B: Moderator + Ally-Eskalation
- Wie Szenario A: Zuerst greift der **KI-Moderator** ein
- Wenn die Moderator-Intervention **nicht wirkt** (keine Verbesserung nach 180 Sekunden), wird **eskaliert**
- Ein **Ally** (ein als Teilnehmer getarnter KI-Agent) bringt dann einen **kreativen Impuls** ein
- Der Ally spricht wie ein normaler Teilnehmer, nicht wie ein Moderator
- Beispiel: "Was waere, wenn wir das Ganze aus einem voellig unerwarteten Blickwinkel betrachten?"

```
Baseline:  Beobachten → Messen → Loggen → (keine Aktion)

Szenario A:  Beobachten → Messen → Problem erkennen → Bestaetigen → Moderator greift ein → Pruefen ob es gewirkt hat → Pause

Szenario B:  Beobachten → Messen → Problem erkennen → Bestaetigen → Moderator greift ein → Pruefen → Nicht gewirkt? → Ally eskaliert → Pruefen → Pause
```

---

## 2. Grundbegriffe einfach erklaert

### Was ist eine "Intervention"?
Eine Intervention ist eine Nachricht, die das System an die Brainstorming-Teilnehmer sendet.
Sie erscheint als Text im Chat und kann optional vorgelesen werden (Text-to-Speech).
Ziel: Das Gespraech in eine bessere Richtung lenken, ohne es zu unterbrechen.

### Was ist der "Decision Owner"?
In einer Session mit mehreren Teilnehmern laeuft die Entscheidungs-Engine nur auf **einem** Client
(dem des Session-Hosts). Dieser Client heisst "Decision Owner". Er berechnet die Metriken,
erkennt Probleme und loest Interventionen aus. Die anderen Clients empfangen die Interventionen
ueber LiveKit Data Channels.

### Was ist ein "Tick"?
Ein Tick ist ein einzelner Durchlauf der Entscheidungs-Engine. Die Engine laeuft in einer
Endlosschleife und prueft jede Sekunde, ob etwas zu tun ist. Ein Tick ist also ein
Auswertungszyklus von ca. 1 Sekunde.

### Was ist ein "Snapshot"?
Ein Snapshot ist eine Momentaufnahme aller Metriken zu einem bestimmten Zeitpunkt.
Alle 5 Sekunden wird ein neuer Snapshot berechnet. Diese Snapshots werden in einem Array
gespeichert und fuer Trendanalysen (z.B. "Wird es besser oder schlechter?") verwendet.

### Was ist eine "Phase"?
Die Entscheidungs-Engine befindet sich immer in genau einer von vier Phasen:
MONITORING, CONFIRMING, POST_CHECK oder COOLDOWN. Die Phase bestimmt, was die Engine
gerade tut. Mehr dazu in [Abschnitt 7](#7-die-vier-phasen-der-engine-im-detail).

### Was ist der "Inferred State" (erkannter Gespraechszustand)?
Basierend auf den Metriken klassifiziert das System das Gespraech in einen von fuenf Zustaenden:

| Zustand | Bedeutung | Aktion noetig? |
|---------|-----------|---------------|
| **HEALTHY_EXPLORATION** | Alle beteiligen sich, neue Ideen fliessen | Nein |
| **HEALTHY_ELABORATION** | Ideen werden produktiv vertieft | Nein |
| **DOMINANCE_RISK** | Eine Person dominiert, andere sind still | Ja |
| **CONVERGENCE_RISK** | Alle reden ueber das Gleiche, kaum Neues | Ja |
| **STALLED_DISCUSSION** | Gespraech stockt komplett | Ja |

Die drei "Risk"-Zustaende koennen eine Intervention ausloesen.
Die beiden "Healthy"-Zustaende bedeuten: Alles in Ordnung, weiter beobachten.

### Was ist ein "Intent"?
Der Intent beschreibt, **was** eine Intervention bewirken soll. Jeder Risk-Zustand
hat einen passenden Intent:

| Zustand → | Intent | Was soll passieren? |
|-----------|--------|-------------------|
| DOMINANCE_RISK → | PARTICIPATION_REBALANCING | Stille Teilnehmer ermutigen, sich einzubringen |
| CONVERGENCE_RISK → | PERSPECTIVE_BROADENING | Neue Denkrichtungen anregen |
| STALLED_DISCUSSION → | REACTIVATION | Das Gespraech wieder in Gang bringen |
| (Eskalation) → | ALLY_IMPULSE | Kreativer Impuls als Teilnehmer (nur Szenario B) |
| (Regelverstoss) → | NORM_REINFORCEMENT | An Brainstorming-Regeln erinnern |

### Was ist "Confidence" (Konfidenz)?
Ein Wert zwischen 0 und 1, der ausdrueckt, wie sicher sich das System ist, dass ein
bestimmter Zustand vorliegt. Beispiel: "DOMINANCE_RISK mit Confidence 0.72" bedeutet:
Das System ist zu 72% sicher, dass eine Person dominiert.

Nur wenn die Confidence mindestens **0.45** (45%) betraegt, wird der Zustand als
handlungsrelevant betrachtet.

### Was ist "Recovery" (Erholung)?
Nach einer Intervention prueft das System, ob sich die Situation verbessert hat.
Dafuer vergleicht es die aktuellen Metriken mit den Metriken zum Zeitpunkt der Intervention.
Drei moegliche Ergebnisse:
- **recovered**: Die Situation hat sich deutlich verbessert
- **partial**: Leichte Verbesserung, aber nicht vollstaendig
- **not_recovered**: Keine Verbesserung — evtl. Eskalation noetig (Szenario B)

---

## 3. Der Gesamtablauf auf einen Blick

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATENFLUSS                                    │
│                                                                      │
│  Audio/Transkript                                                    │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────────┐    alle 5 Sekunden                        │
│  │  Metriken berechnen   │◄─────────────────                        │
│  │  (useMetricsComputation)│                                         │
│  │                        │                                          │
│  │  • Participation Risk  │                                          │
│  │  • Novelty Rate        │                                          │
│  │  • Cluster Concentration│                                         │
│  │  • Stagnation Duration │                                          │
│  │  • Diversity           │                                          │
│  │  • und weitere...      │                                          │
│  └──────────┬─────────────┘                                          │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────┐                                            │
│  │  Zustand ableiten     │    nach jeder Metrik-Berechnung          │
│  │  (inferConversationState)│                                        │
│  │                        │                                          │
│  │  → z.B. DOMINANCE_RISK │                                         │
│  │    mit Confidence 0.72 │                                          │
│  └──────────┬─────────────┘                                          │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────┐    jede Sekunde                           │
│  │  Entscheidungs-Engine │◄─────────────────                        │
│  │  (useDecisionLoop)    │                                           │
│  │                        │                                          │
│  │  Phase: MONITORING     │                                          │
│  │  → CONFIRMING          │                                          │
│  │  → INTERVENTION        │                                          │
│  │  → POST_CHECK          │                                          │
│  │  → COOLDOWN            │                                          │
│  └──────────┬─────────────┘                                          │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────┐                                            │
│  │  Intervention senden  │    bei Bedarf                            │
│  │  (interventionExecutor)│                                          │
│  │                        │                                          │
│  │  • LLM-Text generieren│                                          │
│  │  • TTS (optional)     │                                           │
│  │  • In Supabase speichern│                                         │
│  │  • An alle Clients     │                                          │
│  └────────────────────────┘                                          │
│                                                                      │
│  Parallel und unabhaengig:                                           │
│  ┌──────────────────────┐    alle 15 Sekunden                       │
│  │  Rule-Checker         │◄─────────────────                        │
│  │  (ruleViolationChecker)│                                          │
│  │                        │                                          │
│  │  Prueft Brainstorming- │                                          │
│  │  Regeln via LLM        │                                          │
│  └────────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Timing-Uebersicht

| Was | Wie oft | Stagger-Offset |
|-----|---------|---------------|
| Metriken berechnen | Alle **5 Sekunden** | 0.5s nach Session-Start |
| Entscheidungs-Engine | Jede **1 Sekunde** | 1.5s nach Session-Start |
| Rule-Checker | Alle **15 Sekunden** | (asynchron, kein fester Offset) |
| Metriken in Supabase speichern | Alle **30 Sekunden** | (throttled) |

Die Stagger-Offsets verhindern, dass alle Berechnungen gleichzeitig starten
(wuerde zu Lastspitzen fuehren).

---

## 4. Schritt 1: Metriken berechnen

**Datei:** `lib/hooks/useMetricsComputation.ts` → `lib/metrics/computeMetrics.ts`

Alle 5 Sekunden werden folgende Metriken ueber ein **rollendes 300-Sekunden-Fenster** berechnet:

### Basis-Metriken (Legacy, weiterhin berechnet)

| Metrik | Beschreibung | Wertebereich |
|--------|-------------|-------------|
| `speakingTimeDistribution` | Redezeit pro Sprecher (Zeichen oder Audio-Sekunden) | Absolute Werte |
| `participationImbalance` | Hoover-Index der Redezeit-Verteilung | 0–1 (0=gleich) |
| `semanticRepetitionRate` | Wie stark sich aufeinanderfolgende Beitraege wiederholen | 0–1 (0=keine Wiederholung) |
| `stagnationDuration` | Sekunden seit dem letzten semantisch neuen Beitrag | 0–∞ Sekunden |
| `diversityDevelopment` | Vokabular-Vielfalt (MATTR) | 0–1 (1=sehr vielfaeltig) |

### v2-Metriken: Participation (detaillierte Teilnahme-Analyse)

Berechnet ueber das 300s-Fenster, mit zusaetzlichem 600s-Fenster fuer kumulative Werte:

| Metrik | Beschreibung | Wertebereich |
|--------|-------------|-------------|
| `volumeShare` | Wortanzahl-Anteil pro Sprecher | 0–1 pro Sprecher (Summe=1) |
| `turnShare` | Turn-Anteil pro Sprecher (ohne Backchannels) | 0–1 pro Sprecher |
| `silentParticipantRatio` | Anteil der Teilnehmer mit <10% Redeanteil | 0–1 |
| `dominanceStreakScore` | Wie stark eine Person aufeinanderfolgende Turns monopolisiert | 0–1 |
| `participationRiskScore` | Gewichteter Composite aus allen vier obigen Werten | 0–1 |
| `cumulativeParticipationImbalance` | Hoover-Index ueber 600s statt 300s | 0–1 |

Der **participationRiskScore** ist der wichtigste Einzelwert fuer Dominanz-Erkennung:
```
0.35 × hooverImbalance + 0.25 × silentRatio + 0.25 × streakScore + 0.15 × turnHoover
```

Warum ein 600s-Fenster fuer `cumulativeParticipationImbalance`?
→ Damit eine Person, die 5 Minuten lang dominiert hat und dann 2 Minuten still ist,
  trotzdem noch als problematisch erkannt wird ("Dominanz-Amnesie" verhindern).

### v2-Metriken: Semantic Dynamics (Ideen-Raum-Analyse)

Nutzt OpenAI Embeddings (text-embedding-3-small), Jaccard-Fallback bei API-Fehler:

| Metrik | Beschreibung | Wertebereich |
|--------|-------------|-------------|
| `noveltyRate` | Anteil der Beitraege, die inhaltlich neu sind | 0–1 (1=alles neu) |
| `clusterConcentration` | Wie stark sich Themen auf wenige Cluster konzentrieren (nHHI) | 0–1 (1=nur ein Thema) |
| `explorationElaborationRatio` | Neue Richtungen vs. Vertiefung bestehender Ideen | 0–1 (1=nur Exploration) |
| `semanticExpansionScore` | Waechst oder schrumpft der Ideenraum? (Trend-Vergleich mit letzten 12 Snapshots) | -1 bis +1 |
| `ideationalFluencyRate` | Substantive Turns pro Minute (Osborns "Quantitaet zuerst") | 0–∞ |
| `piggybackingScore` | Bauen Sprecher aufeinander auf? (Cross-Speaker-Aehnlichkeit) | 0–1 |

**Hinweis zu `piggybackingScore`:** Wird berechnet und geloggt, fliesst aber derzeit in
**keine Entscheidung** ein. Er dient rein der Forschungsanalyse.

### Danach: State Inference

Nach jeder Metrik-Berechnung wird `inferConversationState()` aufgerufen.
Das Ergebnis (z.B. "DOMINANCE_RISK, Confidence 0.72") wird an den Snapshot angehaengt
und steht der Entscheidungs-Engine zur Verfuegung.

---

## 5. Schritt 2: Gespraechszustand erkennen

**Datei:** `lib/state/inferConversationState.ts`

### Wie funktioniert die Zustandserkennung?

Fuer **jeden** der 5 moeglichen Zustaende wird ein Confidence-Wert (0–1) berechnet.
Der Zustand mit der hoechsten Confidence "gewinnt".

### Die fuenf Formeln

#### HEALTHY_EXPLORATION — "Alles laeuft gut, neue Ideen fliessen"

```
Vorbedingung: participationRiskScore muss ≤ 0.5 sein (sonst Confidence = 0)

Confidence = (
    0.25 × (1 - participationRiskScore)     ← Gute Teilnahme-Balance
  + 0.30 × noveltyRate                      ← Viele neue Ideen (staerkstes Signal)
  + 0.20 × clamp(expansionScore + 0.5)      ← Ideenraum waechst
  + 0.25 × explorationElaborationRatio      ← Viel Exploration
) × (1 - stagnationPenalty)                  ← Abzug bei Stagnation

stagnationPenalty = clamp(stagnationDuration / 120, 0, 1)
  → 0s Stagnation = kein Abzug
  → 60s Stagnation = 50% Abzug
  → 120s+ Stagnation = voller Abzug (Confidence → 0)
```

#### HEALTHY_ELABORATION — "Ideen werden produktiv vertieft"

```
Vorbedingung: participationRiskScore muss ≤ 0.5 sein (sonst Confidence = 0)

Confidence = (
    0.20 × (1 - participationRiskScore)     ← Gute Balance
  + 0.25 × (1 - noveltyRate)                ← WENIG Neuheit = Vertiefung (!)
  + 0.25 × (1 - explorationElaborationRatio)← WENIG Exploration = Elaboration (!)
  + 0.15 × (1 - clusterConcentration)       ← Themen nicht zu eng
  + 0.15 × clamp(expansionScore + 0.3)      ← Ideenraum stabil oder wachsend
) × (1 - stagnationPenalty)
```

Wichtig: Hier sind niedrige Novelty und niedrige Exploration **gut** — sie bedeuten,
dass existierende Ideen vertieft werden (im Gegensatz zu CONVERGENCE_RISK, wo der
Ideenraum gleichzeitig **schrumpft**).

#### DOMINANCE_RISK — "Eine Person uebernimmt das Gespraech"

```
Confidence =
    0.30 × participationRiskScore              ← Composite-Risiko
  + 0.25 × silentParticipantRatio              ← Stille Teilnehmer
  + 0.20 × dominanceStreakScore                ← Monolog-Serien
  + 0.25 × cumulativeParticipationImbalance    ← Langzeit-Ungleichheit (600s)
```

Keine Vorbedingung, kein Stagnation-Abzug. Verwendet bewusst den **kumulativen** (600s)
Imbalance-Wert, damit kurzfristige Balance die Langzeit-Dominanz nicht ueberdeckt.

#### CONVERGENCE_RISK — "Alle reden ueber das Gleiche, Ideenraum schrumpft"

```
Confidence =
    0.25 × clusterConcentration                ← Wenige Themen-Cluster
  + 0.20 × (1 - noveltyRate)                  ← Kaum neue Ideen
  + 0.20 × (1 - explorationElaborationRatio)  ← Nur noch Elaboration
  + 0.35 × clamp(-semanticExpansionScore)      ← Ideenraum SCHRUMPFT (staerkstes Signal!)
```

Der **entscheidende Unterschied** zu HEALTHY_ELABORATION: Bei CONVERGENCE_RISK ist der
`semanticExpansionScore` **negativ** (der Ideenraum schrumpft). Bei HEALTHY_ELABORATION
ist er stabil oder positiv.

#### STALLED_DISCUSSION — "Nichts passiert mehr"

```
Confidence =
    0.20 × (1 - noveltyRate)                  ← Keine neuen Ideen
  + 0.25 × clamp(stagnation / 180)            ← Lange Stille (staerkstes Signal)
  + 0.20 × clamp(-semanticExpansionScore)      ← Ideenraum schrumpft
  + 0.15 × (1 - diversityDevelopment)          ← Wenig Vokabular-Vielfalt
  + 0.20 × fluencyPenalty                      ← Wenige Wortbeitraege pro Minute

fluencyPenalty = clamp(1 - ideationalFluencyRate / 6, 0, 1)
  → 0 Turns/Minute = Penalty 1.0 (volle Strafe)
  → 3 Turns/Minute = Penalty 0.5
  → 6+ Turns/Minute = Penalty 0.0 (keine Strafe)
```

### Schutzmechanismen bei der Zustandserkennung

**1. Hysterese (Schwelle: 0.08)**
Verhindert schnelles Hin-und-Her-Wechseln zwischen Zustaenden.
Ein neuer Zustand muss mindestens **8 Prozentpunkte** mehr Confidence haben als der aktuelle,
um den aktuellen abzuloesen.

Beispiel: Aktueller Zustand ist DOMINANCE_RISK (Confidence 0.55).
HEALTHY_EXPLORATION hat Confidence 0.60. Differenz = 0.05 < 0.08 → Kein Wechsel!
Erst bei 0.63+ wuerde gewechselt.

**2. Tiebreaking (Schwelle: 0.03)**
Wenn zwei Zustaende fast gleiche Confidence haben (Differenz <3%), gewinnt der
**riskantere** Zustand. Das System entscheidet also im Zweifelsfall lieber fuer
"Problem erkannt" als fuer "Alles okay".

Prioritaetsreihenfolge bei Gleichstand:
STALLED_DISCUSSION > DOMINANCE_RISK > CONVERGENCE_RISK > HEALTHY_EXPLORATION > HEALTHY_ELABORATION

**3. Mindest-Confidence (0.45)**
Ein Risk-Zustand muss mindestens 45% Confidence haben, damit die Entscheidungs-Engine
ihn als handlungsrelevant betrachtet. Darunter wird er ignoriert.

---

## 6. Schritt 3: Die Entscheidungs-Engine (Decision Loop)

**Datei:** `lib/hooks/useDecisionLoop.ts` + `lib/decision/interventionPolicy.ts`

Die Engine laeuft **jede Sekunde** und fuehrt folgende Schritte aus:

### Was passiert in jedem Tick?

```
1. Housekeeping
   └→ Alte Intervention-Timestamps entfernen (aelter als 10 Minuten)

2. Rule-Checker (parallel, alle 15s)
   └→ LLM-Aufruf: Verstoesst jemand gegen Brainstorming-Regeln?
   └→ Wenn ja: Violation in Warteschlange

3. Policy Engine
   └→ Aktuellen Zustand + Metriken auswerten
   └→ Je nach Phase: Beobachten / Bestaetigen / Pruefen / Abkuehlen

4. Intervention feuern (wenn noetig)
   └→ Budget pruefen (max 3 pro 10 Min)
   └→ Cooldown pruefen
   └→ LLM-Text generieren
   └→ An Teilnehmer senden
```

### Wann wird NICHT eingegriffen?

Die Engine hat mehrere Schutzebenen, die Interventionen blockieren:

| Pruefung | Bedingung | Ergebnis |
|----------|-----------|---------|
| Szenario-Check | `scenario === 'baseline'` | Alles loggen, nie eingreifen |
| Budget-Check | ≥ 3 Interventionen in den letzten 10 Minuten | Blockiert |
| Cooldown-Check | `cooldownUntil` noch nicht abgelaufen | Blockiert |
| Confidence-Check | Risk-State Confidence < 0.45 | Ignoriert |
| Persistence-Check | Risk-State nicht ≥70% der Snapshots im Confirmation-Fenster | Timer resetten |
| Zu wenig Sprecher | < 2 aktive Sprecher in letzten 60s | Rule-Checks unterdrueckt |

---

## 7. Die vier Phasen der Engine im Detail

Die Engine befindet sich immer in genau einer Phase. Die Phasen bilden einen Kreislauf:

```
┌────────────┐                      ┌────────────┐
│  MONITORING │───── Risk erkannt ──→│ CONFIRMING  │
│             │                      │             │
│  Beobachten │◄── Kein Risk mehr ──│ 45s warten  │
└──────┬──────┘                      └──────┬──────┘
       │                                     │
       │  Cooldown                           │ 45s bestaetigt +
       │  abgelaufen                         │ ≥70% persistent
       │                                     │
┌──────┴──────┐                      ┌───────▼──────┐
│   COOLDOWN   │◄───────────────────│  POST_CHECK   │
│              │   Nicht recovered   │               │
│  180s Pause  │   (Szenario A)     │  180s warten  │
│              │   oder nach Ally    │  dann pruefen │
└──────────────┘                     └───────────────┘
```

### Phase 1: MONITORING — "Alles beobachten"

**Was passiert:**
- Die Engine prueft jeden Tick (jede Sekunde) den aktuellen Gespraechszustand
- Wenn der Zustand "gesund" ist (HEALTHY_EXPLORATION oder HEALTHY_ELABORATION): Nichts tun
- Wenn ein Risk-Zustand erkannt wird (Confidence ≥ 0.45): Uebergang zu CONFIRMING

**Dauer:** Unbegrenzt (solange kein Problem erkannt wird)

### Phase 2: CONFIRMING — "Problem bestaetigen"

**Was passiert:**
- Die Engine hat einen Risk-Zustand erkannt und startet einen Timer
- Der Risk-Zustand muss **mindestens 45 Sekunden lang anhalten** (CONFIRMATION_SECONDS)
- Zusaetzlich muss der Zustand **persistent** sein: Mindestens **70%** aller Metrik-Snapshots
  im Bestaetigungsfenster muessen einen Risk-Zustand zeigen

**Warum 70% und nicht 100%?**
Brainstorming ist dynamisch. Es kann kurze gesunde Momente geben, auch wenn das
Gesamtbild problematisch ist. 70% bedeutet: Von den ~9 Snapshots in 45 Sekunden
(ein Snapshot alle 5 Sekunden) muessen mindestens ~6 einen Risk-Zustand zeigen.

**Besonderheit: "Jeder Risk-Zustand zaehlt"**
Die Gruppe kann zwischen verschiedenen Risk-Zustaenden oszillieren (z.B. abwechselnd
STALLED_DISCUSSION und CONVERGENCE_RISK). Beide zaehlen fuer die 70%-Schwelle!
Wenn die Schwelle erreicht ist, wird der **haeufigste** Risk-Zustand als Ziel verwendet.

**Was passiert bei Zustandswechsel?**
Wenn der Zustand wieder gesund wird: Timer wird zurueckgesetzt → zurueck zu MONITORING.
Wenn ein anderer Risk-Zustand auftritt: Timer wird neu gestartet.

**Dauer:** Mindestens 45 Sekunden (laenger bei Fatigue, siehe [Abschnitt 12](#12-das-fatigue-system))

### Phase 3: POST_CHECK — "Hat die Intervention gewirkt?"

**Was passiert:**
- Die Intervention wurde gerade gesendet
- Die Engine wartet eine definierte Zeit und vergleicht dann die aktuellen Metriken
  mit den Metriken zum Zeitpunkt der Intervention

**Wartezeit:**
- Nach Moderator-Intervention: **180 Sekunden** (POST_CHECK_SECONDS)
- Nach Ally-Intervention: **60 Sekunden** (verkuerzt, weil der Ally der letzte Eskalationsschritt ist)

**Warum 60s statt 180s fuer den Ally?**
Das Metriken-Fenster ist 300 Sekunden breit. Wenn der Ally vor 60 Sekunden eingegriffen hat,
stammen 4/5 der Daten im Fenster von VOR der Intervention. Um trotzdem eine Verbesserung
zu erkennen, sind die Recovery-Schwellen fuer den Ally stark **reduziert** (ca. 1/3 der normalen Werte).
So kann genuine Verbesserung in den 60 Post-Intervention-Sekunden die Gesamtmetriken ausreichend verschieben.

**Moegliche Ergebnisse:**
Siehe [Abschnitt 13: Recovery-Pruefung](#13-recovery-pruefung).

### Phase 4: COOLDOWN — "Pause"

**Was passiert:**
- Das System macht eine Zwangspause und greift nicht ein
- Verhindert, dass Teilnehmer von staendigen Interventionen genervt werden
- Nach Ablauf: Zurueck zu MONITORING

**Dauer:** 180 Sekunden (COOLDOWN_SECONDS), kann durch Fatigue auf 270s oder 360s steigen

**Wann wird Cooldown gesetzt?**
Der Cooldown-Timer startet **zum Zeitpunkt der Intervention**, nicht erst wenn POST_CHECK endet.
Das bedeutet: Wenn POST_CHECK 180s dauert und Cooldown 180s ist, ist der Cooldown nach
dem POST_CHECK oft schon abgelaufen. Die Engine geht dann direkt zurueck zu MONITORING.

---

## 8. Szenario A im Detail

### Kompletter Zeitablauf eines typischen Eingriffs

```
Zeitpunkt  Was passiert
─────────  ────────────────────────────────────────────────────────

t=0s       Session startet. Engine ist in Phase MONITORING.

t=45s      Metriken zeigen: Eine Person hat 75% der Redezeit.
           State Inference: DOMINANCE_RISK (Confidence 0.68)
           → Engine wechselt zu Phase CONFIRMING
           → Timer startet: 45 Sekunden bestaetigen

t=50s      Confidence 0.65 — immer noch DOMINANCE_RISK ✓
t=55s      Confidence 0.70 — immer noch DOMINANCE_RISK ✓
t=60s      Kurz HEALTHY_EXPLORATION (Confidence 0.52) — zaehlt als nicht-Risk-Snapshot
t=65s      Confidence 0.66 — wieder DOMINANCE_RISK ✓
t=70s      Confidence 0.71 — DOMINANCE_RISK ✓
t=75s      Confidence 0.68 — DOMINANCE_RISK ✓
t=80s      Confidence 0.72 — DOMINANCE_RISK ✓
t=85s      Confidence 0.67 — DOMINANCE_RISK ✓

t=90s      45 Sekunden sind um. Persistence-Check:
           9 Snapshots im Fenster, davon 8 Risk-Zustaende = 89% ≥ 70% ✓
           → Budget-Check: 0 von 3 Interventionen verbraucht ✓
           → Cooldown-Check: Kein Cooldown aktiv ✓

           ★ INTERVENTION FEUERT ★
           Intent: PARTICIPATION_REBALANCING
           API-Aufruf: POST /api/intervention/moderator
           → LLM generiert: "Es waere bereichernd, noch mehr Perspektiven
              zu hoeren. Wer moechte noch etwas beitragen?"
           → Text erscheint im Chat (optional: TTS spricht vor)
           → Intervention wird in Supabase gespeichert

           → Engine wechselt zu Phase POST_CHECK
           → Cooldown-Timer: 180s ab jetzt
           → Metriken zum Zeitpunkt der Intervention werden gespeichert

t=90s–270s POST_CHECK laeuft (180 Sekunden)
           Die Engine beobachtet weiter, greift aber nicht ein.

t=270s     POST_CHECK abgelaufen. Recovery-Pruefung:

           FALL A: Verbesserung erkannt (Recovery Score ≥ 0.15)
           → Ergebnis: "recovered" oder "partial"
           → Engine geht zurueck zu MONITORING
           → Intervention wird als erfolgreich markiert

           FALL B: Keine Verbesserung (Recovery Score < 0.05)
           → Ergebnis: "not_recovered"
           → In Szenario A: KEINE Eskalation moeglich
           → Engine geht zu COOLDOWN
           → Cooldown ist schon seit t=90s aktiv (180s)
           → Cooldown endet bei t=270s — also sofort zurueck zu MONITORING!

t=270s+    Engine ist wieder in MONITORING
           Kann erneut Risk erkennen → neuer Zyklus beginnt
```

### Szenario A zusammengefasst

- Nur **Moderator**-Interventionen
- Bei Nicht-Recovery: Direkt zu Cooldown → Monitoring (keine Eskalation)
- Typischer Zyklus: ~45s Confirming + 180s PostCheck = **~225 Sekunden** bis naechster Eingriff moeglich
- Minimum zwischen zwei Interventionen: **180 Sekunden** (Cooldown)

---

## 9. Szenario B im Detail

### Kompletter Zeitablauf mit Eskalation

```
Zeitpunkt    Was passiert
───────────  ────────────────────────────────────────────────────────

t=0s–90s     Identisch zu Szenario A:
             MONITORING → CONFIRMING (45s) → Intervention feuert

t=90s        ★ MODERATOR-INTERVENTION FEUERT ★
             Intent: z.B. PARTICIPATION_REBALANCING
             → Engine in Phase POST_CHECK (180s)
             → Cooldown: 180s

t=90s–270s   POST_CHECK laeuft (180 Sekunden)

t=270s       POST_CHECK abgelaufen. Recovery-Pruefung:

             FALL A: Verbesserung → "recovered" → MONITORING (wie Szenario A)

             FALL B: Keine Verbesserung → "not_recovered"
             → Szenario B hat eine ZUSAETZLICHE Option: Ally-Eskalation!

             ★ ALLY-INTERVENTION FEUERT ★
             Intent: ALLY_IMPULSE
             API-Aufruf: POST /api/intervention/ally
             → LLM generiert: "Was waere, wenn wir das Ganze aus einem
                voellig unerwarteten Blickwinkel betrachten?"
             → Der Ally spricht wie ein TEILNEHMER, nicht wie ein Moderator
             → Engine bleibt in Phase POST_CHECK (diesmal nur 60s!)
             → Neuer Cooldown: 180s ab jetzt

t=270s–330s  Ally POST_CHECK laeuft (nur 60 Sekunden)

t=330s       Ally POST_CHECK abgelaufen. Recovery-Pruefung:
             (mit REDUZIERTEN Schwellen, da nur 60s Daten)

             FALL B1: Verbesserung → "recovered" → MONITORING

             FALL B2: Keine Verbesserung → "not_recovered"
             → Keine weitere Eskalation moeglich (Ally war der letzte Schritt)
             → Engine geht zu COOLDOWN
             → Cooldown laeuft seit t=270s (180s)
             → Endet bei t=450s

t=450s       Cooldown abgelaufen → zurueck zu MONITORING
```

### Szenario B zusammengefasst

- Erst **Moderator**, dann bei Bedarf **Ally**-Eskalation
- Ally spricht als **Teilnehmer**, nicht als Moderator (anderer Tonfall, andere Prompts)
- Ally Post-Check ist **kuerzer** (60s statt 180s) mit **relaxierten** Recovery-Schwellen
- **Maximal eine** Ally-Eskalation pro Zyklus (kein Ally nach Ally)
- Typischer Zyklus mit Eskalation: ~45s + 180s + 60s = **~285 Sekunden**
- Worst Case bis wieder frei: ~45s + 180s + 60s + Cooldown = **~465 Sekunden** (~7.75 Min)

### Warum ist der Ally-PostCheck kuerzer?

Zwei Gruende:
1. **Gesamtdauer begrenzen:** Moderator (180s PostCheck) + Ally (180s PostCheck) waere 360s = 6 Minuten reines Warten. Das ist zu lang — das Problem koennte sich laengst veraendert haben.
2. **Letzter Eskalationsschritt:** Nach dem Ally gibt es keine weitere Eskalation. Es macht keinen Sinn, 3 Minuten zu warten, wenn danach sowieso nur Cooldown kommt.

### Warum sind die Ally-Recovery-Schwellen relaxiert?

Das Metriken-Fenster ist 300 Sekunden breit. Nach nur 60 Sekunden Ally-PostCheck stammen
4/5 der Daten von **vor** der Ally-Intervention. Eine echte Verbesserung in den 60 neuen
Sekunden muss gegen 240 Sekunden "alte" Daten ankommen. Deshalb sind die Schwellen ca. 3x
niedriger:

| Metrik | Normale Schwelle | Ally-Schwelle |
|--------|-----------------|--------------|
| Novelty-Verbesserung | +0.10 | +0.02 |
| Risk-Score-Reduktion | -0.15 (relativ) | -0.02 |
| Stagnation-Reduktion | -30 Sekunden | -5 Sekunden |

---

## 10. Baseline-Szenario

### Was passiert im Baseline-Szenario?

**Alles ausser dem eigentlichen Eingreifen:**

| Komponente | Aktiv? | Bemerkung |
|-----------|--------|----------|
| Metriken-Berechnung | ✅ Ja | Identisch zu A/B |
| State Inference | ✅ Ja | Identisch zu A/B |
| Decision Engine | ✅ Ja | Laeuft, loggt Entscheidungen |
| Rule-Checker | ✅ Ja | Erkennt Verstoesse, loggt sie |
| Intervention senden | ❌ Nein | Wird explizit blockiert |
| Supabase-Logging | ✅ Ja | Alle Metriken + States gespeichert |

**Zweck:**
Die Baseline-Gruppe dient als Vergleich fuer die Forschung. Indem alle Metriken und
erkannten Zustaende trotzdem gespeichert werden, kann man spaeter vergleichen:
- "Haette das System in der Baseline-Gruppe eingegriffen? Wann? Wie oft?"
- "Wie unterscheidet sich der Verlauf mit und ohne Interventionen?"

**Technisch:**
Die Policy Engine (`evaluatePolicy`) gibt sofort `noIntervention` zurueck, wenn
`scenario === 'baseline'`. Zusaetzlich blockt der Decision Loop nochmals explizit
(doppelte Sicherheit).

---

## 11. Der Rule-Checker (Brainstorming-Regeln)

**Datei:** `lib/decision/ruleViolationChecker.ts`

### Was sind Brainstorming-Regeln?

Alex Osborns vier klassische Brainstorming-Regeln:
1. **Keine Kritik** — Ideen nicht bewerten oder ablehnen
2. **Quantitaet vor Qualitaet** — Moeglichst viele Ideen generieren
3. **Wilde Ideen willkommen** — Je ungewoehnlicher, desto besser
4. **Aufbauen auf Ideen anderer** — Kombinieren und weiterentwickeln

Wenn ein Teilnehmer gegen diese Regeln verstoesst (z.B. "Das ist eine schlechte Idee"),
soll das System daran erinnern.

### Wie funktioniert der Rule-Checker?

```
Alle 15 Sekunden:

1. Letzte 15 Transkript-Segmente seit dem letzten Check sammeln
2. Per API an /api/rule-check senden
3. Ein LLM (gpt-4o-mini) klassifiziert:
   - Verstoss? Ja/Nein
   - Welche Regel? (z.B. "Keine Kritik")
   - Schweregrad: low / medium / high
   - Beweistext (was wurde gesagt?)
4. Ergebnis zurueck an Decision Loop
```

### Was passiert mit dem Ergebnis?

| Schweregrad | Aktion |
|------------|--------|
| **low** | Ignoriert (zu hohes Risiko fuer False Positives) |
| **medium** | Intervention wird vorbereitet |
| **high** | Intervention wird vorbereitet |

### Wie unterscheidet sich der Rule-Checker von metrischen Interventionen?

| Eigenschaft | Metrische Intervention | Rule-Violation-Intervention |
|------------|----------------------|---------------------------|
| Ausloeser | State Inference (Metriken) | LLM-basierte Regelanalyse |
| Confirmation-Phase | 45 Sekunden warten | **Keine!** Feuert sofort |
| Cooldown | 180 Sekunden (global) | 15 Sekunden (eigener Cooldown) |
| Endpoint | Moderator ODER Ally | Immer Moderator |
| Intent | Je nach Zustand | NORM_REINFORCEMENT |
| Kann mit metrisch kombiniert werden? | — | Ja (Combined-Intervention) |

### Schutzmechanismen des Rule-Checkers

**1. Nur bei ≥ 2 aktiven Sprechern**
Wenn in den letzten 60 Sekunden nur eine Person gesprochen hat, werden Rule-Checks
unterdrueckt. Grund: Am Ende einer Session oder bei technischen Problemen wuerde
eine einzelne Person faelschlicherweise als "regelverstoessend" eingestuft.

**2. Eigener Cooldown (15 Sekunden)**
Zwischen zwei Rule-Violation-Interventionen muessen mindestens 15 Sekunden vergehen.
Verhindert staendige Ermahnungen bei einem einzelnen laengeren Regelverstoss.

**3. Duplikat-Erkennung (5-Minuten-Fenster)**
Wenn die **exakt gleiche Beweistext-Passage** bereits in den letzten 5 Minuten
gemeldet wurde, wird der Verstoss ignoriert. Verhindert, dass das gleiche Statement
mehrfach beahndet wird.

**4. Geteiltes Budget**
Rule-Violations teilen sich das Budget mit metrischen Interventionen:
Maximal **3 Interventionen pro 10 Minuten** (egal ob metrisch oder Rule-Violation).

### Kombinierte Interventionen

Wenn gleichzeitig eine metrische Intervention UND eine Rule-Violation anstehen,
werden sie **kombiniert**. Die LLM-Nachricht enthaelt dann sowohl die Korrektur
als auch den metrischen Hinweis (z.B. "Denken wir daran, alle Ideen willkommen
zu heissen. Und lasst uns auch die Perspektiven der anderen einbeziehen.").

---

## 12. Das Fatigue-System (Ermuedungserkennung)

**Datei:** `lib/decision/interventionPolicy.ts` (Funktion `analyzeInterventionHistory`)

### Was ist Fatigue?

Wenn mehrere Interventionen hintereinander **nicht gewirkt** haben (Recovery-Ergebnis:
`not_recovered`), passt das System seine Timing-Parameter an. Es wird **geduldiger**:
Die Bestaetigungs-Phase wird laenger, und die Cooldown-Pause wird laenger.

### Warum?

Wenn die gleiche Art von Intervention wiederholt nicht wirkt, macht es keinen Sinn,
sie in der gleichen Frequenz zu wiederholen. Das wuerde die Teilnehmer nur nerven,
ohne die Situation zu verbessern.

### Wie funktioniert es?

Das System zaehlt die **aufeinanderfolgenden Fehlschlaege** (rueckwaerts durch die
Interventions-Historie):

| Aufeinanderfolgende Fehlschlaege | Confirmation-Multiplikator | Cooldown-Multiplikator |
|--------------------------------|---------------------------|----------------------|
| 0 (letzte Intervention war erfolgreich) | 1.0× (45s) | 1.0× (180s) |
| 1 (letzter Fehlschlag) | 1.5× (67.5s) | 1.5× (270s) |
| 2 oder mehr | 2.0× (90s) | 2.0× (360s) |

### Beispiel

```
Intervention 1: PARTICIPATION_REBALANCING → not_recovered (Fehlschlag)
  → Naechste Confirmation: 67.5s statt 45s, Cooldown: 270s statt 180s

Intervention 2: PARTICIPATION_REBALANCING → not_recovered (2. Fehlschlag)
  → Naechste Confirmation: 90s statt 45s, Cooldown: 360s statt 180s

Intervention 3: REACTIVATION → recovered (Erfolg!)
  → Zaehler wird zurueckgesetzt
  → Naechste Confirmation: 45s, Cooldown: 180s
```

**Wichtig:** Der Zaehler wird bei **jedem** Erfolg zurueckgesetzt, egal ob der Erfolg
beim gleichen oder einem anderen Intent war.

---

## 13. Recovery-Pruefung: Hat die Intervention gewirkt?

**Datei:** `lib/decision/postCheck.ts`

### Wie wird Recovery gemessen?

Das System vergleicht die **aktuellen Metriken** mit den **Metriken zum Zeitpunkt der
Intervention** (gespeichert als `metricsAtIntervention`). Je nach Intent werden
unterschiedliche Metriken geprueft.

### Recovery fuer PARTICIPATION_REBALANCING (nach DOMINANCE_RISK)

Drei Kriterien werden geprueft:

| Kriterium | Was wird verglichen | Schwelle fuer "verbessert" |
|-----------|-------------------|--------------------------|
| Participation Risk Score | Vorher vs. Nachher | Mindestens **15% relative Reduktion** |
| Silent Participant Ratio | Vorher vs. Nachher | Mindestens **0.10 absolute Reduktion** ODER auf 0 |
| Participation Imbalance | Vorher vs. Nachher | Mindestens **0.05 absolute Reduktion** |

**"Recovered"** = Risk Score verbessert UND (Silent Ratio ODER Imbalance verbessert)
**"Partial"** = Mindestens eines der drei Kriterien verbessert
**"Not Recovered"** = Keines der drei Kriterien verbessert

**Recovery Score** (0–1):
```
0.6 × max(0, relative Risk-Score-Reduktion) + 0.4 × max(0, relative Silent-Ratio-Reduktion)
```

### Recovery fuer PERSPECTIVE_BROADENING (nach CONVERGENCE_RISK)

| Kriterium | Was wird verglichen | Schwelle fuer "verbessert" |
|-----------|-------------------|--------------------------|
| Novelty Rate | Vorher vs. Nachher | Mindestens **+0.10 absolute Steigerung** |
| Cluster Concentration | Vorher vs. Nachher | Mindestens **-0.08 absolute Reduktion** |
| Expansion Score | Vorher vs. Nachher | Positiv geworden ODER **+0.15 Steigerung** |

**"Recovered"** = Novelty UND Concentration verbessert
**"Partial"** = Mindestens eines von drei verbessert

### Recovery fuer REACTIVATION (nach STALLED_DISCUSSION)

| Kriterium | Was wird verglichen | Schwelle fuer "verbessert" |
|-----------|-------------------|--------------------------|
| Novelty Rate | Vorher vs. Nachher | Mindestens **+0.10 absolute Steigerung** |
| Expansion Score | Vorher vs. Nachher | Positiv geworden ODER **+0.20 Steigerung** |
| Stagnation Duration | Vorher vs. Nachher | Mindestens **-30 Sekunden** |

**"Recovered"** = Novelty verbessert UND (Expansion ODER Stagnation verbessert)
**"Partial"** = Mindestens eines von drei verbessert

### Recovery fuer ALLY_IMPULSE (Eskalation)

| Kriterium | Was wird verglichen | Schwelle fuer "verbessert" |
|-----------|-------------------|--------------------------|
| Novelty Rate | Vorher vs. Nachher | Mindestens **+0.02** (relaxiert!) |
| Participation Risk Score | Vorher vs. Nachher | Mindestens **-0.02** (relaxiert!) |
| Stagnation Duration | Vorher vs. Nachher | Mindestens **-5 Sekunden** (relaxiert!) |

**"Recovered"** = **Eines** der drei reicht! (nicht alle noetig)

### Was passiert mit dem Recovery-Ergebnis?

| Ergebnis | Score-Schwelle | Szenario A | Szenario B |
|----------|---------------|-----------|-----------|
| **recovered** | Score ≥ 0.15 | → MONITORING | → MONITORING |
| **partial** | Score ≥ 0.05 | → MONITORING | → MONITORING |
| **not_recovered** | Score < 0.05 | → COOLDOWN | → Ally-Eskalation (wenn noch nicht Ally) |
| **not_recovered** (nach Ally) | Score < 0.05 | — | → COOLDOWN |

---

## 14. Alle Sicherheitsmechanismen

### Budget: Sliding-Window Rate Limiting

Maximal **3 Interventionen** innerhalb von 10 Minuten (konfigurierbar: `MAX_INTERVENTIONS_PER_10MIN`).

Funktionsweise: Ein Array `interventionTimestamps` speichert die Zeitpunkte aller gefeuerten
Interventionen. Vor jeder neuen Intervention wird gezaehlt, wie viele Timestamps in den
letzten 10 Minuten liegen. Bei ≥ 3 wird blockiert.

Alte Timestamps (aelter als 10 Minuten) werden automatisch entfernt (Pruning).

**Wichtig:** Moderator-Interventionen, Ally-Interventionen und Rule-Violation-Interventionen
teilen sich dasselbe Budget.

### Cooldown: Zwangspause zwischen Interventionen

Nach jeder metrischen Intervention: **180 Sekunden** Cooldown (konfigurierbar: `COOLDOWN_SECONDS`).
Kann durch Fatigue auf 270s oder 360s steigen.

Der Cooldown-Timer startet zum Zeitpunkt der Intervention, nicht nach dem PostCheck.
Da PostCheck ebenfalls 180s dauert, ist der Cooldown nach dem PostCheck oft schon abgelaufen.

### Rule-Violation-Cooldown

Separater, kuerzerer Cooldown nur fuer Rule-Violation-Interventionen: **15 Sekunden**
(konfigurierbar: `RULE_VIOLATION_COOLDOWN_MS`).

### TTS Rate Limiting

Mindestens **30 Sekunden** zwischen zwei Sprachausgaben (konfigurierbar: `TTS_RATE_LIMIT_SECONDS`).
Verhindert, dass Teilnehmer von staendiger Sprachausgabe genervt werden.

### Duplikat-Erkennung (Rule-Violations)

Gleiche Beweistext-Passage wird innerhalb von 5 Minuten nur einmal beahndet.

### Hysterese (State Inference)

Zustandswechsel erfordert mindestens 8% Confidence-Vorsprung → verhindert Flackern.

### Persistence-Check (Confirmation)

Mindestens 70% der Metrik-Snapshots im Bestaetigungsfenster muessen Risk-Zustaende zeigen.
Verhindert Interventionen bei kurzzeitigen Ausreissern.

### Client-Side Fallback

Wenn der LLM-API-Aufruf fehlschlaegt (Timeout, Netzwerkfehler, 503), wird ein
**vorgefertigter Fallback-Text** verwendet. Die Intervention wird IMMER geliefert.

Fallback-Texte existieren fuer alle Intents in Deutsch und Englisch:

| Intent | Deutsch (Kurzform) |
|--------|-------------------|
| PARTICIPATION_REBALANCING | "Es waere bereichernd, noch mehr Perspektiven zu hoeren..." |
| PERSPECTIVE_BROADENING | "Welche voellig andere Richtung koennten wir erkunden?" |
| REACTIVATION | "Welche Bereiche haben wir noch nicht erkundet?" |
| NORM_REINFORCEMENT | "Beim Brainstorming sind alle Ideen willkommen!" |
| ALLY (default) | "Was waere, wenn wir das aus einem unerwarteten Blickwinkel betrachten?" |

---

## 15. Vollstaendige Zeittabelle

### Default-Werte (aus `lib/config.ts`)

| Parameter | Wert | Bedeutung |
|-----------|------|----------|
| `ANALYZE_EVERY_MS` | 5000ms (5s) | Metrik-Berechnung alle 5 Sekunden |
| `DECISION_TICK_MS` | 1000ms (1s) | Engine-Auswertung jede Sekunde |
| `WINDOW_SECONDS` | 300s (5 Min) | Metriken-Fenster: letzte 5 Minuten |
| `CUMULATIVE_WINDOW_SECONDS` | 600s (10 Min) | Langzeit-Fenster fuer kumulative Participation |
| `CONFIRMATION_SECONDS` | 45s | Wie lange ein Problem anhalten muss |
| `POST_CHECK_SECONDS` | 180s (3 Min) | Wartezeit nach Moderator-Intervention |
| Ally POST_CHECK | 60s (1 Min) | Wartezeit nach Ally-Intervention (hardcoded) |
| `COOLDOWN_SECONDS` | 180s (3 Min) | Zwangspause nach Intervention |
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | Budget pro 10-Minuten-Fenster |
| `TTS_RATE_LIMIT_SECONDS` | 30s | Mindestabstand zwischen TTS |
| `RULE_CHECK_INTERVAL_MS` | 15000ms (15s) | Rule-Checker-Intervall |
| `RULE_VIOLATION_COOLDOWN_MS` | 15000ms (15s) | Cooldown zwischen Rule-Violations |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | Recovery Score ab dem "recovered" gilt |
| Mindest-Confidence | 0.45 | Ab wann ein Risk-State beachtet wird |
| Hysterese-Schwelle | 0.08 | Mindest-Vorsprung fuer Zustandswechsel |
| Tiebreak-Schwelle | 0.03 | Innerhalb dieser Marge: Risk gewinnt |
| Persistence-Schwelle | 70% | Anteil Risk-Snapshots im Confirmation-Fenster |

### Stagger-Offsets (Startverzoegerungen)

| Komponente | Offset | Warum |
|-----------|--------|-------|
| Metriken | 500ms | Startet zuerst, damit Daten da sind |
| Decision Engine | 1500ms | Wartet auf erste Metriken |
| Idea Extraction | 2500ms | Startet zuletzt, braucht settled Metriken |

### Timing-Szenarien

**Schnellster moeglicher Eingriff** (ab Session-Start):
```
0.5s (Stagger) + 5s (erster Snapshot) + 45s (Confirmation) = ~50.5 Sekunden
```

**Typischer Zyklus Szenario A:**
```
45s Confirming + 180s PostCheck = 225s, Cooldown meist schon abgelaufen
→ ~225 Sekunden bis wieder frei
```

**Typischer Zyklus Szenario B mit Eskalation:**
```
45s Confirming + 180s PostCheck + 60s Ally-PostCheck = 285s
+ evtl. restlicher Cooldown
→ ~285–465 Sekunden bis wieder frei
```

**Maximum: 3 Interventionen in 10 Minuten**
```
Intervention 1: t=50s
Intervention 2: t=50s + 225s = t=275s (frühestens nach Cooldown)
Intervention 3: t=275s + 225s = t=500s
Budget erschoepft bis t=50s + 600s = t=650s
```

---

## 16. Welche Metriken fliessen wo ein?

### In die State Inference (Zustandserkennung)

| Metrik | HEALTHY_EXPL | HEALTHY_ELAB | DOMINANCE | CONVERGENCE | STALLED |
|--------|:-----------:|:------------:|:---------:|:-----------:|:-------:|
| participationRiskScore | ✅ Gate+Formel | ✅ Gate+Formel | ✅ | | |
| silentParticipantRatio | | | ✅ | | |
| dominanceStreakScore | | | ✅ | | |
| cumulativeImbalance | | | ✅ | | |
| noveltyRate | ✅ | ✅ | | ✅ | ✅ |
| clusterConcentration | | ✅ | | ✅ | |
| explorationElabRatio | ✅ | ✅ | | ✅ | |
| semanticExpansionScore | ✅ | ✅ | | ✅ | ✅ |
| ideationalFluencyRate | | | | | ✅ |
| stagnationDuration | ✅ (Penalty) | ✅ (Penalty) | | | ✅ |
| diversityDevelopment | | | | | ✅ |
| **piggybackingScore** | | | | | | ← **Nirgends!** |

### In die Recovery-Pruefung (PostCheck)

| Metrik | PARTICIP_REBAL | PERSPECT_BROAD | REACTIVATION | ALLY_IMPULSE |
|--------|:--------------:|:--------------:|:------------:|:------------:|
| participationRiskScore | ✅ | | | ✅ (relaxiert) |
| silentParticipantRatio | ✅ | | | |
| participationImbalance | ✅ | | | |
| noveltyRate | | ✅ | ✅ | ✅ (relaxiert) |
| clusterConcentration | | ✅ | | |
| semanticExpansionScore | | ✅ | ✅ | |
| stagnationDuration | | | ✅ | ✅ (relaxiert) |

### Berechnet aber nirgends entscheidungsrelevant

| Metrik | Status |
|--------|--------|
| `piggybackingScore` | Berechnet alle 5s (Embedding-Kosten!), nur im criteriaSnapshot geloggt |
| `semanticRepetitionRate` | Legacy-Metrik, ersetzt durch `noveltyRate` |
| `participationImbalance` (global) | Legacy, aber weiterhin im Recovery-Check verwendet |

---

## 17. Dateien und Code-Referenzen

| Datei | Zweck |
|-------|-------|
| `lib/hooks/useMetricsComputation.ts` | Orchestriert Metrik-Berechnung + State Inference |
| `lib/metrics/computeMetrics.ts` | Berechnet alle Metriken (async, mit Embeddings) |
| `lib/metrics/participation.ts` | v2 Participation-Metriken |
| `lib/metrics/semanticDynamics.ts` | v2 Semantic-Dynamics-Metriken |
| `lib/metrics/embeddingCache.ts` | Embedding-Cache + Cosine/Repetition/Diversity |
| `lib/state/inferConversationState.ts` | 5-Zustaende-Classifier |
| `lib/hooks/useDecisionLoop.ts` | Haupt-Loop: Tick → Policy → Fire |
| `lib/decision/interventionPolicy.ts` | 4-Phasen-Statemachine + Fatigue |
| `lib/decision/postCheck.ts` | Recovery-Evaluation pro Intent |
| `lib/decision/ruleViolationChecker.ts` | LLM-basierter Brainstorming-Regel-Check |
| `lib/decision/interventionExecutor.ts` | API-Call, TTS, Fallback, Supabase-Persistenz |
| `lib/decision/tickConfig.ts` | Alle Intervall-Konstanten + Stagger-Offsets |
| `lib/decision/transcriptContext.ts` | Baut Transkript-Kontext fuer LLM-Prompt |
| `lib/config.ts` | Default-Konfiguration + Validierung |

---

## 18. Glossar

### Ally
Ein als Teilnehmer getarnter KI-Agent in Szenario B. Spricht wie ein normaler
Brainstorming-Teilnehmer, nicht wie ein Moderator. Wird nur aktiviert, wenn eine
Moderator-Intervention nicht gewirkt hat.

### Backchannel
Kurze bestaeteigende Aeusserungen wie "Ja", "Mhm", "Genau", "OK". Werden aus der
Turn-Zaehlung ausgeschlossen, da sie keine inhaltlichen Beitraege sind.

### Confidence
Wert zwischen 0 und 1, der die Sicherheit eines erkannten Zustands ausdrueckt.
0.45 ist die Mindestschwelle fuer eine Aktion.

### Cooldown
Zwangspause nach einer Intervention. Verhindert, dass Teilnehmer von zu haeufigen
Interventionen genervt werden.

### Decision Owner
Der eine Client in einer Session, der die Entscheidungs-Engine ausfuehrt
(typischerweise der Host). Andere Clients empfangen Interventionen passiv.

### Embedding
Numerische Darstellung eines Textes als Vektor (1536 Zahlen). Semantisch aehnliche
Texte haben aehnliche Vektoren. Ermoeglicht mathematischen Vergleich von Textinhalten.

### Engine Phase
Aktuelle Phase der Entscheidungs-Engine: MONITORING, CONFIRMING, POST_CHECK oder COOLDOWN.

### Fatigue
Ermuedungs-Erkennung: Wenn Interventionen wiederholt nicht wirken, werden Bestaetigungs-
und Cooldown-Zeiten verlaengert (bis 2x).

### HHI (Herfindahl-Hirschman-Index)
Mass fuer Konzentration aus der Wirtschaft. Summe der quadrierten Anteile.
Normalisiert: 0 = perfekt verteilt, 1 = alles an einer Stelle.

### Hoover-Index
Mass fuer Ungleichheit. Anteil, der umverteilt werden muesste fuer Gleichheit.
0 = perfekt gleich, 1 = maximal ungleich.

### Hysterese
Schutzmechanismus gegen Zustands-Flackern. Ein neuer Zustand braucht mindestens 8%
mehr Confidence als der aktuelle, um ihn abzuloesen.

### Intent
Beschreibt, was eine Intervention bewirken soll: PARTICIPATION_REBALANCING,
PERSPECTIVE_BROADENING, REACTIVATION, ALLY_IMPULSE oder NORM_REINFORCEMENT.

### Intervention
Eine Nachricht des Systems an die Teilnehmer, um das Gespraech zu verbessern.

### MATTR (Moving Average Type-Token Ratio)
Laengenunabhaengiges Mass fuer Vokabular-Diversitaet. Durchschnitt der TTR-Werte
ueber gleitende 50-Wort-Fenster.

### Persistence-Check
Pruefung, ob ein Risk-Zustand stabil ist: Mindestens 70% der Snapshots im
Bestaetigungsfenster muessen Risk-Zustaende sein.

### PostCheck
Phase nach einer Intervention, in der geprueft wird, ob sich die Situation verbessert hat.

### Recovery
Ergebnis der PostCheck-Pruefung: recovered (verbessert), partial (teilweise), not_recovered (nicht verbessert).

### Risk-State
Einer der drei problematischen Gespraechszustaende: DOMINANCE_RISK, CONVERGENCE_RISK, STALLED_DISCUSSION.

### Rolling Window
Gleitendes Zeitfenster. Nur Daten der letzten X Sekunden werden beruecksichtigt.
Standard: 300 Sekunden fuer Metriken, 600 Sekunden fuer kumulative Participation.

### Snapshot
Momentaufnahme aller Metriken zu einem Zeitpunkt. Wird alle 5 Sekunden erstellt.

### Tick
Ein einzelner Durchlauf der Entscheidungs-Engine (jede Sekunde).

### TTS (Text-to-Speech)
Sprachausgabe einer Intervention ueber die Web Speech API des Browsers.
