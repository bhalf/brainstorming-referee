# Conversation Health Metriken — Vollstaendige Dokumentation

Diese Dokumentation beschreibt **alle angezeigten Metriken**, wie sie berechnet werden, welche Fachbegriffe dahinterstecken, und welche Parameter live anpassbar sind.

---

## Inhaltsverzeichnis

1. [Uebersicht aller Metriken](#uebersicht)
2. [Das Zeitfenster (Rolling Window)](#zeitfenster)
3. [Metrik 1: Participation Risk](#1-participation-risk)
4. [Metrik 2: Novelty](#2-novelty)
5. [Metrik 3: Concentration](#3-concentration)
6. [Metrik 4: Balance](#4-balance)
7. [Metrik 5: Repetition](#5-repetition)
8. [Metrik 6: Stagnation](#6-stagnation)
9. [Metrik 7: Diversity](#7-diversity)
10. [Die 5 Gespraechszustaende](#gespraechszustaende)
11. [Interventions-Engine](#interventions-engine)
12. [KI-Integration: OpenAI Embeddings](#ki-integration)
13. [Alle anpassbaren Parameter](#anpassbare-parameter)
14. [Glossar der Fachbegriffe](#glossar)

---

## Uebersicht

| # | Metrik | Icon | Wert-Bereich | Besser wenn | Schwellenwert | KI | Datei |
|---|--------|------|-------------|-------------|---------------|-----|-------|
| 1 | Participation Risk | ⚠️ | 0–100% | Niedrig | 55% | Nein | `participation.ts` |
| 2 | Novelty | 💡 | 0–100% | Hoch | 30% | Ja | `semanticDynamics.ts` |
| 3 | Concentration | 🎯 | 0–100% | Niedrig | 70% | Ja | `semanticDynamics.ts` |
| 4 | Balance | ⚖️ | 0–100% | Hoch | 35% | Nein | `computeMetrics.ts` |
| 5 | Repetition | 🔁 | 0–100% | Niedrig | 75% | Hybrid | `embeddingCache.ts` |
| 6 | Stagnation | ⏱️ | 0s–∞ | Niedrig | 180s | Hybrid | `computeMetrics.ts` |
| 7 | Diversity | 🌐 | 0–100% | Hoch | 30% | Hybrid | `embeddingCache.ts` |

**Hybrid** = Primaer mit OpenAI Embeddings, Fallback auf rein algorithmische Berechnung wenn Embeddings nicht verfuegbar.

**Gelbe Linie im UI** = Schwellenwert. Wenn ueberschritten (bzw. unterschritten bei "hoeher ist besser"), wird der Balken **rot**.

---

## Zeitfenster

Alle Metriken werden auf einem **rollierenden Zeitfenster** berechnet — nicht ueber die gesamte Session:

```
windowStart = aktuelleZeit - (WINDOW_SECONDS × 1000)
Nur Segmente mit timestamp >= windowStart werden beruecksichtigt
```

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `WINDOW_SECONDS` | 180 | 30–600 | Laenge des rollierenden Fensters in Sekunden |
| `ANALYZE_EVERY_MS` | 5000 | 1000–30000 | Wie oft Metriken neu berechnet werden (in ms) |

So reflektieren die Metriken immer das **aktuelle** Gespraechsverhalten, nicht den Gesamtverlauf.

---

## 1. Participation Risk

**Icon:** ⚠️ | **Bereich:** 0–100% | **Besser wenn:** Niedrig | **Schwellenwert:** 55%

### Was wird gemessen?
Wie ungleichmaessig die Teilnahme am Gespraech verteilt ist. Ein hoher Wert bedeutet: Eine Person dominiert, oder andere Teilnehmer sind zu still.

### Berechnung
Ein gewichteter Durchschnitt aus **4 Sub-Metriken**:

```
participationRiskScore = 0.35 × giniImbalance
                       + 0.25 × silentParticipantRatio
                       + 0.25 × dominanceStreakScore
                       + 0.15 × turnGini
```

Die Gewichte bestimmen, wie stark jede Sub-Metrik in das Endergebnis einfliesst. Sie sind live anpassbar (siehe [Anpassbare Parameter](#anpassbare-parameter)).

#### 1a) Hoover Imbalance (35% Gewicht)

Misst, wie weit die tatsaechliche Wortverteilung von einer perfekt gleichmaessigen Verteilung abweicht.

**Fachbegriff: Hoover-Index (auch Pietra-Index)** — ein Mass fuer Ungleichheit einer Verteilung. 0 = perfekt gleich, 1 = maximal ungleich. Misst den Anteil, der umverteilt werden muesste, um Gleichheit zu erreichen. (Nicht zu verwechseln mit dem Gini-Koeffizienten, der auf paarweisen Differenzen basiert.)

```
Schritt 1: Wortanzahl pro Sprecher zaehlen
           shares[speaker] = woerter[speaker] / gesamtWoerter

Schritt 2: Wie wuerde perfekte Gleichheit aussehen?
           perfectShare = 1 / anzahlSprecher

Schritt 3: Abweichung berechnen
           hooverImbalance = Σ|share - perfectShare| / (2 × (1 - perfectShare))
```

**Beispiel:** 3 Sprecher mit 70%, 20%, 10% → hooverImbalance ≈ 0.60

#### 1b) Silent Participant Ratio (25% Gewicht)

Anteil der Teilnehmer, die kaum oder gar nicht sprechen.

```
Ein Sprecher gilt als "still" wenn sein Anteil < THRESHOLD_SILENT_PARTICIPANT (5%)

silentRatio = (stille Sprecher + nie gesprochene Teilnehmer) / Gesamtteilnehmer
```

Wenn LiveKit meldet, dass 4 Teilnehmer im Raum sind, aber nur 2 im Transkript auftauchen, werden die 2 fehlenden als "still" gezaehlt.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_SILENT_PARTICIPANT` | 0.05 | 0.01–0.30 | Ab welchem Redeanteil jemand als "still" gilt |

#### 1c) Dominance Streak Score (25% Gewicht)

Misst, ob ein Sprecher **mehrere aufeinanderfolgende Wortbeitraege** monopolisiert.

```
maxRun = laengste Serie aufeinanderfolgender Segmente desselben Sprechers
         (in den letzten 30 Segmenten)

rawStreak = maxRun / anzahlSegmente
expectedStreak = 1 / anzahlSprecher

dominanceStreakScore = (rawStreak - expectedStreak) / (1 - expectedStreak)
```

**Beispiel:** 3 Sprecher, 10 Segmente. Sprecher A hat 5 hintereinander → rawStreak=0.5, expected=0.33 → Score ≈ 0.25

#### 1d) Turn Hoover (15% Gewicht)

Gleiche Hoover-Index-Berechnung wie 1a, aber auf **Anzahl der Wortbeitraege** (Turns) statt Wortanzahl. Misst also: Sprechen alle gleich oft (unabhaengig davon, wie lang)?

**Datei:** `lib/metrics/participation.ts`

---

## 2. Novelty

**Icon:** 💡 | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 30%

### Was wird gemessen?
Welcher Anteil der letzten Aeusserungen **inhaltlich neue Ideen** einbringt (statt bereits Gesagtes zu wiederholen).

### Berechnung (mit Embeddings)

1. Die letzten 20 Segmente (aus max. 30 im Fenster) werden als **Embedding-Vektoren** dargestellt
2. Fuer jedes Segment: **maximale Kosinus-Aehnlichkeit** zu allen vorhergehenden berechnen
3. Wenn maxSimilarity < `NOVELTY_COSINE_THRESHOLD` (0.65) → Segment ist **novel**

```
Fuer jedes Segment i (i = 1 bis 20):
    maxSim = Maximum von cosineSimilarity(embedding[i], embedding[j]) fuer alle j < i

    Wenn maxSim < 0.65 → novel!

noveltyRate = anzahlNovelerSegmente / anzahlAusgewerteterSegmente
```

**Warum MAX-Aehnlichkeit?** Ein Segment ist nur dann wirklich neu, wenn es sich von ALLEN bisherigen unterscheidet. Wenn es auch nur einem frueheren Segment sehr aehnlich ist, ist es eine Wiederholung.

**Fachbegriff: Kosinus-Aehnlichkeit (Cosine Similarity)** — misst den Winkel zwischen zwei Vektoren im hochdimensionalen Raum. 1.0 = identisch, 0.0 = voellig unterschiedlich, -1.0 = gegensaetzlich.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `NOVELTY_COSINE_THRESHOLD` | 0.65 | 0.30–0.90 | Unter dieser Aehnlichkeit gilt ein Segment als "novel" (kalibriert fuer text-embedding-3-small) |
| `THRESHOLD_NOVELTY_RATE` | 0.30 | 0.05–0.80 | Schwellenwert im UI (gelbe Linie) |

### Fallback (ohne Embeddings)

Statt Kosinus-Aehnlichkeit auf Embedding-Vektoren wird **Jaccard-Aehnlichkeit** auf Wortmengen verwendet:

**Fachbegriff: Jaccard-Aehnlichkeit** — vergleicht zwei Mengen: |Schnittmenge| / |Vereinigungsmenge|. 1.0 = identische Mengen, 0.0 = keine Ueberlappung.

Schwellenwert im Fallback: 0.40 (statt 0.80 fuer Cosine, da Jaccard tendenziell niedrigere Werte liefert).

**Datei:** `lib/metrics/semanticDynamics.ts:computeNoveltyRate()`

---

## 3. Concentration

**Icon:** 🎯 | **Bereich:** 0–100% | **Besser wenn:** Niedrig | **Schwellenwert:** 70%

### Was wird gemessen?
Wie stark sich die Gespraechsthemen auf **wenige Themencluster** konzentrieren. Hoher Wert = alle reden ueber das Gleiche. Niedriger Wert = breite Themenstreuung.

### Berechnung (mit Embeddings)

**Schritt 1: Greedy Centroid Clustering**

Aehnliche Segmente werden zu Clustern gruppiert:

1. Erstes Segment = erster Cluster (mit dem Embedding als Zentroid)
2. Fuer jedes weitere Segment:
   - Kosinus-Aehnlichkeit zu **jedem bestehenden Cluster-Zentroid** berechnen
   - Wenn max. Aehnlichkeit ≥ `CLUSTER_MERGE_THRESHOLD` (0.60) → in den aehnlichsten Cluster einordnen und Zentroid als laufenden Durchschnitt aktualisieren
   - Sonst → neuen Cluster erstellen

**Fachbegriff: Zentroid (Centroid)** — der "Mittelpunkt" eines Clusters, berechnet als Durchschnitt aller enthaltenen Vektoren.

**Schritt 2: Konzentration berechnen (Normalized HHI)**

```
HHI = Σ(clusterAnteil²)
minHHI = 1 / anzahlSegmente              (= HHI bei perfekter Gleichverteilung)

concentration = (HHI - minHHI) / (1 - minHHI)    (normalisiert auf 0–1)
```

**Fachbegriff: HHI (Herfindahl-Hirschman-Index)** — ein Mass aus der Wirtschaft fuer Marktkonzentration. Summe der quadrierten Anteile. Normalisierter HHI skaliert den Wert so, dass 0 = maximal verteilt (jedes Segment eigener Cluster) und 1 = alles in einem Cluster.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `CLUSTER_MERGE_THRESHOLD` | 0.60 | 0.30–0.90 | Ab welcher Aehnlichkeit ein Segment in einen bestehenden Cluster eingeordnet wird (kalibriert fuer text-embedding-3-small) |
| `THRESHOLD_CLUSTER_CONCENTRATION` | 0.70 | 0.30–1.00 | Schwellenwert im UI (gelbe Linie) |

**Beispiel:** 20 Segmente in 10 Clustern gleicher Groesse → HHI = 10 × (0.1)² = 0.1, minHHI = 1/20 = 0.05 → nHHI = (0.1 - 0.05) / (1 - 0.05) ≈ 0.053 (gesund, breit verteilt)

### Fallback (ohne Embeddings)

Gleiches Clustering-Verfahren, aber mit Jaccard-Wortmengen-Aehnlichkeit (Schwellenwert 0.40).

**Datei:** `lib/metrics/semanticDynamics.ts:computeClusterConcentration()`

---

## 4. Balance

**Icon:** ⚖️ | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 35%

### Was wird gemessen?
Wie gleichmaessig die Redezeit verteilt ist. Gegenstueck zur Participation Risk, aber einfacher: nur ein Hoover-Index-Wert.

### Berechnung

```
Balance = 1 - participationImbalance
```

`participationImbalance` ist der **Hoover-Index** auf der Textlaengen-Verteilung:

```
distribution[speaker] = Summe der Textlaengen (Zeichen) aller Segmente des Sprechers
shares[speaker] = distribution[speaker] / gesamteTextlaenge
perfectShare = 1 / anzahlSprecher

imbalance = Σ|share - perfectShare| / (2 × (1 - perfectShare))
```

Wenn Audio-basierte Sprechzeiten von LiveKit vorhanden sind, werden diese statt Textlaenge verwendet.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_IMBALANCE` | 0.65 | 0.10–1.00 | Balance-Schwelle = 1 - 0.65 = 0.35 (35%) |

**Datei:** `lib/metrics/computeMetrics.ts:computeParticipationImbalance()`

---

## 5. Repetition

**Icon:** 🔁 | **Bereich:** 0–100% | **Besser wenn:** Niedrig | **Schwellenwert:** 75%

### Was wird gemessen?
Wie stark sich **aufeinanderfolgende** Aeusserungen inhaltlich wiederholen.

### Berechnung (mit Embeddings)

Durchschnittliche Kosinus-Aehnlichkeit zwischen **aufeinanderfolgenden** Segment-Embeddings:

```
Fuer i = 1 bis N (letzte 30 Segmente):
    similarity[i] = cosineSimilarity(embedding[i-1], embedding[i])

repetitionRate = Durchschnitt aller similarity-Werte
```

- 0% = jedes Segment ist voellig anders als das vorherige
- 100% = identischer Inhalt wird wiederholt

### Fallback (ohne Embeddings): Jaccard

```
Fuer jedes aufeinanderfolgende Paar (A, B):
    worteA = Menge aller Woerter >2 Zeichen in A (ohne Stoppwoerter)
    worteB = Menge aller Woerter >2 Zeichen in B (ohne Stoppwoerter)

    jaccard = |worteA ∩ worteB| / |worteA ∪ worteB|

repetitionRate = Durchschnitt aller Jaccard-Werte
```

**Stoppwoerter** (Funktionswoerter wie "der", "die", "das", "the", "and" etc.) werden entfernt, damit nur inhaltstragende Woerter verglichen werden.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_REPETITION` | 0.75 | 0.10–1.00 | Schwellenwert im UI (gelbe Linie) |

**Dateien:** `lib/metrics/embeddingCache.ts:computeEmbeddingRepetition()` + `lib/metrics/computeMetrics.ts:computeSemanticRepetitionRate()`

---

## 6. Stagnation

**Icon:** ⏱️ | **Bereich:** 0s–∞ | **Besser wenn:** Niedrig | **Schwellenwert:** 180s

### Was wird gemessen?
Wie viele Sekunden es her ist, seit jemand etwas **semantisch Neues** gesagt hat.

### Berechnung (mit Embeddings)

Geht **rueckwaerts** durch die letzten 30 Segmente und sucht das letzte, das inhaltlich neu war:

```
Fuer i = N rueckwaerts bis 1:
    maxSim = Maximum von cosineSimilarity(embedding[i], embedding[j]) fuer alle j < i

    Wenn maxSim < STAGNATION_NOVELTY_THRESHOLD (0.70):
        → Dieses Segment hat neuen Inhalt eingefuehrt
        → stagnationDuration = (aktuelleZeit - timestamp[i]) / 1000
        → STOP

Wenn kein noveles Segment gefunden:
    → stagnationDuration = Zeit seit dem aeltesten Segment im Fenster
```

**Unterschied zu Novelty:** Stagnation misst die *Zeit seit dem letzten neuen Beitrag* (in Sekunden), Novelty misst den *Anteil neuer Beitraege* (in Prozent). Ausserdem ist der Stagnation-Schwellenwert etwas strenger (0.70 vs. 0.65), weil Stagnation erst dann greifen soll, wenn selbst leicht abgewandelte Inhalte als "nicht neu" gelten.

**Wichtig:** Sowohl Novelty als auch Stagnation verwenden die **maximale** Aehnlichkeit (nicht den Durchschnitt). Ein Segment ist nur dann "neu", wenn es sich von ALLEN vorherigen unterscheidet.

### Anzeige im UI

```
stagnationMax = THRESHOLD_STAGNATION_SECONDS × 1.5    (= 270s bei Standard)
Balken-Fuellstand = min(1, stagnationDuration / stagnationMax)

Anzeige: "Active" wenn <5s, sonst "{X}s"
```

### Fallback (ohne Embeddings)

Einfach die Zeit seit dem letzten Segment (ohne semantische Analyse).

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_STAGNATION_SECONDS` | 180 | 15–600 | Ab wann Stagnation als Problem gilt (gelbe Linie) |
| `STAGNATION_NOVELTY_THRESHOLD` | 0.70 | 0.30–0.90 | Wie aehnlich ein Segment sein darf, um noch als "neu" zu gelten (kalibriert fuer text-embedding-3-small) |

**Datei:** `lib/metrics/computeMetrics.ts:computeStagnationDurationSemantic()`

---

## 7. Diversity

**Icon:** 🌐 | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 30%

### Was wird gemessen?
Wie vielfaeltig das verwendete Vokabular ist. Misst die Breite des Wortschatzes im Gespraech.

### Berechnung (mit Embeddings)

Durchschnittliche **paarweise** Kosinus-Aehnlichkeit aller Segmente:

```
Fuer alle Segment-Paare (i, j) in den letzten 30 Segmenten:
    similarity = cosineSimilarity(embedding[i], embedding[j])

avgSimilarity = Durchschnitt aller Paar-Aehnlichkeiten
diversity = 1 - avgSimilarity
```

### Fallback (ohne Embeddings): MATTR

**Fachbegriff: MATTR (Moving Average Type-Token Ratio)** — ein laengenunabhaengiges Mass fuer Vokabular-Diversitaet.

Normaler TTR (Type-Token Ratio = einzigartige Woerter / alle Woerter) sinkt natuerlich mit zunehmender Textlaenge (Heaps' Law). MATTR loest das durch ein gleitendes Fenster:

```
Fenstergrösse: 50 Woerter

Fuer jedes 50-Wort-Fenster im Text:
    TTR_fenster = einzigartigeWoerter / 50

diversity = Durchschnitt aller TTR_fenster-Werte
```

Bei kurzen Texten (≤50 Woerter): einfacher TTR.

| Parameter | Default | Beschreibung |
|-----------|---------|--------------|
| Schwellenwert | 0.30 | Hardcoded im UI (nicht in ExperimentConfig) |

**Dateien:** `lib/metrics/embeddingCache.ts:computeEmbeddingDiversity()` + `lib/metrics/computeMetrics.ts:computeDiversityDevelopment()`

---

## Gespraechszustaende

Aus den 7 Metriken leitet das System automatisch einen von **5 Gespraechszustaenden** ab. Dieser wird im "Conversation State"-Panel angezeigt.

### Die 5 Zustaende

| Zustand | Farbe | Kategorie | Beschreibung |
|---------|-------|-----------|--------------|
| HEALTHY_EXPLORATION | Gruen | Gesund | Neue Ideen fliessen, alle beteiligen sich |
| HEALTHY_ELABORATION | Smaragd | Gesund | Ideen werden produktiv vertieft |
| DOMINANCE_RISK | Orange | Warnung | Ein Teilnehmer dominiert das Gespraech |
| CONVERGENCE_RISK | Gelb | Warnung | Themen verengen sich, wenig Neues |
| STALLED_DISCUSSION | Rot | Kritisch | Gespraech stockt, kein neuer Inhalt |

### Wie wird der Zustand bestimmt?

Fuer jeden der 5 Zustaende wird eine **Konfidenz** (0–1) berechnet. Der Zustand mit der hoechsten Konfidenz "gewinnt".

#### HEALTHY_EXPLORATION Konfidenz:
```
0.25 × (1 - participationRiskScore)       ← Geringe Dominanz ist gesund
0.30 × noveltyRate                         ← Viel Neuheit ist gesund
0.20 × clamp(expansionScore + 0.5, 0, 1)  ← Sich ausweitender Ideenraum
0.25 × explorationElaborationRatio         ← Viel Exploration
```

#### HEALTHY_ELABORATION Konfidenz:
```
Vorbedingung: participationRiskScore muss ≤ 0.5 sein!

stagnationPenalty = clamp(stagnationDuration / 120, 0, 1)

(0.20 × (1 - participationRiskScore) +
 0.25 × (1 - noveltyRate) +             ← Wenig Neuheit (= Vertiefung)
 0.25 × (1 - explorationRatio) +        ← Wenig Exploration (= Elaboration)
 0.15 × (1 - clusterConcentration) +    ← Themen nicht ZU eng
 0.15 × clamp(expansionScore + 0.3, 0, 1))
× (1 - stagnationPenalty)               ← Abzug bei Stagnation
```

#### DOMINANCE_RISK Konfidenz:
```
0.35 × participationRiskScore       ← Staerkstes Signal
0.25 × silentParticipantRatio       ← Stille Teilnehmer
0.20 × dominanceStreakScore          ← Monolog-Serien
0.20 × participationImbalance       ← Gini-Ungleichheit
```

#### CONVERGENCE_RISK Konfidenz:
```
0.25 × clusterConcentration                    ← Themen verengen sich
0.20 × (1 - noveltyRate)                       ← Kaum Neues
0.20 × (1 - explorationElaborationRatio)       ← Nur noch Elaboration
0.35 × clamp(-semanticExpansionScore, 0, 1)    ← Ideenraum schrumpft (staerkstes Signal!)
```

#### STALLED_DISCUSSION Konfidenz:
```
0.25 × (1 - noveltyRate)                       ← Keine neuen Ideen
0.30 × clamp(stagnationDuration / 180, 0, 1)   ← Langanhaltende Stille
0.25 × clamp(-semanticExpansionScore, 0, 1)     ← Ideenraum schrumpft
0.20 × (1 - diversityDevelopment)               ← Wenig Vokabular-Vielfalt
```

### Zusatzregeln

1. **Hysterese (HYSTERESIS_MARGIN = 0.08):** Um Flackern zu verhindern, muss ein neuer Zustand mindestens 8% mehr Konfidenz haben als der aktuelle, um zu wechseln.

2. **Tiebreak (TIEBREAK_MARGIN = 0.03):** Bei nahezu gleicher Konfidenz (Differenz <3%) gewinnt immer der **Risiko-Zustand** gegenueber einem gesunden Zustand. Prioritaet: STALLED → DOMINANCE → CONVERGENCE → EXPLORATION → ELABORATION.

3. **Sekundaerzustand:** Wenn der zweithoechste Zustand >30% Konfidenz hat, wird er als sekundaerer Zustand angezeigt.

### Interne Hilfsmetriken (nicht direkt angezeigt)

Diese Metriken werden intern berechnet und fliessen in die Zustandsinferenz ein:

**Exploration/Elaboration Ratio:**
Klassifiziert jedes Segment als "Exploration" (neue Richtung) oder "Elaboration" (Vertiefung):
- `avgSim < EXPLORATION_COSINE_THRESHOLD (0.55)` zu allen vorherigen → Exploration
- `maxSim > ELABORATION_COSINE_THRESHOLD (0.70)` zu einem vorherigen → Elaboration
- Ratio = Exploration / (Exploration + Elaboration)
- Beide Schwellenwerte sind live anpassbar

**Semantic Expansion Score:**
Vergleicht aktuelle Metriken mit den letzten 5 Snapshots. Positiv = Ideenraum waechst, negativ = schrumpft:
```
deltaConcentration = vorher_avgConcentration - jetzt_concentration  (positiv = besser)
deltaNovelty = jetzt_noveltyRate - vorher_avgNovelty                (positiv = besser)

expansionScore = 0.5 × deltaConcentration + 0.5 × deltaNovelty
Bereich: -1 bis +1
```

**Datei:** `lib/state/inferConversationState.ts`

---

## Interventions-Engine

Die Interventions-Engine nutzt den erkannten Gespraechszustand, um zu entscheiden ob und wie der KI-Moderator eingreifen soll.

### Phasen der Engine

| Phase | Beschreibung | Dauer |
|-------|-------------|-------|
| MONITORING | Beobachtet das Gespraech | Unbegrenzt |
| CONFIRMING | Problematischer Zustand erkannt, wartet auf Bestaetigung | `CONFIRMATION_SECONDS` (30s) |
| POST_CHECK | Intervention wurde gesendet, wartet auf Wirkung | `POST_CHECK_SECONDS` (90s) |
| COOLDOWN | Pause nach Eskalation | `COOLDOWN_SECONDS` (180s) |

### Zustand → Intervention

| Zustand | Intent | Beschreibung |
|---------|--------|-------------|
| DOMINANCE_RISK | PARTICIPATION_REBALANCING | Stille Teilnehmer einbeziehen |
| CONVERGENCE_RISK | PERSPECTIVE_BROADENING | Neue Perspektiven anregen |
| STALLED_DISCUSSION | REACTIVATION | Gespraech wieder in Gang bringen |
| Eskalation | ALLY_IMPULSE | Kreativer Impuls (nur Szenario B) |

### Sicherheitsmechanismen

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | 1–20 | Maximale Interventionen pro 10 Minuten |
| `TTS_RATE_LIMIT_SECONDS` | 30 | 10–120 | Mindestabstand zwischen Sprachausgaben |
| `CONFIRMATION_SECONDS` | 30 | 5–120 | Wie lange ein Problem bestehen muss |
| `COOLDOWN_SECONDS` | 180 | 10–600 | Zwangspause nach Eskalation |
| `POST_CHECK_SECONDS` | 90 | 5–300 | Wartezeit bevor Wirkung geprueft wird |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | 0.01–0.50 | Wie viel Verbesserung als "erholt" gilt |
| `MIN_CONFIDENCE` | 0.45 | — | Mindestkonfidenz fuer Aktion (hardcoded) |

**Datei:** `lib/decision/interventionPolicy.ts`

---

## KI-Integration

### Architektur

```
Browser (Client)                           Server
━━━━━━━━━━━━━━━━                           ━━━━━━

useMetricsComputation
    │
    ▼
computeMetricsAsync()
    │
    ▼
embeddingCache.getOrFetchEmbeddings()
    │
    ├── Cache Hit → sofort zurueck
    │
    └── Cache Miss ─── POST /api/embeddings ──→ OpenAI API
                                                │ text-embedding-3-small
                                                │ (1536 Dimensionen)
                                                │
         ◄──────────── embeddings[] ────────────┘
    │
    ├── In Memory-Cache speichern
    ├── In localStorage persistieren (LRU, max 500)
    │
    ▼
Metriken berechnen
```

### Cache-Strategie

1. **In-Memory Cache** — schnellster Zugriff
2. **localStorage** — ueberlebt Seitenreload
3. **API-Fetch** — nur bei Cache-Miss
4. **LRU-Eviction** — max 500 Eintraege, aelteste werden entfernt
5. **Text-Deduplizierung** — identische Texte teilen ein Embedding

### Graceful Degradation

Wenn Embeddings nicht verfuegbar (API-Fehler, kein Key, Timeout):

| Metrik | Fallback-Methode |
|--------|-----------------|
| Novelty | Jaccard-Wortmengen (Schwelle 0.40) |
| Concentration | Jaccard-Clustering (Schwelle 0.40) |
| Repetition | Jaccard aufeinanderfolgende Paare |
| Stagnation | Zeitbasiert (ohne Semantik) |
| Diversity | MATTR / Type-Token Ratio |
| Balance | Nicht betroffen (kein KI-Einsatz) |
| Participation Risk | Nicht betroffen (kein KI-Einsatz) |

---

## Anpassbare Parameter

Alle Parameter koennen **live waehrend einer Session** im "Tuning"-Tab angepasst werden. Aenderungen wirken sofort ab dem naechsten Berechnungszyklus.

### Schwellenwerte (wann wird interveniert?)

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_PARTICIPATION_RISK` | 0.55 | 0.10–1.00 | Ab wann Participation Risk als Problem gilt |
| `THRESHOLD_NOVELTY_RATE` | 0.30 | 0.05–0.80 | Unter diesem Novelty-Wert wird gewarnt |
| `THRESHOLD_CLUSTER_CONCENTRATION` | 0.70 | 0.30–1.00 | Ab wann Concentration als Problem gilt |
| `THRESHOLD_IMBALANCE` | 0.65 | 0.10–1.00 | Balance-Schwelle (im UI: 1 - Wert) |
| `THRESHOLD_REPETITION` | 0.75 | 0.10–1.00 | Ab wann Repetition als Problem gilt |
| `THRESHOLD_STAGNATION_SECONDS` | 180 | 15–600 | Stagnation in Sekunden |
| `THRESHOLD_SILENT_PARTICIPANT` | 0.05 | 0.01–0.30 | Ab wann jemand als "still" gilt |

### Berechnungsparameter (wie werden Metriken berechnet?)

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `NOVELTY_COSINE_THRESHOLD` | 0.65 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Novelty-Berechnung |
| `CLUSTER_MERGE_THRESHOLD` | 0.60 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Cluster-Zuordnung |
| `STAGNATION_NOVELTY_THRESHOLD` | 0.70 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Stagnation |
| `EXPLORATION_COSINE_THRESHOLD` | 0.55 | 0.20–0.85 | Avg-Aehnlichkeit unter diesem Wert = Exploration |
| `ELABORATION_COSINE_THRESHOLD` | 0.70 | 0.40–0.95 | Max-Aehnlichkeit ueber diesem Wert = Elaboration |
| `PARTICIPATION_RISK_WEIGHTS` | [0.35, 0.25, 0.25, 0.15] | je 0.0–1.0 | Gewichte: [Hoover, Silent, Streak, TurnHoover] |

### Timing-Parameter

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `WINDOW_SECONDS` | 180 | 30–600 | Laenge des rollierenden Analysefensters |
| `ANALYZE_EVERY_MS` | 5000 | 1000–30000 | Berechnungsintervall |
| `CONFIRMATION_SECONDS` | 30 | 5–120 | Bestaetigung bevor Intervention |
| `COOLDOWN_SECONDS` | 180 | 10–600 | Zwangspause nach Eskalation |
| `POST_CHECK_SECONDS` | 90 | 5–300 | Wartezeit fuer Wirkungspruefung |
| `PERSISTENCE_SECONDS` | 120 | 5–300 | Wie lange Problem bestehen muss (v1) |

### Sicherheitslimits

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | 1–20 | Max. Interventionen pro 10 Minuten |
| `TTS_RATE_LIMIT_SECONDS` | 30 | 10–120 | Mindestabstand zwischen Sprachausgaben |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | 0.01–0.50 | Verbesserung fuer "erholt"-Status |

---

## Glossar

### Hoover-Index (Pietra-Index)
Mass fuer Ungleichheit einer Verteilung. Berechnet als normalisierte Summe der absoluten Abweichungen vom Idealwert (1/n). 0 = perfekt gleich, 1 = maximal ungleich. Hier verwendet fuer: Verteilung der Redezeit und Anzahl Wortbeitraege. (Wird manchmal faelschlicherweise als "Gini-Koeffizient" bezeichnet, ist aber mathematisch ein anderes Mass.)

### Kosinus-Aehnlichkeit (Cosine Similarity)
Misst den Winkel zwischen zwei Vektoren im hochdimensionalen Raum. Bereich: -1 bis +1 (fuer Embeddings typisch 0 bis 1). 1 = identische Richtung (identischer Inhalt), 0 = orthogonal (voellig unterschiedlich).

### Embedding
Ein Text wird durch ein neuronales Netz (hier: OpenAI `text-embedding-3-small`) in einen Vektor aus 1536 Zahlen umgewandelt. Semantisch aehnliche Texte haben aehnliche Vektoren. Ermoeglicht mathematischen Vergleich von Textinhalten.

### Jaccard-Aehnlichkeit
Vergleicht zwei Mengen: |Schnittmenge| / |Vereinigungsmenge|. Einfacher als Embeddings, aber weniger nuanciert. Verwendet als Fallback wenn keine Embeddings verfuegbar.

### HHI (Herfindahl-Hirschman-Index)
Mass fuer Konzentration. Summe der quadrierten Anteile. Bereich: 1/n (perfekt verteilt) bis 1 (alles in einem). In der App wird der **normalisierte HHI** verwendet: (HHI - 1/n) / (1 - 1/n), skaliert auf exakt 0–1. Hier verwendet fuer Themen-Cluster-Konzentration.

### TTR (Type-Token Ratio)
Verhaeltnis einzigartiger Woerter (Types) zu allen Woertern (Tokens). Hoher TTR = vielfaeltiges Vokabular. Problem: TTR sinkt natuerlich mit der Textlaenge.

### MATTR (Moving Average Type-Token Ratio)
Laengenunabhaengige Variante des TTR. Berechnet TTR fuer ein gleitendes Fenster fester Groesse (50 Woerter) und mittelt alle Fenster. Standard in der Computerlinguistik.

### Hysterese
Verhinderung von schnellem Hin-und-Her-Wechseln (Flackern). Ein neuer Zustand muss deutlich staerker sein als der aktuelle (hier: 8% Vorsprung), um zu wechseln.

### Zentroid (Centroid)
Mittelpunkt eines Clusters, berechnet als Durchschnitt aller enthaltenen Vektoren. Wird bei jedem neuen Cluster-Mitglied aktualisiert.

### Greedy Clustering
"Gieriger" Clustering-Algorithmus: Jedes Segment wird sofort dem aehnlichsten bestehenden Cluster zugeordnet oder erzeugt einen neuen. Kein Rueckblick, keine Optimierung — schnell aber nicht optimal.

### Rolling Window
Gleitendes Zeitfenster: Nur Daten der letzten X Sekunden werden beruecksichtigt. Aeltere Daten "fallen raus". Dadurch reflektieren die Metriken immer den aktuellen Stand des Gespraechs.
