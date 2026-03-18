# Backend-Probleme: Decision Engine — zu schnelles Feuern & fehlendes Cooldown

**Datum:** 2026-03-17
**Beobachtet im Frontend-Test** mit 2 Geräten, `moderation_level: moderation`

---

## 1. Kernproblem: Zwei identische Interventionen in 18 Sekunden

Im Test kamen zwei `PARTICIPATION_REBALANCING`-Interventionen innerhalb von 18 Sekunden:

| # | Intent | Timestamp | Text |
|---|--------|-----------|------|
| 1 | BETEILIGUNGSAUSGLEICH | 17:04:33 | (Moderator-Text) |
| 2 | BETEILIGUNGSAUSGLEICH | 17:04:51 | "Anna, was hältst du von der Idee..." |

**Das sollte nicht passieren.** Nach dem Feuern einer Intervention muss die Engine in POST_CHECK (180s) gehen, und danach in COOLDOWN (180s). Zwei Interventionen des gleichen Intents dürften frühestens nach ~360s kommen.

### Mögliche Ursachen

1. **Phasen-Transition funktioniert nicht:** Die Engine bleibt in MONITORING statt nach dem Feuern in POST_CHECK zu wechseln.
2. **Mehrere Engine-Instanzen:** Falls der Agent bei Reconnect einen neuen Session-Agent startet ohne den alten zu beenden, laufen zwei Decision-Loops parallel.
3. **Double-Write-Logik fehlerhaft:** Das "erst leer, dann mit Text"-Pattern könnte dazu führen, dass die Decision Engine den leeren Eintrag nicht als "bereits gefeuert" erkennt und nochmal feuert.

---

## 2. Fehlendes Cooldown nach Intervention

Aus dem Vergleich mit dem alten System (siehe `vergleich_alt_neu_decision_engine.md`):

**Erwarteter Flow:**
```
MONITORING → CONFIRMING (45s warten) → Intervention feuern → POST_CHECK (180s) → COOLDOWN (180s) → MONITORING
```

**Beobachtetes Verhalten:** Interventionen kommen alle paar Sekunden, als gäbe es kein CONFIRMING oder POST_CHECK.

**Frage:** Ist der Phasen-Automat (MONITORING → CONFIRMING → POST_CHECK → COOLDOWN) überhaupt implementiert und aktiv? Der `engine_state` im Frontend zeigt die Phasen an — bitte prüfen ob die Engine-State-Updates in der DB korrekt geschrieben werden.

---

## 3. Fehlende Persistenz-Prüfung (70%-Check)

Das alte System hatte einen Sliding-Window-Check bevor eine Intervention gefeuert wurde:
- ≥70% der Metrik-Snapshots im 45s-Bestätigungsfenster mussten einen Risiko-Zustand zeigen
- Falls <70%: Timer wird zurückgesetzt

**Aktuelles Verhalten (laut Dok):** Wenn nach 45s der aktuelle State ein Risiko ist, wird sofort interveniert — egal ob die Situation die ganze Zeit riskant war oder nur am Ende der 45s kurz riskant wurde.

**Empfehlung:** 70%-Persistenz-Check einbauen. Pseudo-Code:
```python
risk_snapshots = [s for s in window_snapshots if s.state in RISK_STATES]
if len(risk_snapshots) / len(window_snapshots) < 0.70:
    # Reset confirmation, don't fire
    self.phase = "MONITORING"
    return
```

---

## 4. Fehlende Fatigue-basierte adaptive Zeiten

Das alte System hat nach aufeinanderfolgenden Fehlschlägen die Zeiten verlängert:

| Aufeinanderfolgende Fehlschläge | Confirmation | Cooldown |
|---|---|---|
| 0 | 45s | 180s |
| 1 | 67.5s (1.5x) | 270s (1.5x) |
| 2+ | 90s (2x) | 360s (2x) |

**Aktuell:** Feste 45s/180s/180s — das System interveniert also mindestens alle ~225s, selbst wenn vorherige Interventionen wirkungslos waren.

**Empfehlung:** Fatigue-Multiplikator einbauen:
```python
consecutive_failures = count_recent_unrecovered_interventions()
multiplier = min(1.0 + 0.5 * consecutive_failures, 2.0)
confirmation_seconds = 45 * multiplier
cooldown_seconds = 180 * multiplier
```

---

## 5. Fehlendes Partial-Recovery-Konzept

Das alte System hatte 3 Recovery-Ergebnisse:
- `recovered`: Hauptkriterien erfüllt → MONITORING
- `partial` (score ≥ 0.05): Mindestens ein Kriterium verbessert → MONITORING
- `not_recovered`: Keine Verbesserung → COOLDOWN

**Aktuell:** Nur `recovered` (true/false). Bei teilweiser Verbesserung geht das System in COOLDOWN (180s Pause), obwohl die Intervention teilweise gewirkt hat.

---

## 6. Checkliste für Backend-Fix

- [ ] **Prüfen ob Phasen-Automat korrekt läuft:** Nach Intervention → POST_CHECK → COOLDOWN
- [ ] **Prüfen ob nur eine Engine-Instanz pro Session:** Bei Agent-Reconnect alte Instanz beenden
- [ ] **engine_state in DB schreiben:** Frontend liest `engine_state` via Realtime — Phase muss aktuell sein
- [ ] **70%-Persistenz-Check einbauen** (Sliding Window über CONFIRMING-Phase)
- [ ] **Fatigue-Multiplikator einbauen** (adaptive Zeiten nach Fehlschlägen)
- [ ] **Partial-Recovery einbauen** (3-stufig statt binär)
- [ ] **MAX_INTERVENTIONS_PER_10MIN=3 enforced?** — In 18s kamen schon 2, das Limit scheint nicht zu greifen

---

## 7. Was das Frontend jetzt tut (Workarounds)

Da die Backend-Fixes Zeit brauchen, hat das Frontend jetzt folgende Guards:

1. **Age-Guard (30s):** Nur Interventionen die max 30s alt sind lösen das Overlay aus (`useRealtimeInterventions.ts`)
2. **Initial Fetch + Dedup:** Beim Mount werden bestehende Interventionen geladen und als "gesehen" markiert, damit Realtime-Re-Broadcasts keine Duplikate zeigen
3. **TTS-Sync:** Overlay bleibt sichtbar solange der Agent-AudioTrack spielt

Das sind aber nur Frontend-Workarounds — das eigentliche Problem (zu schnelles Feuern) muss im Backend gelöst werden.
