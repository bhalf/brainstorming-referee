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

### Im Dashboard angezeigte Metriken

| # | Metrik | Icon | Wert-Bereich | Besser wenn | Schwellenwert | Quelle | KI | Datei |
|---|--------|------|-------------|-------------|---------------|--------|-----|-------|
| 1 | Participation Risk | ⚠️ | 0–100% | Niedrig | 55% | Config | Nein | `participation.ts` |
| 2 | Balance | ⚖️ | 0–100% | Hoch | 50% | Hardcoded | Nein | `computeMetrics.ts` |
| 3 | Long-Term Balance | 📊 | 0–100% | Hoch | 50% | Hardcoded | Nein | `participation.ts` |
| 4 | Novelty | ✨ | 0–100% | Hoch | 30% | Config | Ja | `semanticDynamics.ts` |
| 5 | Topic Spread | 🎯 | 0–100% | Hoch | 30% | Config | Ja | `semanticDynamics.ts` |
| 6 | Piggybacking | 🔗 | 0–100% | Hoch | 40% | Hardcoded | Ja | `semanticDynamics.ts` |
| 7 | Vocabulary | 🌐 | 0–100% | Hoch | 30% | Hardcoded | Hybrid | `embeddingCache.ts` |
| 8 | Idea Rate | 💬 | 0–∞/min | Hoch | 2/min | Hardcoded | Nein | `semanticDynamics.ts` |
| 9 | Stagnation | ⏸️ | 0s–∞ | Niedrig | 50% normalisiert | Hardcoded | Hybrid | `computeMetrics.ts` |

### Intern berechnete Metriken (nicht im Dashboard)

| Metrik | Wert-Bereich | KI | Status | Datei |
|--------|-------------|-----|--------|-------|
| Repetition (semanticRepetitionRate) | 0–100% | Hybrid | Legacy — ersetzt durch Novelty Rate | `embeddingCache.ts` |
| Exploration/Elaboration Ratio | 0–100% | Ja | Fliesst in State Inference ein | `semanticDynamics.ts` |
| Semantic Expansion Score | -1 bis +1 | Ja | Fliesst in State Inference ein | `semanticDynamics.ts` |

**Config** = Schwellenwert aus `ExperimentConfig`, live anpassbar in den Settings.
**Hardcoded** = Schwellenwert ist fest im Code definiert (nicht live anpassbar).
**Hybrid** = Primaer mit OpenAI Embeddings, Fallback auf rein algorithmische Berechnung wenn Embeddings nicht verfuegbar.

**Gelbe Markierung im UI** = Schwellenwert. Wenn ueberschritten (bzw. unterschritten bei "hoeher ist besser"), wird die Anzeige **rot**.

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
| `THRESHOLD_SILENT_PARTICIPANT` | 0.10 | 0.01–0.30 | Ab welchem Redeanteil jemand als "still" gilt |

#### 1c) Dominance Streak Score (25% Gewicht)

Misst, ob ein Sprecher **mehrere aufeinanderfolgende Wortbeitraege** monopolisiert.

```
maxRun = laengste Serie aufeinanderfolgender Segmente desselben Sprechers
         (in den letzten 50 Segmenten)

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

1. Die letzten 50 Segmente (aus max. 50 im Fenster) werden als **Embedding-Vektoren** dargestellt
2. Fuer jedes Segment: **maximale Kosinus-Aehnlichkeit** zu allen vorhergehenden berechnen
3. Wenn maxSimilarity < `NOVELTY_COSINE_THRESHOLD` (0.45) → Segment ist **novel**

```
Fuer jedes Segment i (i = 1 bis 20):
    maxSim = Maximum von cosineSimilarity(embedding[i], embedding[j]) fuer alle j < i

    Wenn maxSim < 0.45 → novel!

noveltyRate = anzahlNovelerSegmente / anzahlAusgewerteterSegmente
```

**Warum MAX-Aehnlichkeit?** Ein Segment ist nur dann wirklich neu, wenn es sich von ALLEN bisherigen unterscheidet. Wenn es auch nur einem frueheren Segment sehr aehnlich ist, ist es eine Wiederholung.

**Fachbegriff: Kosinus-Aehnlichkeit (Cosine Similarity)** — misst den Winkel zwischen zwei Vektoren im hochdimensionalen Raum. 1.0 = identisch, 0.0 = voellig unterschiedlich, -1.0 = gegensaetzlich.

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `NOVELTY_COSINE_THRESHOLD` | 0.45 | 0.30–0.90 | Unter dieser Aehnlichkeit gilt ein Segment als "novel" (kalibriert fuer text-embedding-3-small UND text-embedding-3-large) |
| `THRESHOLD_NOVELTY_RATE` | 0.30 | 0.05–0.80 | Schwellenwert im UI (gelbe Linie) |

### Fallback (ohne Embeddings)

Statt Kosinus-Aehnlichkeit auf Embedding-Vektoren wird **Jaccard-Aehnlichkeit** auf Wortmengen verwendet:

**Fachbegriff: Jaccard-Aehnlichkeit** — vergleicht zwei Mengen: |Schnittmenge| / |Vereinigungsmenge|. 1.0 = identische Mengen, 0.0 = keine Ueberlappung.

Schwellenwert im Fallback: 0.40 (statt 0.45 fuer Cosine, da Jaccard tendenziell niedrigere Werte liefert).

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
   - Wenn max. Aehnlichkeit ≥ `CLUSTER_MERGE_THRESHOLD` (0.35) → in den aehnlichsten Cluster einordnen und Zentroid als laufenden Durchschnitt aktualisieren
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
| `CLUSTER_MERGE_THRESHOLD` | 0.35 | 0.30–0.90 | Ab welcher Aehnlichkeit ein Segment in einen bestehenden Cluster eingeordnet wird (kalibriert fuer text-embedding-3-small UND text-embedding-3-large) |
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

**Schwellenwert im UI:** 50% (hardcoded — nicht in ExperimentConfig enthalten).

**Datei:** `lib/metrics/computeMetrics.ts:computeParticipationImbalance()`

---

## 5. Repetition (Legacy)

**Icon:** 🔁 | **Bereich:** 0–100% | **Besser wenn:** Niedrig

> **Hinweis:** Diese Metrik wird weiterhin berechnet, aber **nicht mehr im Dashboard angezeigt**.
> Sie wurde durch die **Novelty Rate** (Metrik 2) ersetzt, die ein besseres Signal liefert.
> Die Werte werden im criteriaSnapshot fuer die Forschungsanalyse geloggt.

### Was wird gemessen?
Wie stark sich **aufeinanderfolgende** Aeusserungen inhaltlich wiederholen.

### Berechnung (mit Embeddings)

Durchschnittliche Kosinus-Aehnlichkeit zwischen **aufeinanderfolgenden** Segment-Embeddings:

```
Fuer i = 1 bis N (letzte 50 Segmente):
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

**Dateien:** `lib/metrics/embeddingCache.ts:computeEmbeddingRepetition()` + `lib/metrics/computeMetrics.ts:computeSemanticRepetitionRate()`

---

## 6. Stagnation

**Icon:** ⏱️ | **Bereich:** 0s–∞ | **Besser wenn:** Niedrig | **Schwellenwert:** 180s

### Was wird gemessen?
Wie viele Sekunden es her ist, seit jemand etwas **semantisch Neues** gesagt hat.

### Berechnung (mit Embeddings)

Geht **rueckwaerts** durch die letzten 50 Segmente und sucht das letzte, das inhaltlich neu war:

```
Fuer i = N rueckwaerts bis 1:
    maxSim = Maximum von cosineSimilarity(embedding[i], embedding[j]) fuer alle j < i

    Wenn maxSim < STAGNATION_NOVELTY_THRESHOLD (0.40):
        → Dieses Segment hat neuen Inhalt eingefuehrt
        → stagnationDuration = (aktuelleZeit - timestamp[i]) / 1000
        → STOP

Wenn kein noveles Segment gefunden:
    → stagnationDuration = Zeit seit dem aeltesten Segment im Fenster
```

**Unterschied zu Novelty:** Stagnation misst die *Zeit seit dem letzten neuen Beitrag* (in Sekunden), Novelty misst den *Anteil neuer Beitraege* (in Prozent). Der Stagnation-Schwellenwert ist strenger (0.40 vs. 0.45), weil Stagnation erst dann zurueckgesetzt werden soll, wenn ein Beitrag wirklich deutlich vom Bisherigen abweicht.

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
| `STAGNATION_NOVELTY_THRESHOLD` | 0.40 | 0.30–0.90 | Wie aehnlich ein Segment sein darf, um noch als "neu" zu gelten (kalibriert fuer text-embedding-3-small UND text-embedding-3-large) |

**Datei:** `lib/metrics/computeMetrics.ts:computeStagnationDurationSemantic()`

---

## 7. Diversity

**Icon:** 🌐 | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 30%

### Was wird gemessen?
Wie vielfaeltig das verwendete Vokabular ist. Misst die Breite des Wortschatzes im Gespraech.

### Berechnung (mit Embeddings)

Durchschnittliche **paarweise** Kosinus-Aehnlichkeit aller Segmente:

```
Fuer alle Segment-Paare (i, j) in den letzten 50 Segmenten:
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

## 8. Long-Term Balance (Cumulative Participation)

**Icon:** 📊 | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 50% (hardcoded)

### Was wird gemessen?
Gleichmaessigkeit der Teilnahme ueber ein **laengeres Zeitfenster** (600 Sekunden statt 180). Verhindert "Dominanz-Amnesie": Eine Person, die 5 Minuten lang dominiert hat und dann 2 Minuten still ist, wird trotzdem als problematisch erkannt.

### Berechnung

Identisch zu Balance (Hoover-Index), aber auf Segmenten der letzten `CUMULATIVE_WINDOW_SECONDS` (default: 600s):

```
Long-Term Balance = 1 - cumulativeParticipationImbalance
cumulativeParticipationImbalance = HooverIndex(volumeShare ueber 600s-Fenster)
```

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `CUMULATIVE_WINDOW_SECONDS` | 600 | 180–1200 | Laenge des kumulativen Analyse-Fensters in Sekunden |

**Datei:** `lib/metrics/participation.ts:computeParticipationMetrics()`

---

## 9. Piggybacking (Idea Building)

**Icon:** 🔗 | **Bereich:** 0–100% | **Besser wenn:** Hoch | **Schwellenwert:** 40% (hardcoded)

### Was wird gemessen?
Wie stark die Sprecher **aufeinander aufbauen** (Osborns "Aufbauen auf Ideen anderer"). Hoher Wert = Sprecher greifen Ideen des Vorgaengers auf. Niedriger Wert = parallele Monologe.

### Berechnung (mit Embeddings)

Durchschnittliche Kosinus-Aehnlichkeit zwischen **aufeinanderfolgenden Segmenten unterschiedlicher Sprecher**:

```
Fuer jedes aufeinanderfolgende Segment-Paar (i-1, i) in den letzten 50 Segmenten:
    Wenn speaker[i] != speaker[i-1]:
        similarity = cosineSimilarity(embedding[i-1], embedding[i])

piggybackingScore = Durchschnitt aller Cross-Speaker-Similarities
```

**Wichtig:** Segmente desselben Sprechers werden uebersprungen — es werden nur Sprecherwechsel gemessen.

### Fallback (ohne Embeddings)

Jaccard-Wortmengen-Aehnlichkeit statt Kosinus-Aehnlichkeit, ebenfalls nur bei Sprecherwechseln.

> **Hinweis:** Der Piggybacking-Score fliesst derzeit in **keine Entscheidung** ein. Er wird
> im Dashboard angezeigt und im criteriaSnapshot geloggt, hat aber keinen Einfluss auf
> State Inference oder Interventions-Entscheidungen. Er dient der Forschungsanalyse.

**Datei:** `lib/metrics/semanticDynamics.ts:computePiggybackingScore()`

---

## 10. Ideational Fluency (Idea Rate)

**Icon:** 💬 | **Bereich:** 0–∞ Turns/Minute | **Besser wenn:** Hoch | **Schwellenwert:** 2/min (hardcoded, normalisiert auf 0.2 = Rate/10)

### Was wird gemessen?
Wie viele **substantive Wortbeitraege** pro Minute generiert werden. Basiert auf Alex Osborns Brainstorming-Prinzip "Quantitaet vor Qualitaet". Ein Abfall der Fluency ist ein starkes Signal fuer STALLED_DISCUSSION.

### Berechnung

```
substantiveSegments = Segmente mit > 2 Woertern (Backchannels bereits upstream gefiltert)

durationMinutes = (letzterTimestamp - ersterTimestamp) / 60000

ideationalFluencyRate = substantiveSegments.length / durationMinutes
```

Minimum 30 Sekunden Daten und 2 Segmente benoetigt, sonst Rate = 0.

### Anzeige im UI

Die Rate wird auf eine 0-1-Skala normalisiert mit Maximum 10 Turns/Minute:
```
displayValue = rate / 10     (0.2 = 2 Turns/min, 1.0 = 10+ Turns/min)
```

**Datei:** `lib/metrics/semanticDynamics.ts:computeIdeationalFluencyRate()`

---

## Gespraechszustaende

Aus den Metriken leitet das System automatisch einen von **5 Gespraechszustaenden** ab. Dieser wird im "Conversation State"-Panel angezeigt.

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
Vorbedingung: participationRiskScore muss ≤ 0.5 sein! (sonst Confidence = 0)

stagnationPenalty = clamp(stagnationDuration / 120, 0, 1)

(0.25 × (1 - participationRiskScore) +      ← Geringe Dominanz ist gesund
 0.30 × noveltyRate +                        ← Viel Neuheit ist gesund (staerkstes Signal)
 0.20 × clamp(expansionScore + 0.5, 0, 1) + ← Sich ausweitender Ideenraum
 0.25 × explorationElaborationRatio)         ← Viel Exploration
× (1 - stagnationPenalty)                    ← Abzug bei Stagnation
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
0.30 × participationRiskScore                ← Composite-Risiko
0.25 × silentParticipantRatio                ← Stille Teilnehmer
0.20 × dominanceStreakScore                  ← Monolog-Serien
0.25 × cumulativeParticipationImbalance      ← Langzeit-Ungleichheit (600s-Fenster)
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
0.20 × (1 - noveltyRate)                       ← Keine neuen Ideen
0.25 × clamp(stagnationDuration / 180, 0, 1)   ← Langanhaltende Stille (staerkstes Signal)
0.20 × clamp(-semanticExpansionScore, 0, 1)     ← Ideenraum schrumpft
0.15 × (1 - diversityDevelopment)               ← Wenig Vokabular-Vielfalt
0.20 × fluencyPenalty                           ← Wenige Turns pro Minute

fluencyPenalty = clamp(1 - ideationalFluencyRate / 6, 0, 1)
  → 0 Turns/Min = Penalty 1.0, ≥6 Turns/Min = Penalty 0.0
```

### Zusatzregeln

1. **Hysterese (HYSTERESIS_MARGIN = 0.08):** Um Flackern zu verhindern, muss ein neuer Zustand mindestens 8% mehr Konfidenz haben als der aktuelle, um zu wechseln.

2. **Tiebreak (TIEBREAK_MARGIN = 0.03):** Bei nahezu gleicher Konfidenz (Differenz <3%) gewinnt immer der **Risiko-Zustand** gegenueber einem gesunden Zustand. Prioritaet: STALLED → DOMINANCE → CONVERGENCE → EXPLORATION → ELABORATION.

3. **Sekundaerzustand:** Wenn der zweithoechste Zustand >30% Konfidenz hat, wird er als sekundaerer Zustand angezeigt.

### Interne Hilfsmetriken (nicht im Dashboard, aber entscheidungsrelevant)

Diese Metriken werden intern berechnet und fliessen in die Zustandsinferenz ein:

**Exploration/Elaboration Ratio** (`explorationElaborationRatio`):
Klassifiziert jedes Segment (letzte 20 aus max. 30) als "Exploration" (neue Richtung) oder "Elaboration" (Vertiefung):

```
Fuer jedes Segment i (i > 0):
    avgSim = Durchschnitt von cosineSimilarity(i, j) fuer alle j < i
    maxSim = Maximum von cosineSimilarity(i, j) fuer alle j < i

    Wenn avgSim < EXPLORATION_COSINE_THRESHOLD (0.30) → Exploration
    Sonst wenn maxSim > ELABORATION_COSINE_THRESHOLD (0.50) → Elaboration
    Sonst → nicht klassifiziert (zaehlt nicht)

Ratio = Exploration / (Exploration + Elaboration)
```

- Ratio 1.0 = alles Exploration (viele neue Richtungen)
- Ratio 0.0 = alles Elaboration (nur Vertiefung)
- Ratio 0.5 = neutral (Standardwert bei unzureichenden Daten)
- Beide Schwellenwerte sind live anpassbar

**Semantic Expansion Score** (`semanticExpansionScore`):
Vergleicht aktuelle Metriken mit den letzten 12 Snapshots (~60s bei 5s-Intervall). Positiv = Ideenraum waechst, negativ = schrumpft:
```
deltaConcentration = vorher_avgConcentration - jetzt_concentration  (positiv = besser)
deltaNovelty = jetzt_noveltyRate - vorher_avgNovelty                (positiv = besser)

expansionScore = 0.5 × deltaConcentration + 0.5 × deltaNovelty
Bereich: -1 bis +1
```

Warum 12 Snapshots (nicht 5)? Bei 5-Sekunden-Intervallen und einem 300s-Metriken-Fenster
ueberlappen sich aufeinanderfolgende Snapshots stark. 12 Snapshots (~60s) reduzieren
diese Ueberlappung und machen Trends sichtbarer.

**Datei:** `lib/state/inferConversationState.ts` + `lib/metrics/semanticDynamics.ts`

---

## Interventions-Engine

> **Ausfuehrliche Dokumentation:** Fuer eine vollstaendige Erklaerung der Interventionslogik
> (Szenarien A/B, Rule-Checker, Fatigue-System, Recovery-Pruefung, Zeitablaeufe) siehe
> `docs/interventions-documentation.md`.

Die Interventions-Engine nutzt den erkannten Gespraechszustand, um zu entscheiden ob und wie der KI-Moderator eingreifen soll.

### Phasen der Engine

| Phase | Beschreibung | Dauer |
|-------|-------------|-------|
| MONITORING | Beobachtet das Gespraech | Unbegrenzt |
| CONFIRMING | Problematischer Zustand erkannt, wartet auf Bestaetigung | `CONFIRMATION_SECONDS` (30s) |
| POST_CHECK | Intervention wurde gesendet, wartet auf Wirkung | `POST_CHECK_SECONDS` (180s) |
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
| `POST_CHECK_SECONDS` | 180 | 5–300 | Wartezeit bevor Wirkung geprueft wird |
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

### Schwellenwerte in ExperimentConfig (live anpassbar)

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `THRESHOLD_PARTICIPATION_RISK` | 0.55 | 0.10–1.00 | Ab wann Participation Risk als Problem gilt |
| `THRESHOLD_NOVELTY_RATE` | 0.30 | 0.05–0.80 | Unter diesem Novelty-Wert wird gewarnt |
| `THRESHOLD_CLUSTER_CONCENTRATION` | 0.70 | 0.30–1.00 | Ab wann Concentration als Problem gilt |
| `THRESHOLD_STAGNATION_SECONDS` | 180 | 15–600 | Stagnation in Sekunden |
| `THRESHOLD_SILENT_PARTICIPANT` | 0.10 | 0.01–0.30 | Ab wann jemand als "still" gilt |

### Hardcoded UI-Schwellenwerte (nicht live anpassbar)

Diese Schwellenwerte sind direkt in `DashboardTab.tsx` festgelegt:

| Metrik im Dashboard | Schwellenwert | Beschreibung |
|---------------------|--------------|--------------|
| Balance | 0.50 (50%) | Ab wann Balance als Problem gilt |
| Long-Term Balance | 0.50 (50%) | Ab wann kumulative Balance als Problem gilt |
| Piggybacking (Building) | 0.40 (40%) | Ab wann "wenig Aufbauen" gewarnt wird |
| Vocabulary (Diversity) | 0.30 (30%) | Ab wann geringe Diversitaet gewarnt wird |
| Idea Rate (Fluency) | 0.20 (=2/min) | Normalisiert: Rate/10, Schwelle 0.2 = 2 Turns/min |
| Stagnation | 0.50 (normalisiert) | 50% von `stagnationMax` (= 1.5 × THRESHOLD_STAGNATION_SECONDS) |

### Berechnungsparameter (wie werden Metriken berechnet?)

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `NOVELTY_COSINE_THRESHOLD` | 0.45 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Novelty-Berechnung |
| `CLUSTER_MERGE_THRESHOLD` | 0.35 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Cluster-Zuordnung |
| `STAGNATION_NOVELTY_THRESHOLD` | 0.40 | 0.30–0.90 | Aehnlichkeits-Schwelle fuer Stagnation |
| `EXPLORATION_COSINE_THRESHOLD` | 0.30 | 0.20–0.85 | Avg-Aehnlichkeit unter diesem Wert = Exploration |
| `ELABORATION_COSINE_THRESHOLD` | 0.50 | 0.40–0.95 | Max-Aehnlichkeit ueber diesem Wert = Elaboration |
| `PARTICIPATION_RISK_WEIGHTS` | [0.35, 0.25, 0.25, 0.15] | je 0.0–1.0 | Gewichte: [Hoover, Silent, Streak, TurnHoover] |

### Timing-Parameter

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `WINDOW_SECONDS` | 180 | 30–600 | Laenge des rollierenden Analysefensters |
| `ANALYZE_EVERY_MS` | 5000 | 1000–30000 | Berechnungsintervall |
| `CONFIRMATION_SECONDS` | 30 | 5–120 | Bestaetigung bevor Intervention |
| `COOLDOWN_SECONDS` | 180 | 10–600 | Zwangspause nach Eskalation |
| `POST_CHECK_SECONDS` | 180 | 5–300 | Wartezeit fuer Wirkungspruefung |
| `CUMULATIVE_WINDOW_SECONDS` | 600 | 180–1200 | Langzeit-Fenster fuer kumulative Participation |

### Sicherheitslimits

| Parameter | Default | Bereich | Beschreibung |
|-----------|---------|---------|--------------|
| `MAX_INTERVENTIONS_PER_10MIN` | 3 | 1–20 | Max. Interventionen pro 10 Minuten |
| `TTS_RATE_LIMIT_SECONDS` | 30 | 10–120 | Mindestabstand zwischen Sprachausgaben |
| `RECOVERY_IMPROVEMENT_THRESHOLD` | 0.15 | 0.01–0.50 | Verbesserung fuer "erholt"-Status |
| `RULE_VIOLATION_COOLDOWN_MS` | 15000 | 10000–120000 | Mindestabstand zwischen Rule-Violation-Interventionen (ms) |

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
