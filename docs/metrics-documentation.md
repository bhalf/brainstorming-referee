# Conversation Health Metriken — Dokumentation

Diese Dokumentation beschreibt alle 7 Metriken im "Conversation Health"-Panel, wie sie berechnet werden, und wo KI (OpenAI Embeddings) eingesetzt wird.

---

## Uebersicht

| Metrik | Wert-Bereich | Besser wenn | KI-Einsatz | Quell-Datei |
|--------|-------------|-------------|------------|-------------|
| **Participation Risk** | 0–100% | Niedrig | Nein | `lib/metrics/participation.ts` |
| **Novelty** | 0–100% | Hoch | Ja (Embeddings) | `lib/metrics/semanticDynamics.ts` |
| **Concentration** | 0–100% | Niedrig | Ja (Embeddings) | `lib/metrics/semanticDynamics.ts` |
| **Balance** | 0–100% | Hoch | Nein | `lib/metrics/computeMetrics.ts` |
| **Repetition** | 0–100% | Niedrig | Hybrid | `lib/metrics/computeMetrics.ts` + `embeddingCache.ts` |
| **Stagnation** | 0s–∞ | Niedrig | Hybrid | `lib/metrics/computeMetrics.ts` |
| **Diversity** | 0–100% | Hoch | Nein (Fallback: Ja) | `lib/metrics/computeMetrics.ts` + `embeddingCache.ts` |

**Hybrid** = Primaer mit OpenAI Embeddings, Fallback auf rein algorithmische Berechnung (Jaccard/TTR) wenn Embeddings nicht verfuegbar.

---

## Zeitfenster (Rolling Window)

Alle Metriken werden auf einem **rollierenden Zeitfenster** berechnet:

```
windowStart = aktuelleZeit - (WINDOW_SECONDS × 1000)
windowedSegments = alle Segmente mit timestamp >= windowStart
```

- **Standard:** `WINDOW_SECONDS = 180` (3 Minuten)
- **Berechnungsintervall:** `ANALYZE_EVERY_MS = 5000` (alle 5 Sekunden)
- **Min/Max:** 30s – 600s (konfigurierbar)

So reflektieren die Metriken immer das **aktuelle** Gespraechsverhalten, nicht die gesamte Session.

Datei: `lib/hooks/useMetricsComputation.ts` → `lib/metrics/computeMetrics.ts:computeMetricsAsync()`

---

## 1. Participation Risk (⚠️)

**Was es zeigt:** Wie ungleich die Teilnahme verteilt ist. Hoher Wert = eine Person dominiert oder andere sind still.

**Schwellenwert (gelbe Linie):** `THRESHOLD_PARTICIPATION_RISK = 0.55` (55%)

**KI-Einsatz:** Keiner — rein algorithmisch.

### Berechnung

Gewichteter Durchschnitt aus 4 Sub-Metriken:

```
participationRiskScore = (0.35 × giniImbalance)
                       + (0.25 × silentParticipantRatio)
                       + (0.25 × dominanceStreakScore)
                       + (0.15 × turnGini)
```

#### 1a) Gini Imbalance (35% Gewicht)

Misst die Abweichung von gleichmaessiger Teilnahme basierend auf **Wortanzahl pro Sprecher**.

```
shares[speaker] = wortanzahl[speaker] / gesamtWortanzahl
perfectShare = 1 / anzahlSprecher

giniImbalance = Σ|share - perfectShare| / (2 × (1 - perfectShare))
```

- 0 = alle sprechen gleich viel
- 1 = eine Person spricht alles

#### 1b) Silent Participant Ratio (25% Gewicht)

Anteil der Teilnehmer mit weniger als 5% des Gesamtvolumens.

```
silentCount = Sprecher mit volumeShare < 0.05
silentParticipantRatio = silentCount / anzahlSprecher
```

- 0 = niemand ist still
- 1 = alle bis auf einen sind still

#### 1c) Dominance Streak Score (25% Gewicht)

Misst ob ein Sprecher **aufeinanderfolgende Turns** monopolisiert.

```
maxRun = laengste aufeinanderfolgende Segmente desselben Sprechers (letzte 30 Segmente)
rawStreak = maxRun / anzahlSegmente
expectedStreak = 1 / anzahlSprecher

dominanceStreakScore = (rawStreak - expectedStreak) / (1 - expectedStreak)
```

Geklammert auf [0, 1].

#### 1d) Turn Gini (15% Gewicht)

Gleiche Gini-Berechnung wie 1a, aber auf **Anzahl Turns** statt Wortanzahl.

**Datei:** `lib/metrics/participation.ts`

---

## 2. Novelty (💡)

**Was es zeigt:** Anteil der letzten Segmente, die **semantisch neue Ideen** einfuehren.

**Schwellenwert (gelbe Linie):** `THRESHOLD_NOVELTY_RATE = 0.3` (30%) — unter 30% Warnung.

**KI-Einsatz:** Ja — **OpenAI Embeddings** (`text-embedding-3-small`).

### Berechnung

1. Texte der letzten 20 Segmente (aus max. 30 im Fenster) werden als Embeddings an OpenAI gesendet
2. Fuer jedes Segment wird die **durchschnittliche Kosinus-Aehnlichkeit** zu allen vorhergehenden Segmenten berechnet
3. Ein Segment gilt als **novel** wenn `avgCosineSimilarity < 0.80`

```
noveltyRate = anzahlNovelerSegmente / anzahlAusgewerteterSegmente
```

- Das erste Segment zaehlt immer als novel
- Bei <2 Segmenten: noveltyRate = 1.0 (alles ist neu)
- **93% im Screenshot** = 93% der letzten Aeusserungen bringen neue Ideen ein

### Fallback (ohne Embeddings)

Jaccard-Wortmengen-Aehnlichkeit mit Schwellenwert 0.40 statt Kosinus-Aehnlichkeit 0.80.

**Datei:** `lib/metrics/semanticDynamics.ts:computeNoveltyRate()`

---

## 3. Concentration (🎯)

**Was es zeigt:** Wie stark die Themen auf wenige Cluster konzentriert sind. Niedriger Wert = breit gestreute Themen.

**Schwellenwert (gelbe Linie):** `THRESHOLD_CLUSTER_CONCENTRATION = 0.7` (70%)

**KI-Einsatz:** Ja — **OpenAI Embeddings** (`text-embedding-3-small`).

### Berechnung

1. **Greedy Centroid Clustering** der Segment-Embeddings:
   - Erstes Segment = erster Cluster
   - Fuer jedes weitere Segment: Kosinus-Aehnlichkeit zu allen bestehenden Cluster-Zentroiden berechnen
   - Wenn max. Aehnlichkeit ≥ 0.75 → in bestehenden Cluster mergen (Zentroid als laufender Durchschnitt aktualisiert)
   - Sonst → neuen Cluster erstellen

2. **Konzentration** als Kombination aus zwei Masse:

```
spreadRatio = 1 - (anzahlCluster / anzahlSegmente)
HHI = Σ(clusterAnteil²)    [Herfindahl-Hirschman-Index]

concentration = 0.5 × spreadRatio + 0.5 × HHI
```

- **spreadRatio** nahe 0 = viele kleine Cluster (gut)
- **HHI** nahe 0 = gleichmaessig verteilte Cluster (gut)
- **20% im Screenshot** = Themen sind breit verteilt

### Fallback (ohne Embeddings)

Gleiches Clustering-Verfahren, aber mit Jaccard-Wortmengen-Aehnlichkeit (Schwellenwert 0.40) statt Kosinus auf Embeddings.

**Datei:** `lib/metrics/semanticDynamics.ts:computeClusterConcentration()`

---

## 4. Balance (⚖️)

**Was es zeigt:** Wie gleichmaessig die Redezeit verteilt ist. Hoher Wert = alle sprechen aehnlich viel.

**Schwellenwert (gelbe Linie):** `1 - THRESHOLD_IMBALANCE = 0.35` (35%)

**KI-Einsatz:** Keiner — rein algorithmisch.

### Berechnung

```
Balance = 1 - participationImbalance
```

`participationImbalance` ist der **Gini-Koeffizient** auf der Sprecher-Verteilung:

```
distribution[speaker] = Summe der Textlaengen (Zeichen) aller Segmente
shares[speaker] = distribution[speaker] / gesamteTextlaenge
perfectShare = 1 / anzahlSprecher

imbalance = Σ|share - perfectShare| / (2 × (1 - perfectShare))
```

Alternativ: wenn Audio-basierte Sprechzeiten vorhanden (LiveKit `isSpeaking` Tracking), werden diese statt Textlaenge verwendet.

- **86% im Screenshot** = Teilnahme ist gut verteilt
- 100% = perfekt gleich
- 0% = eine Person spricht alles

**Datei:** `lib/metrics/computeMetrics.ts:computeParticipationImbalance()`

---

## 5. Repetition (🔁)

**Was es zeigt:** Wie stark sich aufeinanderfolgende Segmente inhaltlich wiederholen.

**Schwellenwert (gelbe Linie):** `THRESHOLD_REPETITION = 0.75` (75%)

**KI-Einsatz:** Hybrid — primaer Embeddings, Fallback Jaccard.

### Berechnung (mit Embeddings)

Durchschnittliche **Kosinus-Aehnlichkeit** zwischen **aufeinanderfolgenden** Segment-Embeddings:

```
Fuer i = 1 bis N (letzte 30 Segmente):
    similarity[i] = cosineSimilarity(embedding[i-1], embedding[i])

repetitionRate = Σsimilarity / anzahlPaare
```

- 0 = jedes Segment ist voellig anders als das vorherige
- 1 = identischer Inhalt
- **38% im Screenshot** = moderate Wiederholung, Inhalt variiert

### Fallback (ohne Embeddings)

**Jaccard-Wortmengen-Aehnlichkeit** auf den letzten 10 Segmenten:

```
Fuer jedes aufeinanderfolgende Paar (A, B):
    worteA = Menge aller Woerter >2 Zeichen in A
    worteB = Menge aller Woerter >2 Zeichen in B

    jaccard = |worteA ∩ worteB| / |worteA ∪ worteB|

repetitionRate = Durchschnitt aller Jaccard-Werte
```

**Dateien:** `lib/metrics/embeddingCache.ts:computeEmbeddingRepetition()` + `lib/metrics/computeMetrics.ts:computeSemanticRepetitionRate()`

---

## 6. Stagnation (⏱️)

**Was es zeigt:** Wie lange es her ist, seit jemand etwas wirklich **Neues** gesagt hat. Angezeigt in Sekunden.

**Schwellenwert (gelbe Linie):** `THRESHOLD_STAGNATION_SECONDS = 180` (3 Minuten)

**KI-Einsatz:** Hybrid — primaer Embeddings, Fallback zeitbasiert.

### Berechnung (mit Embeddings)

Geht rueckwaerts durch die letzten 30 Segmente und sucht das letzte Segment das **semantisch novel** war:

```
Fuer i = N rueckwaerts bis 1:
    avgSimilarity = durchschnittliche Kosinus-Aehnlichkeit von Segment[i] zu allen vorherigen

    Wenn avgSimilarity < 0.85:
        → Dieses Segment hat neuen Inhalt eingefuehrt
        → stagnationDuration = (aktuelleZeit - timestamp[i]) / 1000
        → STOP

Wenn kein noveles Segment gefunden:
    → stagnationDuration = Zeit seit dem aeltesten Segment im Fenster
```

- **14s im Screenshot** = vor 14 Sekunden kam der letzte wirklich neue Inhalt
- Anzeige: "Active" wenn <5s, sonst "Xs"

### Normalisierung fuer den Balken

```
stagnationMax = THRESHOLD_STAGNATION_SECONDS × 1.5    (= 270s)
stagnationNorm = min(1, stagnationDuration / stagnationMax)
```

### Fallback (ohne Embeddings)

Einfach: Zeit seit dem letzten Segment (ohne semantische Analyse).

```
stagnationDuration = (aktuelleZeit - timestamp[letztesSegment]) / 1000
```

**Datei:** `lib/metrics/computeMetrics.ts:computeStagnationDurationSemantic()`

---

## 7. Diversity (🌐)

**Was es zeigt:** Wie vielfaeltig das verwendete Vokabular ist.

**Schwellenwert (gelbe Linie):** `0.3` (30%, hardcoded in UI)

**KI-Einsatz:** Primaer mit Embeddings, Fallback rein algorithmisch (TTR).

### Berechnung (mit Embeddings)

```
Fuer alle Segment-Paare (i, j) in den letzten 30 Segmenten:
    similarity = cosineSimilarity(embedding[i], embedding[j])

avgSimilarity = Durchschnitt aller Paar-Aehnlichkeiten
diversity = 1 - avgSimilarity
```

- Hohe Diversity = Segmente haben semantisch unterschiedliche Inhalte
- **74% im Screenshot** = gute Vokabular-Breite

### Fallback (ohne Embeddings): Type-Token Ratio (TTR)

```
alleWoerter = alle Woerter >2 Zeichen aus allen Segmenten im Fenster
uniqueWoerter = Menge der einzigartigen Woerter

diversity = |uniqueWoerter| / |alleWoerter|
```

- 0 = dasselbe Wort wird immer wiederholt
- 1 = jedes Wort kommt nur einmal vor

**Dateien:** `lib/metrics/embeddingCache.ts:computeEmbeddingDiversity()` + `lib/metrics/computeMetrics.ts:computeDiversityDevelopment()`

---

## KI-Integration: OpenAI Embeddings

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
                                                │ (Fallback: text-embedding-ada-002)
                                                │
         ◄──────────── embeddings[] ────────────┘
    │
    ├── In Memory-Cache speichern
    ├── In localStorage persistieren (LRU, max 500 Eintraege)
    │
    ▼
Metriken berechnen (Novelty, Concentration, Repetition, Stagnation, Diversity)
```

### Embedding-Modell

- **Primaer:** `text-embedding-3-small` (OpenAI) — 1536 Dimensionen
- **Fallback:** `text-embedding-ada-002` (OpenAI)
- **Timeout:** 5000ms
- **Max Batch:** 50 Texte pro Request

### Cache-Strategie

1. **In-Memory Cache** (`Map<segmentId, number[]>`) — O(1) Lookup
2. **localStorage Persistenz** — ueberlebt Seitenreload
3. **LRU Eviction** — max 500 Eintraege (~6MB)
4. **Text-Deduplizierung** — identische Texte teilen sich ein Embedding (spart API-Tokens)

### Graceful Degradation

Wenn Embeddings nicht verfuegbar sind (API-Fehler, kein API-Key, Timeout):
- **Novelty** → Jaccard-Wortmengen-Aehnlichkeit (Schwellenwert 0.40)
- **Concentration** → Jaccard-basiertes Clustering
- **Repetition** → Jaccard aufeinanderfolgende Paare
- **Stagnation** → Zeit seit letztem Segment (ohne Semantik)
- **Diversity** → Type-Token Ratio
- **Balance, Participation Risk** → nicht betroffen (nutzen keine Embeddings)

Die Metriken-Berechnung blockiert **nie** — Fehler werden abgefangen und Fallbacks aktiviert.

**Dateien:**
- `lib/metrics/embeddingCache.ts` — Cache, Kosinus-Aehnlichkeit, Batch-Fetch
- `app/api/embeddings/route.ts` — API-Route mit Fallback-Chain
- `lib/config/modelRouting.ts` — Modell-Konfiguration

---

## Konfiguration (Schwellenwerte)

Alle Schwellenwerte sind in `lib/config.ts` als `ExperimentConfig` definiert:

```typescript
THRESHOLD_PARTICIPATION_RISK: 0.55    // Participation Risk (55%)
THRESHOLD_NOVELTY_RATE: 0.3           // Novelty (30%)
THRESHOLD_CLUSTER_CONCENTRATION: 0.7  // Concentration (70%)
THRESHOLD_IMBALANCE: 0.65             // Balance → 1 - 0.65 = 0.35 (35%)
THRESHOLD_REPETITION: 0.75            // Repetition (75%)
THRESHOLD_STAGNATION_SECONDS: 180     // Stagnation (180s = 3 min)
// Diversity: 0.3 (hardcoded im UI-Panel)
```

**Gelbe Linie** im UI = Schwellenwert. Wenn eine Metrik die Linie ueberschreitet (oder unterschreitet bei "hoeher ist besser"), wird der Balken **rot** und der Status-Text aendert sich.

---

## UI-Anzeige

**Datei:** `components/AnalysisPanel.tsx`

Jede Metrik wird als `MetricBar` Komponente dargestellt:
- **Gruener Balken:** Metrik ist im gesunden Bereich
- **Roter Balken:** Schwellenwert ueberschritten (Interventionsbedarf)
- **Gelbe Linie:** Position des Schwellenwerts
- **Status-Text:** Kontextuelle Beschreibung (z.B. "Participation is balanced" vs. "High participation imbalance risk")

---

## Berechnungs-Pipeline

```
Alle 5 Sekunden (ANALYZE_EVERY_MS):

1. Segmente im Zeitfenster filtern (letzte 180s)

2. v1 Metriken berechnen:
   ├── speakingTimeDistribution (Textlaenge oder Audio-Sprechzeit pro Sprecher)
   ├── participationImbalance (Gini-Koeffizient → Balance)
   ├── semanticRepetitionRate (Embedding-Kosinus oder Jaccard → Repetition)
   ├── stagnationDuration (Embedding-Novelty oder Zeitstempel → Stagnation)
   └── diversityDevelopment (Embedding-Diversity oder TTR → Diversity)

3. v2 Metriken berechnen:
   ├── participation (4 Sub-Metriken → Participation Risk)
   └── semanticDynamics (Novelty, Concentration, Exploration/Elaboration, Expansion)

4. Conversation State inferieren:
   └── 5 Zustaende: HEALTHY_EXPLORATION, HEALTHY_ELABORATION,
       DOMINANCE_RISK, CONVERGENCE_RISK, STALLED_DISCUSSION

5. MetricSnapshot erstellen und an:
   ├── React Context (UI-Update)
   └── Supabase (fire-and-forget Persistenz)
```

**Dateien:**
- `lib/hooks/useMetricsComputation.ts` — Orchestrierung
- `lib/metrics/computeMetrics.ts` — v1 + async Berechnung
- `lib/metrics/participation.ts` — v2 Participation
- `lib/metrics/semanticDynamics.ts` — v2 Semantic Dynamics
- `lib/state/inferConversationState.ts` — State Inference
