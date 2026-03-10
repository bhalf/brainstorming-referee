---
title: "Künstliche Intelligenz als unterstützender Akteur in informellen Brainstorming-Situationen: Ein szenariobasierter Prototyp zur prozessorientierten Moderation"
subtitle: "Bachelorarbeit"
author: "Benjamin Halfar"
date: "2026"
lang: de
geometry: margin=2.5cm
fontsize: 12pt
linestretch: 1.5
toc: true
toc-depth: 3
numbersections: false
header-includes:
  - \usepackage{fontspec}
  - \setmainfont{Times New Roman}
---

\newpage

# 1. Abstract

*[Das Abstract wird als letztes geschrieben und fasst die gesamte Arbeit in ca. 200–300 Wörtern zusammen: Problem, Methode, Ergebnisse, Schlussfolgerung.]*

\newpage

# 2. Einleitung

Gemeinsame Ideenentwicklung ist in vielen Bereichen der heutigen Wissensarbeit längst selbstverständlich geworden. Neue Lösungen entstehen selten allein am Schreibtisch, sondern im Austausch mit anderen. Menschen setzen sich zusammen, diskutieren Ideen, reagieren aufeinander und versuchen, Gedanken gemeinsam weiterzuentwickeln. Brainstorming gilt seit langem als etablierte Methode, um diesen Austausch zu fördern und verschiedene Perspektiven zusammenzuführen. Die Grundannahme ist einfach und intuitiv: Wenn mehrere Menschen ihre Sichtweisen teilen, entsteht mehr, als wenn jeder für sich arbeitet.

In der Praxis hält Brainstorming dieses Versprechen jedoch nicht immer ein. Besonders in informellen Settings, in denen es keine klare Struktur gibt, bleibt die tatsächliche Vielfalt der Ideen oft begrenzt. Brainstorming-Sitzungen beginnen häufig spontan. Eine Gruppe kommt zusammen, erste Gedanken werden geäussert und andere greifen sie auf. Der Austausch wirkt lebendig, manchmal sogar dynamisch. Gleichzeitig lässt sich beobachten, dass sich Diskussionen frühzeitig auf bestimmte Ansätze konzentrieren. Erste Ideen setzen unbewusst den Rahmen für den weiteren Verlauf, während alternative Perspektiven selten eingebracht oder weiterverfolgt werden. Obwohl viel geredet wird, bleibt der kreative Spielraum oft enger, als es zunächst erscheint.

Solche Situationen lassen sich in den unterschiedlichsten Kontexten beobachten. Auch in professionellen Arbeitsumgebungen oder projektbasierten Teams gelingt es Gruppen nicht automatisch, ihr kreatives Potenzial auszuschöpfen. Einzelne Personen haben einen deutlich grösseren Einfluss auf den Diskussionsverlauf als andere. Manche halten sich zurück, obwohl sie eigene Ideen haben, während andere im Laufe der Diskussion den Fokus verlieren. Neue Gedanken tauchen auf, werden kurz erwähnt und verschwinden dann wieder. Gleichzeitig entsteht oft das Gefühl, dass das Brainstorming gut funktioniert, weil kontinuierlich diskutiert wird. Dass die Ideenvielfalt begrenzt bleibt, ist oft kaum wahrnehmbar.

Diese Dynamiken lassen sich nicht allein auf individuelle Eigenschaften zurückführen. Vielmehr wirken in Gruppensituationen verschiedene kognitive, soziale und gruppendynamische Effekte zusammen, die in der Forschung gut beschrieben sind. Menschen äussern beispielsweise ihre Gedanken nicht, weil sie den Gesprächsfluss nicht unterbrechen wollen oder weil sie ihre Ideen noch nicht für ausreichend ausgereift halten. Hinzu kommen soziale Faktoren wie Konformitätsdruck oder die Sorge, dass ein Vorschlag negativ aufgenommen wird. Unter solchen Bedingungen bleiben insbesondere unkonventionelle Ideen oft unausgesprochen. Auch Phasen, in denen die Diskussion zwar weitergeht, aber kaum neue Ideen entstehen, sind typisch für informelle Brainstorming-Sitzungen. Diese Effekte treten selten isoliert auf, sondern verstärken sich im Verlauf eines Treffens gegenseitig.

Ein gängiger Ansatz zur Bewältigung solcher Probleme ist die Moderation. In strukturierten Workshops übernehmen Moderatoren die Aufgabe, den Prozess zu lenken, die Beteiligung auszugleichen und die Gruppe durch verschiedene Phasen der Ideengenerierung zu führen. In vielen alltäglichen Arbeitssituationen fehlt eine solche Rolle jedoch. Brainstorming-Sitzungen sind selbstorganisiert, oft unter Zeitdruck und ohne klare Zuständigkeiten. Die Gruppe ist gleichzeitig für Inhalt, Prozess und soziale Dynamik verantwortlich. Genau hier entsteht eine Lücke zwischen dem Wissen über effektive Brainstorming-Methoden und deren tatsächlicher Anwendung im Alltag.

Vor diesem Hintergrund stellt sich die Frage, ob neue Formen der Unterstützung informelle Brainstorming-Sitzungen effektiver gestalten können, ohne ihren offenen Charakter zu verlieren. In den letzten Jahren hat insbesondere künstliche Intelligenz zunehmend an Bedeutung gewonnen. Fortschritte in der generativen KI haben dazu geführt, dass Systeme nicht mehr nur als passive Werkzeuge eingesetzt werden, sondern zunehmend als interaktive Akteure. Moderne KI kann Gesprächsverläufe analysieren, Muster erkennen und auf Prozesse reagieren. Dies eröffnet die Möglichkeit, KI nicht primär als Ideenquelle zu nutzen, sondern gezielt Gruppenprozesse zu unterstützen.

Der Einsatz von KI in kreativen Gruppensituationen wirft jedoch auch neue Fragen auf. Während einige Ansätze KI primär als Inspirationsquelle betrachten, besteht die Gefahr, dass menschliche Beiträge an Bedeutung verlieren oder Gruppen sich stark auf maschinell generierte Vorschläge verlassen. Zudem ist wenig darüber bekannt, wie KI soziale Dynamiken, Partizipation oder die subjektive Wahrnehmung von Fairness innerhalb einer Gruppe beeinflusst. Ein Grossteil der bestehenden Arbeiten konzentriert sich primär auf die Qualität KI-generierter Ideen. Der kreative Prozess selbst bleibt dabei oft im Hintergrund.

Diese Bachelorarbeit setzt genau an diesem Punkt an. Ziel ist es nicht, künstliche Intelligenz als bessere Ideenquelle zu präsentieren oder menschliche Kreativität zu ersetzen. Stattdessen wird untersucht, wie KI informelle Brainstorming-Prozesse unterstützen kann, indem sie bekannte kognitive, soziale und gruppendynamische Barrieren adressiert. Der Fokus liegt auf der Rolle der KI im Prozess und der Frage, wie verschiedene Formen der Intervention den Verlauf und die Wahrnehmung von Brainstorming-Sitzungen beeinflussen.

Der Forschungsrahmen konzentriert sich auf Kleingruppen in informellen Settings, wie sie in vielen Bereichen der Wissensarbeit vorkommen. Diese Situationen sind offen, weniger formalisiert und erfordern ein hohes Mass an Eigenverantwortung der Beteiligten. Gleichzeitig sind sie besonders anfällig für die oben beschriebenen Einschränkungen. Gerade deshalb eignen sie sich gut, um zu untersuchen, inwieweit KI als unterstützender Akteur eingesetzt werden kann, ohne dass professionelle Moderation oder umfangreiche Vorbereitung erforderlich ist.

Zur Bearbeitung dieser Fragestellung wird ein szenariobasierter Ansatz gewählt. Zunächst wird ein zentrales Problemszenario entwickelt, das die typischen Dynamiken und Einschränkungen informellen Brainstormings veranschaulicht. Darauf aufbauend werden zwei Interventionsszenarien beschrieben, die unterschiedliche Rollen der künstlichen Intelligenz im Brainstorming-Prozess darstellen. In einem Szenario übernimmt die KI eine prozedurale Moderationsrolle, während im zweiten Szenario diese Rolle durch gezielte inhaltliche Impulse ergänzt wird. Auf diese Weise können Unterschiede im Prozess, in der Beteiligung der Gruppenmitglieder und in der wahrgenommenen Offenheit der Ideenentwicklung systematisch verglichen werden.

\newpage

# 3. Literaturübersicht

## 3.1. Brainstorming: Grundlagen und methodische Herausforderungen

### 3.1.1. Ursprung und Regeln des Brainstormings

Die Grundprinzipien des Brainstormings lassen sich auf jahrhundertealte Philosophien und Rituale zurückführen. Die erste dokumentierte Verwendung des Begriffs findet sich 1907 in einem Gerichtsverfahren, in dem der Angeklagte angeblich einen «Brainstorm» hatte. Damals wurde der Begriff negativ verstanden und mit Kontrollverlust oder einer vorübergehenden geistigen Störung assoziiert. Bis 1954 definierten Wörterbücher «Brainstorm» als eine Art vorübergehende geistige Verwirrung. (Rickards, 1999)

Später änderte sich die Bedeutung des Begriffs. «Brainstorming» erhielt zunehmend positive Konnotationen und wurde schliesslich als «plötzliche Inspiration oder Ideen» beschrieben. In der Folge etablierte sich die moderne Definition als Konferenztechnik zur Lösung spezifischer Probleme, bei der die Teilnehmenden ermutigt werden, durch spontane und ungehemmte Diskussion möglichst viele Ideen zu generieren. (Rickards, 1999)

Die ersten industriellen Anwendungen des Brainstormings werden üblicherweise Alex Osborn zugeschrieben, einem Partner der Werbeagentur BBDO. In den 1940er Jahren beobachtete Osborn, dass herkömmliche Meetings durch grosse Statusunterschiede, vorschnelle Bewertung und die Dominanz einzelner Teilnehmender geprägt waren, was viele Mitarbeitende daran hinderte, ihre Ideen einzubringen. So dominierten nur wenige Personen das Gespräch, während viele potenziell wertvolle Beiträge ungehört blieben. (Rickards, 1999)

Osborns Ziel war es daher, eine neue Besprechungsstruktur zu schaffen, die diese sozialen Barrieren beseitigte und den Prozess der Ideenentwicklung erleichterte. Durch die Einführung klarer Regeln — wie dem Verbot von Kritik während des Brainstormings — wollte er sicherstellen, dass möglichst viele unterschiedliche Ideen generiert werden. (Rickards, 1999)

Osborn stellte seine Methode in *How to Think Up* (1942) vor und entwickelte sie in *Applied Imagination* (1963) weiter. Rickards (1999) hebt hervor, dass Osborns operative Mechanismen schliesslich in eine Reihe leitender Prinzipien formalisiert wurden, die die moderne Brainstorming-Praxis geprägt haben. Diese umfassen:

(1) Kritik ist ausgeschlossen,
(2) Freies Assoziieren ist erwünscht,
(3) Aufgreifen und Weiterentwickeln fremder Ideen, und
(4) Quantität geht vor Qualität.

Insgesamt betont Rickards (1999), dass Brainstorming nicht bloss als spontane Ideenfindung konzipiert war, sondern als bewusst strukturierte Technik zur Überwindung gruppendynamischer Einschränkungen und zur Förderung eines produktiveren kreativen Prozesses.

### 3.1.2. Produktivitätsverlust beim Gruppen-Brainstorming

Obwohl Osborn Brainstorming als besonders effektive Methode präsentierte, die Qualität und Quantität der von Gruppen erzeugten Ideen deutlich steigern könne, stellt sich die Frage, ob dies tatsächlich zutrifft und ob Gruppenmitglieder wirklich durchschnittlich mehr Ideen generieren. Abschnitt 3.1.2 befasst sich daher mit wissenschaftlichen Studien, die die tatsächliche Wirksamkeit von Brainstorming untersucht haben.

In einer ersten Studie wurden Versuchspersonen gebeten, entweder einzeln oder in Vierergruppen zu brainstormen. Um die Anzahl der Ideen zu vergleichen, wurden aus den einzeln arbeitenden Personen sogenannte Nominalgruppen gebildet und die individuellen Ideen anschliessend zusammengefasst. Entgegen Osborns Behauptungen produzierten die Nominalgruppen fast doppelt so viele Ideen wie die realen Gruppen. Dieses Ergebnis wurde auch in den meisten anderen Experimenten bestätigt. (Diehl & Stroebe, 1987)

Eine der entscheidendsten Ursachen für diesen Leistungsunterschied ist die sogenannte Produktionsblockierung. Damit ist gemeint, dass in realen Gruppen nur eine Person gleichzeitig sprechen kann. Es wird angenommen, dass Ideen während dieser Wartezeit vergessen oder unterdrückt werden, weil sie später weniger originell oder relevant erscheinen mögen oder weil man durch die Ideen anderer abgelenkt wird. Die Forschung zeigt auch, dass diese Verzögerung zu Gedächtniszerfall führen kann, da Ideen im Kurzzeitgedächtnis einfach verblassen, bevor sie geäussert werden können. Darüber hinaus kann das Zuhören bei anderen Teilnehmenden kognitive Interferenzen verursachen, was bedeutet, dass eingehende Ideen den eigenen Gedankengang stören oder überschreiben. Beispielsweise könnte ein Teilnehmender an eine originelle Lösung denken, doch während er auf seinen Sprechzeitpunkt wartet, präsentiert ein anderes Gruppenmitglied eine andere Idee, die den ersten Teilnehmenden dazu bringt, seinen ursprünglichen Gedanken zu verlieren oder ihn als weniger wertvoll einzuschätzen. Studien haben auch festgestellt, dass die Produktivitätsunterschiede mit zunehmender Gruppengrösse wuchsen, was diese Annahmen weiter stützt. (Diehl & Stroebe, 1987)

Ein weiterer häufig genannter Grund für den Produktivitätsverlust in Gruppen ist die sogenannte Bewertungsangst — die Furcht vor negativer Bewertung. Die Studie von Collaros und Anderson (1969) zeigt, dass dies tatsächlich auftreten kann, wenn andere Gruppenmitglieder als besonders kompetent wahrgenommen werden — etwa wenn sie annehmen, dass Experten mit im Raum sitzen. Die Teilnehmenden äussern ihre Ideen dann zögerlicher, und es werden weniger Ideen generiert. Andere Experimente konnten dies jedoch nicht bestätigen. Zusammenfassend wird Bewertungsangst daher als möglicher, aber nicht entscheidender Faktor für den Produktivitätsverlust betrachtet. (Diehl & Stroebe, 1987)

Zusammenfassend zeigen die Befunde, dass der Produktivitätsverlust in Gruppen auf eine Reihe von Ursachen zurückgeführt werden kann, wobei Produktionsblockierung und kognitive Interferenz die Hauptursachen darstellen. Um jedoch vollständig zu verstehen, warum Gruppen ihr volles Potenzial nicht ausschöpfen können, müssen auch soziale und gruppendynamische Prozesse berücksichtigt werden.

### 3.1.3. Soziale und gruppendynamische Barrieren

Intrapersonale Mechanismen helfen zu erklären, warum Einzelpersonen in Gruppen weniger Ideen generieren, zeigen aber nicht das vollständige Bild. Über kognitive Einschränkungen hinaus wird Kreativität in Gruppen auch durch soziale Interaktionsmuster geprägt, die entstehen, wenn mehrere Personen zusammenarbeiten. Abschnitt 3.1.3 konzentriert sich daher auf interpersonelle und gruppendynamische Faktoren, die beeinflussen, wie Ideen innerhalb eines Teams generiert werden.

Die Forschung zeigt klar, dass Kreativität in Gruppen nicht nur von den oben genannten kognitiven Mechanismen abhängt, sondern dass interpersonelle Dynamiken ebenfalls eine sehr wichtige Rolle spielen. An erster Stelle wollen Menschen in einem Gruppenkontext stets ihre soziale Akzeptanz wahren und versuchen, sich und ihr Verhalten vor der Gruppe zu rechtfertigen. Durch Mechanismen wie soziale Konformität — bei der Einzelpersonen ihre geäusserten Ideen an Gruppennormen und -erwartungen anpassen — und Selbstzensur, bei der Gruppenmitglieder unkonventionelle Ideen unterdrücken, um soziale Akzeptanz zu wahren und Beziehungen zu schützen, sowie den allgemeinen Wunsch, den Wert sozialer Beziehungen zu erhalten, unterdrücken Gruppenmitglieder häufig unkonventionelle Ideen, was zu einem Streben nach Harmonie statt Kreativität führt. Die Unterscheidung zwischen privaten Gedanken und öffentlichem Ausdruck erklärt zusätzlich, warum viele potenziell wertvolle Ideen nie in die Diskussion eingebracht werden. Letztlich tragen diese Dynamiken zu Phänomenen wie Gruppendenken bei und zeigen, warum interpersonelle Prozesse die Wirksamkeit von Gruppen-Brainstorming erheblich einschränken können. (Henriques, 2020)

Ein weiterer Effekt, der in diesem Zusammenhang relevant ist, wird als soziales Faulenzen bezeichnet. Wenn Gruppen gemeinsam an einer Aufgabe arbeiten — etwa beim Brainstorming — bedeutet das nicht automatisch, dass sich alle gleichermassen beteiligen und engagieren. Die Forschung zeigt tatsächlich das Gegenteil: Menschen erbringen in Gruppen oft geringere Leistungen als individuell. Williams und Harkins konnten dies durch verschiedene Experimente deutlich demonstrieren. Sie liessen Personen in die Hände klatschen und stellten fest, dass mit zunehmender Gruppengrösse jede einzelne Person weniger Energie aufwendete. Dies liegt wahrscheinlich hauptsächlich daran, dass sich in einer Gruppe in der Regel niemand verantwortlich fühlt und schwer feststellbar ist, wer wie viel beiträgt. So entsteht schnell das Gefühl, dass der eigene Einsatz ohnehin nicht bemerkt wird — weder positiv noch negativ. Menschen neigen dazu, abzuwarten und das Reden oder Denken anderen zu überlassen, und die individuelle Motivation sinkt erheblich. Zudem überschätzen Menschen oft ihren eigenen Beitrag und unterschätzen den anderer, was die Bereitschaft zur Anstrengung weiter verringert. Für Prozesse wie Brainstorming bedeutet dies, dass bei vielen Beteiligten Einzelne oft weniger beitragen, weil die gegebene Gruppensituation automatisch zu geringerer persönlicher Aktivierung führt. (Latané et al., 1979)

Ein weiterer sozialer Faktor, der Gruppen in Brainstorming-Sitzungen bremst, hat weniger mit fehlendem Kreativitätspotenzial zu tun, sondern vielmehr damit, wer sich in einer Gruppe durchsetzt. Studien zeigen, dass sich in fast jeder Gruppe sehr schnell informelle Hierarchien bilden — nicht unbedingt auf Basis von Kompetenz, sondern aufgrund des Auftretens. Anderson & Kilduff (2009) fanden heraus, dass Personen mit dominantem Auftreten automatisch mehr Einfluss in Gruppen gewinnen, weil sie früher sprechen, häufiger das Wort ergreifen und sehr selbstsicher wirken. Dieses Verhalten wird von anderen als Kompetenz wahrgenommen, auch wenn objektiv keine besseren Fähigkeiten dahinterstehen. In der Folge lenken dominante Personen die Diskussion, während zurückhaltendere Mitglieder — oft mit ebenso guten oder besseren Ideen — kaum zu Wort kommen. Bei Brainstorming-Sitzungen führt dies dazu, dass sich die Gruppe sehr früh auf bestimmte Denkrichtungen festlegt, viele alternative Vorschläge gar nicht erst geäussert werden und die tatsächliche Ideenvielfalt verloren geht. Es entsteht eine Art Tunnelblick — nicht weil der Gruppe Ideen fehlen, sondern weil soziale Dynamiken bestimmen, wessen Ideen überhaupt gehört werden. (Anderson & Kilduff, 2009)

Zusammenfassend lässt sich sagen, dass Gruppen nicht nur an bestimmten kognitiven Einschränkungen scheitern, sondern dass soziale Dynamiken ebenfalls einen grossen Einfluss auf bestimmte Ineffizienzen in Gruppen haben. Sobald mehrere Menschen zusammenarbeiten, kommen automatisch Status, Sympathie, Dominanz und viele weitere Faktoren ins Spiel, oft stärker als man denken würde. Dadurch bleiben viele gute Ideen unausgesprochen, gehen im Rauschen der Gruppe unter oder werden von lauteren und dominanteren Stimmen überdeckt. Dies erklärt, warum Gruppen trotz guter Absichten und kreativer Regeln oft ihr volles Potenzial nicht ausschöpfen können. Oft ist nicht das Denken, sondern das Zusammenarbeiten das entscheidende Problem.

Die vorangegangenen Abschnitte haben gezeigt, dass Gruppen-Brainstorming von einer Vielzahl kognitiver, sozialer und gruppendynamischer Faktoren beeinflusst wird, die die Wirkung und Effektivität von Brainstorming einschränken können. Diese Hindernisse haben nicht eine einzige Ursache, sondern treten auf verschiedenen Ebenen auf, etwa der individuellen Kognition, der interpersonellen Interaktion und der Teamstruktur. Um einen strukturierten Überblick über diese ausgewählten Hindernisse und Ineffizienzen zu geben, fasst Tabelle 1 die oben diskutierten Mechanismen zusammen und zeigt ihre primäre Wirkungsebene.

| Barriere / Ineffizienz | Dominanter Mechanismus | Beschreibung |
|---|---|---|
| Produktionsblockierung | Kognitiv / Prozessbezogen | Nur eine Person kann gleichzeitig sprechen, was die Ideenäusserung verzögert und dazu führt, dass Ideen vergessen oder unterdrückt werden. |
| Gedächtniszerfall | Intrapersonal (Kognitiv) | Im Kurzzeitgedächtnis gehaltene Ideen verblassen während der Wartezeit, bevor sie geäussert werden können. |
| Kognitive Interferenz | Intrapersonal (Kognitiv) | Eingehende Ideen anderer stören oder überschreiben den eigenen Gedankengang. |
| Bewertungsangst | Intrapersonal (Sozial induziert) | Angst vor negativer Bewertung, besonders in Anwesenheit wahrgenommener Experten, reduziert die Ideenweitergabe. |
| Soziale Konformität | Interpersonell | Einzelpersonen passen ihre geäusserten Ideen an Gruppennormen und -erwartungen an. |
| Selbstzensur | Intrapersonal (Soziale Motivation) | Gruppenmitglieder unterdrücken unkonventionelle Ideen, um soziale Akzeptanz zu wahren und Beziehungen zu schützen. |
| Gruppendenken | Gruppendynamisch | Das Streben nach Harmonie führt zu frühzeitigem Konsens und Unterdrückung alternativer Perspektiven. |
| Soziales Faulenzen | Gruppendynamisch | Individueller Einsatz sinkt durch diffundierte Verantwortung und geringe Rechenschaftspflicht. |
| Informelle Hierarchien | Gruppendynamisch | Dominante Personen gewinnen Einfluss auf Basis von Selbstsicherheit und Sichtbarkeit statt Kompetenz. |

*Tabelle 1: Übersicht über kognitive, soziale und gruppendynamische Barrieren im Brainstorming.*

### 3.1.4. Moderation im Brainstorming

Auch wenn zahlreiche Studien gezeigt haben, dass traditionelle Gruppen beim Brainstorming oft weniger produktiv sind als Nominalgruppen, bedeutet dies nicht, dass Brainstorming als Methode grundsätzlich ineffektiv ist. Vielmehr hängt die Qualität einer Brainstorming-Sitzung stark davon ab, wie sie moderiert und strukturiert wird. Moderation kann viele der oben beschriebenen kognitiven, sozialen und gruppendynamischen Barrieren abmildern und Bedingungen schaffen, unter denen der kreative Prozess deutlich effektiver verlaufen kann. Abschnitt 3.1.4 befasst sich daher mit der Rolle der Moderation im Brainstorming, den Prinzipien, die sich in der Forschung als wirksam erwiesen haben, und wie gezielte Interventionen typische Störfaktoren reduzieren können.

Neben kognitiven und sozial-dynamischen Faktoren hat sich gezeigt, dass die Qualität und Produktivität von Gruppen-Brainstorming-Sitzungen stark davon abhängen, wie gut der Prozess moderiert wird. Moderation gilt als eine der besten und effektivsten Massnahmen zur Reduzierung typischer Prozessverluste oder Produktivitätsverluste. Die Studie von Offner et al. (1996) zeigt deutlich, dass moderierte Gruppen signifikant mehr Ideen generieren als Gruppen ohne Moderation. Der Hauptgrund dafür ist, dass Moderatoren jene Mechanismen aktiv hemmen oder sogar verhindern, die sonst zu geringerer Kreativität führen: Sie strukturieren den Prozess, sorgen für ausgewogene Redeverteilung und verhindern so Produktionsblockierung. Gleichzeitig erinnern sie die Teilnehmenden konsequent an die Brainstorming-Regeln, wodurch die Bewertungsangst reduziert wird — was besonders ruhigeren Gruppenmitgliedern hilft. Darüber hinaus geben aktive Ermutigung und klares Prozessmanagement den Teilnehmenden mehr Vertrauen, was den häufig beobachteten Motivationsverlust in Gruppen abmildert. (Offner et al., 1996)

Laut Offner et al. (1996) umfasst wirksame Moderation vor allem die Einhaltung der Regeln, die Verhinderung, dass dominante Sprechende die Diskussion beherrschen, die Förderung gleichmässiger Teilnahme und die Erhöhung des Tempos im Ideengenerierungsprozess. Moderation adressiert somit gleichzeitig kognitive Barrieren, soziale Dynamiken und motivationalen Antrieb und ist eine der wenigen Interventionen, die nachweislich die kreative Leistung von Brainstorming-Gruppen konsistent steigern. (Offner et al., 1996)

Eine weitere wichtige Erkenntnis von Oxley et al. (1996) betrifft die Frage, wie gut Moderation funktioniert — denn nicht jede Form der Moderation führt automatisch zu besseren Ergebnissen. Die Studie zeigt, dass die Wirkung der Moderation stark davon abhängt, wie professionell und geschickt sie durchgeführt wird. Gruppen, die von gut geschulten Moderatoren begleitet wurden, erzielten eine deutlich höhere Ideenanzahl und kamen der Leistung von Nominalgruppen am nächsten. Weniger geschulte Moderatoren erzielten hingegen kaum Vorteile gegenüber unmoderierten Gruppen. Dies verdeutlicht, dass Moderation keine rein organisatorische Funktion ist, sondern eine Fertigkeit, die spezifisches Training und Erfahrung erfordert.

Darüber hinaus stellten Oxley et al. (1996) fest, dass gut moderierte Gruppen ihre Produktivität über die gesamte Sitzungsdauer aufrechterhalten oder sogar steigern können. Während Nominalgruppen typischerweise gegen Ende einer Sitzung an Kreativität verlieren, gelingt es Moderatoren, das Tempo der Ideengenerierung aufrechtzuerhalten, Denkpausen produktiv zu überbrücken und die Beteiligung aller Mitglieder konsequent zu fördern. Dies verhindert, dass die Gruppe in späteren Phasen des Brainstormings «einbricht», wie es in unmoderierten Gruppen häufig beobachtet wird.

Ein weiterer Vorteil der Moderation zeigt sich im sozialen Klima. Professionelle Moderatoren schaffen eine psychologisch sichere Atmosphäre, in der Fehleinschätzungen und Befürchtungen um den Ruf weitgehend reduziert werden. Sie sorgen dafür, dass alle Teilnehmenden gleichermassen zu Wort kommen, verhindern subtiles Dominanzverhalten und fördern gegenseitige Unterstützung. Diese Faktoren wirken direkt den sozialen Hemmungen entgegen, die in Gruppen oft zu Selbstzensur und dem Zurückhalten origineller Ideen führen.

Zusammenfassend zeigen Oxley et al. (1996), dass wirksame Moderation einer der stärksten empirisch belegten Hebel zur Steigerung der Kreativität von Brainstorming-Gruppen ist. Gut geschulte Moderatoren reduzieren Blockaden, dämpfen soziale Hemmungen, stabilisieren die Motivation und stellen sicher, dass die Gruppe ihr kreatives Potenzial über den gesamten Prozess hinweg ausschöpfen kann.

### 3.1.5. Die Rolle der KI bei der Unterstützung von Gruppenkreativität

Die vorangegangenen Abschnitte haben uns gezeigt, dass kreative Gruppenprozesse — in unserem Fall Brainstorming — meist nicht an mangelndem Potenzial scheitern, sondern an sozialen und kognitiven Einschränkungen. Dafür gibt es verschiedene Gründe: Produktionsblockierung, soziale Hemmungen oder ungleiche Beteiligung sind einige Beispiele. Diese können gut aufgestellte Gruppen mit guten Voraussetzungen daran hindern, ihr volles Potenzial auszuschöpfen. Wir haben auch festgestellt, dass Moderation sich positiv auf den Prozess auswirken kann, indem sie die diskutierten Effekte abschwächt — aber nur, wenn der Moderator gut geschult ist und genau weiss, wie er Brainstorming am besten unterstützt. Dies wirft die Frage auf, ob und vor allem in welcher Form technologische Unterstützung diese Rolle ergänzen oder sogar vollständig übernehmen kann.

In diesem Zusammenhang werden insbesondere generative Systeme der künstlichen Intelligenz zunehmend untersucht und erforscht. Im Gegensatz zu traditionellen Kreativitätswerkzeugen, die eher passiv sind, können solche KI-Systeme aktiv in den Kreativitätsprozess einer Gruppe eingebunden werden und bieten damit eine Reihe von Vorteilen. Sie können als Ideenquelle, als den Prozess strukturierende Instanz oder als unterstützender Moderator dienen. Bei richtigem Einsatz eröffnet dies völlig neue Möglichkeiten für Brainstorming. Gruppendynamische Barrieren und Ineffizienzen könnten reduziert oder möglicherweise fast vollständig beseitigt werden, wodurch der kreative Prozess innerhalb einer Gruppe erheblich optimiert würde.

In Abschnitt 3.1.5 untersuchen wir daher gezielt die Rolle der KI als unterstützender Akteur (Moderator). Der letztendliche Effekt sollte natürlich eine Leistungssteigerung sein, aber konkreter wollen wir beim Brainstorming herausfinden, wie KI verschiedene Aspekte wie soziale Dynamiken, wahrgenommene Sicherheit und unterschiedliche Partizipationsmuster innerhalb von Gruppen gezielt beeinflussen kann. Auf Basis aktueller Forschung zur kollaborativen Mensch-KI-Interaktion werden wir zeigen, in welchen Rollen KI Gruppenkreativität sinnvoll unterstützen kann und was dabei entscheidend ist. Wir werden auch diskutieren, was in diesem Kontext potenziell Probleme bereiten könnte.

Die Forschung hat gezeigt, dass synchrone Gruppenprozesse wie Brainstorming oder allgemeiner gemeinsame Entscheidungsfindung/Ideenentwicklung wiederholt mit bestimmten ähnlichen Herausforderungen konfrontiert sind. Dazu gehören begrenzte Perspektivenvielfalt, soziale Hemmungen beim Ansprechen kritischer oder unklarer Punkte sowie eine Tendenz zum Gruppendenken. Solche Probleme können dazu führen, dass relevante Perspektiven nicht immer eingebracht werden, Entscheidungen ohne gemeinsame Grundlage oder auf einer begrenzten gemeinsamen Grundlage getroffen werden oder sogar bestimmte Annahmen unausgesprochen bleiben. Aus diesen Gründen wird KI in der Forschung zunehmend als potenzielles Unterstützungsinstrument in diesen Prozessen diskutiert. (Johnson et al., 2025)

Explorative Studien haben ergeben, dass Teams KI als besonders wertvoll empfinden, wenn sie hilft, diese bekannten gruppendynamischen Probleme abzumildern. Dazu gehört unter anderem das Einbringen zusätzlicher Perspektiven, die helfen können, eingefahrene Denkmuster in Frage zu stellen und mögliche blinde Flecken aufzudecken. In diesem Zusammenhang wird KI auch als Ergänzung gesehen, die das Vertrauen stärken kann, indem sie der Gruppe versichert, dass relevante Aspekte in der Diskussion berücksichtigt werden. (Johnson et al., 2025)

Zudem wird der Beitrag zur Verringerung sozialer Hemmungen hervorgehoben. Die Unterstützung kann beispielsweise darin bestehen, bestimmte klärende Fragen zu stellen, Brücken zwischen verschiedenen Standpunkten zu bauen oder unausgesprochene Annahmen sichtbar zu machen, ohne dass bestimmte Einzelpersonen diese Rolle übernehmen müssen. Auf diese Weise kann die Beteiligung gefördert werden, insbesondere in Situationen, in denen Hierarchien oder Unsicherheiten die Beteiligung erschweren. (Johnson et al., 2025)

Es ist wichtig zu betonen, dass KI nicht als Ersatz für menschliche Zusammenarbeit gesehen wird. Allerdings wurde angemerkt und betont, dass diese Unterstützung nur akzeptiert wird, wenn sie bestehende Fähigkeiten in Gruppen ergänzt und in den jeweiligen Kontext der Gruppe passt. Eine weitere Voraussetzung in diesem Zusammenhang ist, dass Vertrauen in die Beiträge der KI besteht und die Rolle der KI innerhalb der Gruppe klar ist. Für die Teams war es zudem wichtig, dass die KI nicht zu dominant ist und nur dann zum Gruppenprozess beiträgt, wenn es angemessen ist. Die Bereitschaft, KI als Teil des Prozesses zu akzeptieren, hängt also weniger von ihrer Präsenz ab, sondern vielmehr davon, ob sie als unterstützend, kompatibel und im Einklang mit den Zielen der Gruppe wahrgenommen wird. (Johnson et al., 2025)

Die Studie von Specker et al. (2025) liefert erste empirische Belege für diese Sichtweise. Darin wird ein autonomer KI-Agent als zusätzlicher Teilnehmer in einer grossen Brainstorming-Gruppe eingesetzt. Es wurde deutlich gezeigt, dass die Brainstorming-Gruppe vom KI-Agenten profitierte. Es gab eine höhere Anzahl an Ideen und eine grössere thematische Vielfalt im Vergleich zu Gruppen, in denen dieser Agent nicht eingesetzt wurde. Wichtig ist, dass diese Effekte nicht primär auf die besonders guten Einzelideen der KI zurückzuführen waren, sondern auf die zusätzlichen Perspektiven und Impulse, die der Agent in die Diskussion einbrachte. Als Inspirationsquelle half der Agent somit, den Suchraum der Gruppe zu erweitern und zu verhindern, dass sie sich zu stark an dominanten Ideen festhielt. Der Agent unterstützte somit den Prozess positiv, ohne die Menschen in der Gruppe zu ersetzen. Wie in den vorangegangenen Absätzen erwähnt, deutet dies darauf hin, dass der Hauptnutzen eines solchen Agenten eher darin liegt, als zusätzliche, ergänzende Quelle zu agieren, und nicht als Ersatz für Menschen und ihre Kreativität.

\newpage

# 4. Szenario

## 4.1. Zentrales Problemszenario: Begrenzte Ideenvielfalt in informellen Brainstorming-Situationen

Theoretisch wird Brainstorming als strukturierte Kreativitätstechnik beschrieben und definiert, die klaren Regeln folgt und in der Regel von einem geschulten Moderator begleitet wird. Diese Struktur soll sicherstellen, dass möglichst viele unterschiedliche Ideen entstehen können, ohne dass frühzeitige Bewertungen oder soziale Dynamiken den kreativen Prozess einschränken. In der Praxis — beispielsweise im universitären Umfeld — weicht diese Idealform jedoch oft erheblich von der tatsächlichen Umsetzung ab. Gerade in traditioneller Gruppenarbeit entstehen Brainstorming-Phasen häufig informell, spontan und ohne professionelle Moderation. Studierende treffen sich in Kleingruppen, erhalten eine Aufgabe und beginnen meist sofort mit der Ideenentwicklung — oft ohne sich explizit auf Regeln, Rollen oder einen strukturierten Prozess zu einigen.

Auf den ersten Blick erscheint dieses Vorgehen pragmatisch und alltagstauglich. Gleichzeitig hat die Praxis jedoch wiederholt gezeigt, dass das kreative Potenzial solcher Gruppen nicht vollständig ausgeschöpft wird. Brainstorming findet zwar statt, erfüllt aber nicht immer seine zentrale Funktion, nämlich die systematische Erkundung eines möglichst breiten Spektrums phantasievoller Lösungen. Stattdessen entstehen häufig ähnliche oder nur geringfügig unterschiedliche Ideen, während ungewöhnlichere, kühnere oder weniger offensichtliche Ansätze selten eingebracht werden oder frühzeitig verschwinden.

Das nachfolgend betrachtete Szenario beschreibt eine typische Situation in diesem Kontext. Eine Gruppe von vier bis fünf Studierenden arbeitet gemeinsam an einem Problem, für das bereits ein gemeinsames Problemverständnis entwickelt wurde. Die Gruppe befindet sich somit klar in der Phase der Ideenentwicklung. Das Brainstorming findet mündlich statt, ohne feste Rollenverteilung, ohne formale Struktur und ohne externe Moderation. Alle Teilnehmenden gelten als gleichberechtigt, und es besteht ein gemeinsames Ziel, möglichst viele unterschiedliche Lösungsansätze zum Problem zu generieren. Gleichzeitig fehlt jedoch die Absicherung oder Unterstützung für diesen spezifisch definierten Rahmen.

Gleich zu Beginn der Diskussion lässt sich ein Muster beobachten, das im weiteren Verlauf immer ausgeprägter wird. Erste Ideen werden relativ schnell geäussert und von mehreren Gruppenmitgliedern positiv aufgenommen. Diese frühen Beiträge spielen eine entscheidende Rolle für die weitere Diskussion. Nachfolgende Ideen beziehen sich häufig auf diese anfänglichen Ansätze, greifen sie auf oder variieren sie leicht, anstatt neue Denkrichtungen zu eröffnen. Grundlegend neue Perspektiven, die sich deutlich von den bereits vorgestellten Ideen unterscheiden würden, werden im Laufe der Diskussion seltener. Einzelne Gruppenmitglieder prägen die Diskussion sichtbar, während andere sich auf kurze bestätigende Beiträge beschränken oder sich allmählich zurückziehen. Obwohl die Gruppe kontinuierlich redet und den Eindruck produktiver Zusammenarbeit vermittelt, bleibt die tatsächliche Vielfalt der generierten Ideen begrenzt.

Es ist wichtig zu beachten, dass dieses Problem nicht auf mangelnde Kreativität, mangelndes Engagement oder fehlende Expertise zurückzuführen ist. Vielmehr entsteht die begrenzte Ideenvielfalt aus dem Zusammenspiel mehrerer Mechanismen, die auf kognitiver, sozialer und gruppendynamischer Ebene wirken und sich während des Brainstorming-Prozesses gegenseitig verstärken. Diese Mechanismen wurden in Kapitel 3 systematisch beschrieben und lassen sich im vorliegenden Szenario klar erkennen. Besonders relevant ist, dass diese Prozesse nicht gleichzeitig und unabhängig voneinander auftreten, sondern sich schrittweise aufbauen und ineinandergreifen.

Ein zentraler prozeduraler Ausgangspunkt ist das Phänomen der Produktionsblockierung. Da das Brainstorming mündlich stattfindet, kann nur eine Person gleichzeitig sprechen. Während eine Person ihre Idee erklärt und mit den anderen teilt, sind die übrigen Gruppenmitglieder gezwungen, zuzuhören und ihre eigenen Gedanken zurückzustellen. Während dieser Zeit kommen den Zuhörenden oft neue Ideen oder Assoziationen, die jedoch nicht sofort geäussert werden können. Diese zeitliche Verzögerung kann den kreativen Fluss unterbrechen und erhöht die Wahrscheinlichkeit, dass Ideen verloren gehen oder bewusst zurückgehalten werden. Besonders in informellen Brainstorming-Sitzungen ohne klare Struktur gibt es oft keinen Mechanismus, um solche Ideen festzuhalten oder zu einem späteren Zeitpunkt darauf zurückzukommen.

Die Produktionsblockierung tritt jedoch nicht isoliert auf, sondern ist eng mit intrapersonalen kognitiven Prozessen verknüpft. Ideen, die beim Zuhören entstehen, müssen im Arbeitsgedächtnis gespeichert werden. Gleichzeitig verarbeitet die Person kontinuierlich neue Informationen aus den Beiträgen anderer Gruppenmitglieder, stellt Verbindungen her und bewertet die Relevanz der gehörten Inhalte. Diese parallele Aktivität führt zu erhöhter kognitiver Belastung, die sowohl Gedächtniszerfall als auch kognitive Interferenz fördert. Ursprüngliche Ideen verblassen im Laufe der Zeit, verlieren an Klarheit oder werden von neuen Gedankengängen überlagert. In der Praxis bedeutet dies, dass selbst potenziell wertvolle Ideen nicht mehr präsent sind, wenn sich endlich die Gelegenheit zum Sprechen ergibt, oder nur noch in abgeschwächter Form erinnert werden.

Neben diesen kognitiven Einschränkungen spielen auch soziale Mechanismen eine zentrale Rolle bei der weiteren Einengung des Ideenspielraums. In informellen Gruppen entstehen sehr schnell implizite Kompetenzzuschreibungen. Personen, die früh das Wort ergreifen, selbstbewusst auftreten oder fachlich fundierte Beiträge leisten, werden häufig als besonders kompetent wahrgenommen. Ob diese Personen tatsächlich mehr Expertise oder kreativere Ideen haben, ist in diesem Kontext irrelevant — diese Wahrnehmung entsteht unabhängig davon. Andere Gruppenmitglieder beginnen, ihre eigenen Ideen an diesen wahrgenommenen Standards zu messen. Die daraus resultierende Bewertungsangst führt dazu, dass unkonventionelle, unreife oder stark divergierende Ideen zurückhaltender formuliert oder ganz zurückgehalten werden. Stattdessen werden Beiträge gemacht, die als sicherer und sozial akzeptabler wahrgenommen werden, was das bestehende Denken eher bestätigt als erweitert.

Auf der interpersonellen Ebene verstärkt soziale Konformität diese Dynamik in manchen Fällen noch weiter. Sobald sich eine erste dominante Denkrichtung etabliert hat, bilden sich implizite Normen darüber, welche Arten von Beiträgen als angemessen oder wünschenswert gelten. Gruppenmitglieder passen ihre Ideen an diese Normen an — oft unbewusst —, um soziale Akzeptanz zu gewährleisten und Konflikte zu vermeiden. Perspektiven, die von dieser etablierten Denkrichtung abweichen, werden daher seltener eingebracht, selbst wenn sie inhaltlich relevant oder innovativ sind. Diese Anpassungsprozesse tragen wesentlich zur Stabilisierung eines engen Ideenspektrums bei und erschweren es der Gruppe, alternative Denkweisen systematisch zu erkunden.

Im weiteren Verlauf kann sich diese Dynamik zu Gruppendenken entwickeln. In diesem Szenario manifestiert sich Gruppendenken jedoch nicht primär durch offene Konfliktvermeidung, sondern durch eine schrittweise, fast unmerkliche Verengung des Denkraums. Die Gruppe entwickelt frühzeitig ein Gefühl der Einigkeit und effektiven Zusammenarbeit, das zunehmend wichtiger wird als die kritische Prüfung alternativer Ideen. Zweifel oder Gegenpositionen werden innerhalb der Gruppe nicht offen geäussert, um den bestehenden Konsens nicht zu gefährden oder den Arbeitsfluss zu stören. In der Folge bleibt die Diskussion lebhaft, wird aber inhaltlich zunehmend begrenzt. Die Gruppe wirkt produktiv und äusserst kreativ — muss es aber nicht unbedingt sein.

Ein zusätzlicher Einflussfaktor ist das soziale Faulenzen. Da individuelle Beiträge beim Brainstorming weder klar messbar noch eindeutig zuordenbar sind, sinkt die Motivation einzelner Gruppenmitglieder zur aktiven Teilnahme. Wenn einige wenige Personen die Diskussion bereits sichtbar führen oder dominieren, entsteht leicht der Eindruck, dass der eigene Beitrag wenig Einfluss auf den Gesamtprozess hat. Dies führt dazu, dass sich einzelne Teilnehmende gedanklich zurückziehen, weniger aktiv nach neuen Ideen suchen und ihre Rolle auf eine eher passive Teilnahme reduzieren. Dieser Effekt verstärkt die ungleiche Beteiligung innerhalb der Gruppe und trägt weiter zur Verringerung der Ideenvielfalt bei.

Im Verlauf informeller Brainstorming-Sitzungen können zudem weitere Dynamiken auftreten, die das bestehende Problem begrenzter Ideenvielfalt weiter verschärfen. Besonders relevant sind hier interpersonelle Spannungen innerhalb der Gruppe und Momente, in denen der kreative Prozess spürbar an Schwung verliert.

Unterschiedliche Perspektiven oder Ansätze werden anfänglich oft sachlich und konstruktiv diskutiert. In manchen Situationen können sich solche Differenzen jedoch zu persönlicheren oder emotional aufgeladenen Auseinandersetzungen steigern. Wenn dies geschieht, verschiebt sich der Fokus der Diskussion häufig: Statt gemeinsam neue Ideen zu entwickeln, rückt zunehmend die Verteidigung der eigenen Position oder die Entschärfung der entstandenen Spannung in den Vordergrund. Während sich einige Teilnehmende in solchen Momenten eher zurückziehen, treten andere stärker in den Vordergrund und dominieren das Gespräch. Diese Entwicklung ist in der Regel abträglich für den kreativen Prozess, da weniger Raum für neue Ideen bleibt.

Gleichzeitig lässt sich in vielen Brainstorming-Situationen eine Art Ermüdung beobachten. Nach einer anfänglich sehr produktiven Phase werden die vorgebrachten Ideen oft ähnlicher, wirklich neue Perspektiven seltener, und die Diskussion dreht sich zunehmend um bereits bekannte Vorschläge. Diese Stagnation wird von der Gruppe nicht immer bewusst wahrgenommen, wirkt sich aber langfristig sowohl auf die Vielfalt als auch auf die Qualität der Ergebnisse aus.

Sowohl Konfliktsituationen als auch kreative Sackgassen sollten weniger als eigenständige Ursachen und mehr als Folgen der oben beschriebenen kognitiven, sozialen und gruppendynamischen Prozesse verstanden werden. Ihre Wirkung besteht darin, das zugrunde liegende Problem weiter zu verschärfen und informelle Brainstorming-Sitzungen daran zu hindern, ihr kreatives Potenzial vollständig auszuschöpfen.

Zusammenfassend lässt sich sagen, dass die begrenzte Ideenvielfalt in informellen Brainstorming-Situationen nicht auf eine einzelne Ursache zurückgeführt werden kann. Vielmehr entsteht sie aus dem komplexen Zusammenspiel von kognitiver Überlastung, sozialen Hemmungen und gruppendynamischen Prozessen, die sich im Verlauf des Brainstormings häufig gegenseitig verstärken können. Diese Mechanismen führen dazu, dass ein erheblicher Teil des tatsächlichen Potenzials der Gruppe nicht ausgeschöpft wird, obwohl die Gruppe motiviert und aktiv zusammenarbeitet. Genau hier setzt künstliche Intelligenz als unterstützender Akteur an, da sie diese Ursachen gezielt adressieren und den kreativen Prozess strukturell unterstützen kann.

## 4.2. Interventionsszenario A: Künstliche Intelligenz als prozeduraler Moderator

Aufbauend auf dem oben beschriebenen Problemszenario stellt sich die Frage, wie informelle Brainstorming-Sitzungen sinnvoll unterstützt werden können, ohne ihren offenen und spontanen Charakter zu verlieren. Das Ziel besteht nicht darin, den Prozess in hohem Masse zu formalisieren oder die Gruppe zu kontrollieren, sondern vielmehr bestehende Schwächen abzumildern und bessere Bedingungen für kreative Arbeit zu schaffen. In diesem ersten Interventionsszenario wird künstliche Intelligenz daher bewusst nicht als Ideenquelle eingesetzt, sondern in der Rolle eines prozeduralen Moderators.

Die KI wird als zusätzlicher Teilnehmer in die Brainstorming-Sitzung integriert. Dies kann beispielsweise als sichtbarer Teilnehmer in einer digitalen Umgebung oder als Werkzeug geschehen, das die Diskussion im Hintergrund begleitet. Der entscheidende Punkt ist, dass die KI selbst keine inhaltlichen Beiträge leistet. Ihre Aufgabe besteht vielmehr darin, den Brainstorming-Prozess im Auge zu behalten und genau zu verfolgen, wie sich die Diskussion entwickelt. Sobald Anzeichen dafür vorliegen, dass der kreative Prozess ins Stocken gerät oder ungünstige Dynamiken entstehen, kann die KI reagieren. Auf diese Weise übernimmt sie eine Funktion, die aus professionell moderierten Workshops bekannt ist, in informellen studentischen Settings aber in der Regel fehlt.

Während des Brainstormings bleibt die KI ständig aufmerksam, greift aber nicht permanent ein. Stattdessen beobachtet sie den Gesprächsverlauf und achtet auf bestimmte Muster, die auf Probleme im Prozess hindeuten können. Dazu gehören beispielsweise Situationen, in denen einzelne Gruppenmitglieder den Grossteil des Gesprächs bestreiten, während andere kaum zu Wort kommen. Es kann auch auffallen, wenn neue Beiträge inhaltlich immer ähnlicher werden oder über einen längeren Zeitraum keine neuen Ideen mehr aufkommen. Solche ruhigeren Phasen können darauf hindeuten, dass die Diskussion an Dynamik verliert oder sich in eine Richtung verengt.

Wenn solche Muster über einen bestimmten Zeitraum bestehen bleiben, kann die KI gezielt eingreifen. Diese Interventionen sind bewusst zurückhaltend und beziehen sich nicht auf einzelne Personen oder bestimmte Ideen, sondern auf den Prozess als Ganzes. Beispielsweise kann die KI darauf hinweisen, dass viele Beiträge um ähnliche Ansätze kreisen, oder die Gruppe ermutigen, bewusst eine andere Perspektive einzunehmen. Sie kann auch darauf aufmerksam machen, dass bisher nicht alle Gruppenmitglieder gleichermassen einbezogen waren. Wichtig ist, dass diese Kommentare neutral formuliert sind und keinen bewertenden Charakter haben.

Diese Form der prozeduralen Unterstützung adressiert mehrere der in Abschnitt 4.1 beschriebenen Ursachen gleichzeitig. Produktionsblockierung kann reduziert werden, weil die KI indirekt eine ausgewogenere Beteiligung fördert und Raum für verschiedene Stimmen schafft. Kognitive Effekte wie Gedächtniszerfall oder kognitive Interferenz können zumindest teilweise gemildert werden, da kurze prozedurale Impulse den Diskussionsfluss unterbrechen und neu fokussieren. Solche Unterbrechungen wirken als kleine Reflexionspausen, in denen Gruppenmitglieder ihre Gedanken ordnen und neue Ideen entwickeln können.

Darüber hinaus kann die KI dazu beitragen, soziale Hemmungen innerhalb der Gruppe abzubauen. Da sie als neutraler Akteur wahrgenommen wird, der keine eigenen Interessen verfolgt und keine sozialen Urteile fällt, wirken ihre Kommentare oft weniger bedrohlich als vergleichbare Bemerkungen eines anderen Gruppenmitglieds. Insbesondere die Bewertungsangst kann auf diese Weise reduziert werden. Der Aufruf, neue oder ungewöhnliche Ideen beizusteuern, kommt nicht aus der Gruppe selbst, sondern von einer externen Instanz, was die Hemmschwelle senken kann.

Auch soziales Faulenzen kann durch diese Art der Moderation zumindest teilweise reduziert werden. Durch die wiederholte, wenn auch kurze Reflexion des Gruppenprozesses macht die KI deutlich, dass aktive Teilnahme erwünscht und sinnvoll ist. Gleichzeitig entsteht kein direkter Leistungsdruck, da niemand explizit angesprochen oder herausgestellt wird. Die Verantwortung für den kreativen Prozess bleibt somit klar bei der Gruppe insgesamt.

Ein weiterer Vorteil dieses Interventionsszenarios ist seine Flexibilität. Die KI kann ihre Interventionen an den Verlauf der Brainstorming-Sitzung anpassen. Zu Beginn kann der Fokus darauf liegen, ein breites Spektrum an Ideen zu generieren, während in späteren Phasen stärker darauf geachtet werden kann, ob sich die Diskussion verengt oder stagniert. Auf diese Weise begleitet die KI den gesamten Prozess, ohne ihn zu dominieren oder inhaltlich zu steuern.

Insgesamt agiert die KI in diesem Szenario als unterstützender Moderator im Hintergrund. Sie greift nicht kreativ ein, sondern sorgt dafür, dass der Rahmen der Brainstorming-Sitzung stabil bleibt. Indem sie die in Abschnitt 4.1 identifizierten problematischen Dynamiken gezielt adressiert, hilft sie, eine offenere und vielfältigere Ideenentwicklung zu ermöglichen, ohne den Charakter informeller Brainstorming-Sitzungen grundlegend zu verändern.

## 4.3. Interventionsszenario B: Kombination aus KI-Moderator und KI-Ally

Während das vorherige Szenario in erster Linie darauf abzielt, den Brainstorming-Prozess zu stabilisieren und problematische Dynamiken abzufedern, geht dieses zweite Interventionsszenario einen Schritt weiter. Es baut auf der Rolle der KI als prozeduralem Moderator auf, erweitert sie jedoch um eine zusätzliche Funktion. Das Ziel ist nicht nur, den Prozess zu begleiten, sondern in bestimmten Situationen auch neue Impulse zu setzen, wenn deutlich wird, dass die Gruppe allein nicht mehr weiterkommt.

In diesem Szenario übernimmt die KI weiterhin die in Abschnitt 4.2 beschriebene moderierende Rolle. Sie beobachtet den Verlauf der Brainstorming-Sitzung, achtet auf Redezeiten, Wiederholungen und Phasen, in denen die Diskussion an Schwung verliert. Neu ist jedoch, dass sie in solchen Situationen auf einen zusätzlichen Mechanismus zurückgreifen kann. Dieser wird hier als KI-Ally bezeichnet. Der Ally wird nicht dauerhaft eingesetzt, sondern bewusst nur dann aktiviert, wenn prozedurale Hinweise allein nicht ausreichen, um neue Ideen anzuregen.

Der KI-Ally agiert nicht als eigenständige oder dominante Ideenquelle. Stattdessen wird er selektiv eingebunden — beispielsweise wenn die Diskussion über einen längeren Zeitraum um ähnliche Ansätze kreist oder die Gruppe sichtbar in bekannten Denkmustern feststeckt. Die Entscheidung, wann ein solcher Impuls angemessen ist, liegt bei der moderierenden KI. Dies stellt sicher, dass der Prozess kontrolliert bleibt und verhindert, dass der Ally zu einem festen Bestandteil der Diskussion wird.

Die vom KI-Ally gelieferten Impulse sind bewusst offen gehalten. Sie sollen keine konkreten Lösungen vorgeben, sondern neue Perspektiven eröffnen. Dies kann beispielsweise durch eine ungewöhnliche Frage, eine bewusst vereinfachte Sichtweise oder ein provokatives Gegenbeispiel geschehen. Der Input dient als Ausgangspunkt für weitere Reflexion und Entwicklung innerhalb der Gruppe. Wie dieser Input aufgegriffen und weiterentwickelt wird, bleibt vollständig den Teilnehmenden überlassen.

Dieser Ansatz bietet besonderen Mehrwert in Bezug auf die in Abschnitt 4.1 beschriebenen Phasen der Stagnation oder des Gruppendenkens. Während prozessorientierte Moderation hauptsächlich darauf abzielt, günstige Bedingungen für Kreativität zu schaffen, greift der KI-Ally ein, wenn diese Bedingungen allein nicht mehr ausreichen. In festgefahrenen Situationen kann ein externer Denkimpuls dazu beitragen, bestehende Annahmen in Frage zu stellen und den Raum für neue Ideen wieder zu öffnen.

Ein wesentlicher Aspekt dieses Szenarios ist die klare Rollentrennung. Die KI agiert nicht gleichzeitig als Moderator und Ideengeber, sondern macht transparent, in welcher Funktion sie gerade tätig ist. Dies verhindert den Eindruck, dass die KI die kreative Führung übernimmt oder menschliche Kreativität ersetzt. Stattdessen bleibt klar, dass die KI in einer unterstützenden Rolle agiert und die inhaltliche Verantwortung bei den menschlichen Teilnehmenden liegt.

Dieser Ansatz kann auch aus sozialer Perspektive vorteilhaft sein. Da der Impuls vom KI-Ally kommt und nicht von einem Gruppenmitglied, besteht weniger Risiko, dass Einzelne als dominant wahrgenommen werden oder neue Ideen sofort auf persönlicher Ebene bewertet werden. Der Impuls kann als neutraler Stimulus verstanden werden, der aufgegriffen, weiterentwickelt oder ebenso leicht verworfen werden kann. Dies kann helfen, Hemmungen abzubauen und die Offenheit gegenüber unkonventionellen Ideen zu erhöhen.

Gleichzeitig bleibt der offene Charakter des Brainstormings gewahrt. Der KI-Ally greift nur kurz ein und zieht sich dann wieder zurück. Die eigentliche kreative Arbeit findet weiterhin innerhalb der Gruppe statt. Dies verhindert, dass externe Impulse den Prozess dominieren oder in eine bestimmte Richtung lenken. Stattdessen fungiert der Ally als temporäre Unterstützung in kritischen Momenten.

Insgesamt erweitert dieses Interventionsszenario den prozessorientierten Moderationsansatz um eine gezielte inhaltliche Komponente. Die Kombination aus KI-Moderator und KI-Ally ermöglicht es, sowohl strukturelle als auch inhaltliche Blockaden zu überwinden. Auf diese Weise wird der kreative Prozess nicht nur stabilisiert, sondern in bestimmten Phasen auch wiederbelebt, ohne den informellen und offenen Charakter des Brainstormings grundlegend zu verändern.

## 4.4. Vergleich der Interventionsszenarien und Einordnung

Die beiden vorgestellten Interventionsszenarien verfolgen unterschiedliche Ansätze, adressieren aber dieselben grundlegenden Probleme des informellen Brainstormings. In beiden Fällen wird künstliche Intelligenz nicht als Ersatz für menschliche Kreativität gesehen, sondern als unterstützendes Element, das den Prozess begleiten und entlasten soll. Der Unterschied liegt weniger im Ziel als vielmehr darin, wie aktiv die KI in den kreativen Prozess eingreift.

Im ersten Szenario liegt der Fokus klar auf dem Prozess. Hier agiert die KI als moderierende Kraft im Hintergrund, beobachtet, wie sich die Diskussion entwickelt, und greift nur ein, wenn bestimmte Muster problematisch werden. Der Schwerpunkt liegt auf der Schaffung stabiler Rahmenbedingungen, beispielsweise durch den Ausgleich von Redezeiten oder die Identifikation von Stagnationsphasen. Die KI bleibt bewusst inhaltlich zurückhaltend. Dieses Szenario eignet sich besonders für Situationen, in denen die Gruppe grundsätzlich gut zusammenarbeitet, aber Unterstützung braucht, um typische Störfaktoren wie Produktionsblockierung oder soziale Hemmungen abzumildern.

Das zweite Szenario greift diesen Ansatz auf, geht aber einen Schritt weiter. Neben der prozeduralen Moderation wird hier der KI-Ally eingesetzt, um in bestimmten Situationen gezielt inhaltliche Impulse zu geben. Dieser Ansatz berücksichtigt die Erfahrung, dass Brainstorming-Sitzungen auch dann ins Stocken geraten können, wenn der Prozess grundsätzlich intakt ist. In solchen Momenten reicht es oft nicht aus, den Prozess lediglich zu reflektieren. Ein externer Stimulus kann helfen, eingefahrene Denkweisen aufzubrechen und neue Perspektiven zu eröffnen. Entscheidend ist, dass diese Impulse bewusst und transparent eingesetzt werden.

Im direkten Vergleich lässt sich sagen, dass Szenario A primär präventiv wirkt. Es stabilisiert den Prozess und reduziert die Wahrscheinlichkeit, dass sich ungünstige Dynamiken überhaupt verfestigen. Szenario B ist stärker situationsabhängig und entfaltet seine Wirkung insbesondere dann, wenn trotz stabiler Rahmenbedingungen keine neuen Ideen mehr entstehen. Die beiden Szenarien stehen nicht in Konkurrenz zueinander. Vielmehr ergänzen sie sich und können je nach Verlauf und Anforderungen kombiniert werden.

Diese Unterscheidung ist besonders wichtig für die weitere Arbeit. Sie ermöglicht es, die Rolle der künstlichen Intelligenz im kreativen Prozess differenziert zu betrachten und nicht auf eine einzelne Funktion zu reduzieren. Gleichzeitig schafft sie eine klare konzeptionelle Grundlage für die anschliessende Methodik. Die folgenden Kapitel bauen auf dieser Einordnung auf und untersuchen, wie die beiden Interventionsszenarien konkret umgesetzt, getestet und miteinander verglichen werden können und welche Auswirkungen sie auf den Verlauf und die Ergebnisse von Brainstorming-Situationen haben.

\newpage

# 5. Methodik

## 5.1. Forschungsansatz: Szenariobasiertes Design

Die vorliegende Arbeit folgt einem szenariobasierten Designansatz als übergreifendem methodischen Rahmen. Dieser Ansatz geht auf Carroll (2000) zurück und eignet sich besonders für die Gestaltung interaktiver Systeme, bei denen das Zusammenspiel von Nutzenden und Technologie im Vordergrund steht. Anstatt von technischen Spezifikationen auszugehen, werden zunächst konkrete Nutzungsszenarien entwickelt, die typische Situationen, Probleme und Handlungsabläufe beschreiben. Diese Szenarien dienen anschliessend als Grundlage für den Systementwurf.

In der vorliegenden Arbeit wurde dieses Prinzip konsequent umgesetzt. In Kapitel 3 wurden zunächst die theoretischen Grundlagen erarbeitet — kognitive, soziale und gruppendynamische Barrieren des Brainstormings. In Kapitel 4 wurden diese Erkenntnisse in drei Szenarien überführt: ein Problemszenario, das die typischen Dynamiken informeller Brainstorming-Sitzungen beschreibt, sowie zwei Interventionsszenarien, die unterschiedliche Rollen künstlicher Intelligenz im Brainstorming-Prozess darstellen. Der in Kapitel 6 beschriebene Prototyp wurde dann direkt aus diesen Szenarien abgeleitet. Jede Entwurfsentscheidung — von der Wahl der Metriken bis zur Eskalationslogik — lässt sich auf ein spezifisches theoretisches Konstrukt oder eine im Szenario identifizierte Problemdynamik zurückführen.

Der szenariobasierte Ansatz bietet mehrere Vorteile für die vorliegende Fragestellung. Er stellt sicher, dass technische Entscheidungen nicht isoliert, sondern stets in Bezug auf die zugrunde liegenden Nutzungssituationen getroffen werden. Er ermöglicht eine klare Rückverfolgbarkeit vom theoretischen Problem über das Szenario bis zur technischen Lösung. Und er unterstützt die modulare Struktur des Systems, da verschiedene Szenarien unterschiedliche Systemkonfigurationen erfordern.

## 5.2. Evaluationsdesign: Within-Subject-Experiment

Während der szenariobasierte Ansatz den Systementwurf leitet, dient ein experimentelles Design der empirischen Überprüfung. Die zentrale Frage lautet: Beeinflusst die KI-basierte Moderation den Verlauf und die Wahrnehmung informeller Brainstorming-Sitzungen messbar?

Zur Beantwortung dieser Frage wird ein Within-Subject-Design (Messwiederholungsdesign) eingesetzt. Jede Gruppe durchläuft zwei Brainstorming-Sitzungen unter unterschiedlichen Bedingungen: eine Sitzung ohne KI-Intervention (Baseline) und eine Sitzung mit KI-basierter Moderation und Ally-Unterstützung (Interventionsbedingung). Dieser Ansatz stellt sicher, dass individuelle Unterschiede in Kreativität, Kommunikationsstil und Gruppenzusammensetzung kontrolliert werden, da jede Gruppe als ihre eigene Kontrollgruppe fungiert.

Um potenzielle Reihenfolgeeffekte zu kontrollieren — wie Lerneffekte, Ermüdung oder Themenvertrautheit — wird ein ausbalanciertes Design angewendet. Die Hälfte der Gruppen absolviert zuerst die Baseline-Bedingung und dann die Interventionsbedingung, während die andere Hälfte in umgekehrter Reihenfolge vorgeht. Diese Ausbalancierung stellt sicher, dass beobachtete Unterschiede auf die experimentelle Bedingung und nicht auf die Aufgabenreihenfolge zurückgeführt werden können.

## 5.3. Teilnehmende und Gruppenbildung

Die Studie zielt auf eine Stichprobe von 24 Teilnehmenden ab, die in acht Gruppen zu je drei Personen eingeteilt werden. Diese Gruppengrösse wurde sowohl aus praktischen als auch aus theoretischen Gründen gewählt. Gruppen von drei Personen sind klein genug, um eine bedeutungsvolle Beteiligung aller Mitglieder zu ermöglichen — was das Risiko von sozialem Faulenzen und Trittbrettfahren reduziert — und gleichzeitig gross genug, um die interpersonellen Dynamiken (Dominanz, Konformität, Konvergenz) zu erzeugen, die das System erkennen und adressieren soll. Mit acht Gruppen können jeweils vier jeder Ausbalancierungsreihenfolge zugewiesen werden, was eine ausgewogene und statistisch tragfähige Vergleichsgrundlage schafft.

Die Teilnehmenden werden aus dem universitären Umfeld rekrutiert. Um verfälschende Effekte durch vorbestehende soziale Dynamiken zu minimieren, werden die Gruppen aus Personen zusammengesetzt, die sich nicht gut kennen oder zufällig zugewiesen werden. Alle Teilnehmenden erhalten eine kurze Einführung in die Brainstorming-Aufgabe, werden jedoch nicht über die spezifische KI-Interventionslogik oder die getesteten Hypothesen informiert, um Demand-Charakteristiken zu reduzieren.

## 5.4. Experimenteller Ablauf

Jede experimentelle Sitzung folgt einem standardisierten Ablauf:

1. **Briefing (5 Minuten):** Die Teilnehmenden erhalten eine allgemeine Einführung in das Sitzungsformat und die Brainstorming-Regeln (keine Kritik, Quantität vor Qualität, Aufgreifen fremder Ideen). Sie werden darüber informiert, dass die Sitzung aufgezeichnet wird und dass ein KI-System anwesend sein kann, erhalten aber keine Details über dessen Interventionslogik.

2. **Erste Brainstorming-Sitzung (15–20 Minuten):** Die Gruppe bearbeitet ein vordefiniertes Brainstorming-Thema. Je nach Gruppenzuordnung findet diese Sitzung mit oder ohne KI-Unterstützung statt.

3. **Kurze Pause (5 Minuten):** Eine kurze Unterbrechung zwischen den Sitzungen zur Reduktion kognitiver Ermüdung und zur klaren Trennung der beiden Bedingungen.

4. **Zweite Brainstorming-Sitzung (15–20 Minuten):** Die Gruppe bearbeitet ein anderes Brainstorming-Thema unter der entgegengesetzten Bedingung.

5. **Fragebogen nach der Sitzung (10 Minuten):** Die Teilnehmenden füllen einen kurzen Fragebogen aus, der die subjektive Erfahrung, die wahrgenommene Beteiligungsbalance, die Ideenvielfalt und — soweit zutreffend — die wahrgenommene Nützlichkeit und Aufdringlichkeit des KI-Systems erfasst.

Die Brainstorming-Themen werden so gewählt, dass sie in Komplexität und Offenheit vergleichbar sind. Sie werden über die Bedingungen hinweg ausbalanciert, um themenspezifische Effekte als Störvariablen zu verhindern.

## 5.5. Unabhängige und abhängige Variablen

Die unabhängige Variable ist die experimentelle Bedingung: Vorhandensein oder Fehlen von KI-basierter Moderation.

Abhängige Variablen werden auf zwei Ebenen gemessen:

**Prozessmetriken (automatisch vom System erfasst):**

- Beteiligungsbalance: Hoover-Index der Redezeitverteilung, Anteil stiller Teilnehmender, Dominanz-Streak-Score, kumulative Partizipationsungleichheit
- Thematische Vielfalt: Neuheitsrate, Cluster-Konzentration (normalisierter HHI), Explorations-Elaborations-Verhältnis
- Verlauf der Gesprächszustände: Zeitanteile in jedem der fünf inferierten Zustände, Anzahl der Zustandswechsel
- Stagnation: Dauer ohne neue Beiträge
- Ideenflüssigkeit: Substantive Beiträge pro Minute (Ideational Fluency Rate)
- Aufbauverhalten: Piggybacking-Score (semantische Ähnlichkeit aufeinanderfolgender Sprecherwechsel)

**Subjektive Masse (via Fragebogen):**

- Wahrgenommene Ideenvielfalt
- Wahrgenommene Fairness der Beteiligung
- Wahrgenommene Nützlichkeit der KI (nur Interventionsbedingung)
- Wahrgenommene Aufdringlichkeit der KI (nur Interventionsbedingung)
- Gesamtzufriedenheit mit dem Brainstorming-Prozess

## 5.6. Analysestrategie

Die primäre Analyse vergleicht Prozessmetriken zwischen Baseline- und Interventionsbedingung mittels gepaarter statistischer Tests, die für die Stichprobengrösse angemessen sind. Bei der erwarteten Stichprobe von acht Gruppen werden nicht-parametrische Verfahren wie der Wilcoxon-Vorzeichen-Rang-Test gegenüber parametrischen Alternativen bevorzugt, da sie keine Normalverteilung voraussetzen und mit kleinen Stichproben robuster sind.

Die wichtigsten Vergleiche umfassen:

- Mittlerer Hoover-Index (Beteiligungsbalance) zwischen den Bedingungen
- Mittlere Neuheitsrate und Cluster-Konzentration zwischen den Bedingungen
- Anteil der Sitzungszeit in Risikozuständen (Dominanz, Konvergenz, Stagnation) versus gesunden Zuständen
- Recovery-Rate: Anteil der Interventionen, die zu messbarer Metrikverbesserung innerhalb des Post-Check-Fensters führten

Reihenfolgeeffekte werden bewertet, indem die Erstrundenleistung zwischen Gruppen verglichen wird, die mit der Baseline begannen, und Gruppen, die mit der Interventionsbedingung begannen.

Subjektive Masse werden deskriptiv ausgewertet und zwischen den Bedingungen verglichen. Qualitatives Feedback aus offenen Fragen dient zur Ergänzung und Kontextualisierung der quantitativen Befunde.

## 5.7. Ethische Aspekte

Alle Teilnehmenden geben vor dem Experiment eine informierte Einwilligung ab. Sie werden darüber informiert, dass Sitzungen aufgezeichnet werden und dass ein KI-System anwesend sein kann. Die Teilnahme ist freiwillig, und die Teilnehmenden können jederzeit ohne Konsequenzen abbrechen. Audio- und Transkriptdaten werden sicher gespeichert und für die Analyse pseudonymisiert. Das Studienprotokoll wird vom betreuenden Lehrstuhl geprüft.

\newpage

# 6. Prototyp

## 6.1. Ziele und konzeptioneller Rahmen

Der entwickelte Prototyp bildet die technische Grundlage für die Umsetzung der in Kapitel 4 beschriebenen Szenarien. Während die vorangegangenen Kapitel das Problem des informellen Brainstormings theoretisch hergeleitet und konzeptionelle Interventionsmodelle entwickelt haben, geht es hier darum, diese Überlegungen in ein funktionierendes System zu übersetzen. Der Prototyp dient somit als experimentelle Umgebung, in der unterschiedliche Rollen künstlicher Intelligenz kontrolliert umgesetzt und vergleichbar gemacht werden können. Es ist wichtig, den Anspruch des Systems realistisch einzuordnen. Es handelt sich weder um ein fertiges Produkt noch um eine umfassende Plattform für kreative Zusammenarbeit. Aspekte wie Skalierbarkeit, langfristige Wartbarkeit oder kommerzielle Einsatzfähigkeit standen nicht im Fokus. Stattdessen wurde eine bewusst reduzierte, kontrollierbare Umgebung geschaffen. Das Ziel war es, die Rolle der KI isoliert untersuchen zu können, ohne dass andere Variablen — etwa Interface-Komplexität oder zusätzliche Funktionen — die Ergebnisse verzerren. Der Prototyp sollte daher weniger als «Applikation» und mehr als experimentelles Setup verstanden werden. Er schafft einen Rahmen, in dem bestimmte Dynamiken sichtbar und analysierbar werden. Gerade diese bewusste Reduktion erlaubt es, Unterschiede zwischen den Szenarien klarer zu identifizieren.

### 6.1.1. Prozessunterstützung statt Ideenersetzung

Eine der zentralen Entscheidungen bestand darin, KI nicht primär als Ideenquelle einzusetzen. Obwohl grosse Sprachmodelle mittlerweile in der Lage sind, kreative Vorschläge zu formulieren und komplexe Zusammenhänge sprachlich auszuarbeiten, hätte ein solcher Fokus den Schwerpunkt dieser Arbeit verschoben. Ziel ist es hier nicht zu zeigen, dass KI bessere oder kreativere Ideen produziert als Menschen. Vielmehr geht es um die Frage, wie sich der Gruppenprozess verändert, wenn KI strukturell unterstützend eingreift.

Kreativität in Gruppen entsteht nicht allein durch individuelle Geistesblitze, sondern durch Interaktion. Ideen werden aufgegriffen, verändert, weiterentwickelt oder auch verworfen. Genau diese Dynamik kann verloren gehen, wenn ein System dominante inhaltliche Beiträge liefert. Es besteht die Gefahr, dass Gruppen sich an maschinell generierten Vorschlägen orientieren oder diese unreflektiert übernehmen. In einem solchen Fall würde nicht mehr der Prozess untersucht, sondern primär die Qualität der KI-Outputs.

Aus diesem Grund wurde der Prototyp bewusst so konzipiert, dass die KI zunächst auf der Prozessebene operiert. Sie beobachtet, erkennt Muster und greift in einer moderierenden Rolle ein. Nur im erweiterten Szenario wird eine zusätzliche inhaltliche Impulsfunktion aktiviert — diese ist jedoch ebenfalls kontrolliert und situativ. Die kreative Hauptverantwortung bleibt stets bei der Gruppe.

### 6.1.2. Theoretische Anbindung an die Systemlogik

Die konzeptionelle Ausrichtung des Prototyps basiert direkt auf den in Kapitel 4 beschriebenen Problemdynamiken des informellen Brainstormings. Dazu gehören insbesondere ungleiche Beteiligung, inhaltliche Verengung, Stagnationsphasen und implizite Konformitätsprozesse. Diese Effekte treten selten isoliert auf. Sie verstärken sich häufig gegenseitig und führen schrittweise zu einer Verengung des Ideenraums, ohne dass die Gruppe dies unmittelbar bemerkt.

Der Prototyp wurde daher nicht entwickelt, um ein einzelnes Problem zu lösen. Vielmehr sollte er in der Lage sein, mehrere Ebenen gleichzeitig anzusprechen. Dafür musste die Architektur Gesprächsverläufe strukturell erfassen, wiederkehrende Muster zumindest annäherungsweise erkennen und zwischen verschiedenen Interventionsarten unterscheiden können.

Es ist klar, dass die Erkennung solcher Dynamiken aus technischer Sicht nur approximativ erfolgen kann. Der Prototyp stellt keine vollständige Diskursanalyse dar. Stattdessen arbeitet er mit operationalisierten Indikatoren, wie relativer Redezeit oder semantischer Ähnlichkeit von Beiträgen. Diese Annäherungen sind jedoch ausreichend, um Muster sichtbar zu machen und darauf zu reagieren.

### 6.1.3. Szenariobasierte Struktur

Ein zentrales Merkmal des Systems ist sein modularer, szenariobasierter Aufbau. Anstatt ein starres KI-Verhalten zu implementieren, wurde eine Architektur entwickelt, in der verschiedene Interventionsmodi aktiviert oder deaktiviert werden können.

Daraus ergeben sich drei klar unterscheidbare Konfigurationen:

| Szenario | KI-Rolle | Interventionsgrad | Funktion |
|---|---|---|---|
| Baseline | Keine aktive KI | 0% | Referenzbedingung |
| Szenario A | Prozessmoderation | Niedrig | Stabilisierung |
| Szenario B | Moderation + Ally | Mittel | Reaktivierung |

Diese Konfigurationen ermöglichen einen direkten Vergleich der Effekte. Die Rahmenbedingungen — Gruppengrösse, Aufgabe, Dauer — bleiben konstant. Nur die Rolle der KI ändert sich. Dadurch wird sichtbar, ob und wie sich die Prozessdynamiken verschieben.

### 6.1.4. Leitende Designprinzipien

Die Entwicklung des Prototyps folgte mehreren grundlegenden Prinzipien, die den gesamten Implementierungsprozess geleitet haben.

Erstens: **Minimale Invasivität.** Die KI soll nur dann eingreifen, wenn es aus prozeduraler Sicht notwendig erscheint. Eine permanent aktive KI würde selbst zur dominanten Instanz werden und potenziell neue Störfaktoren erzeugen.

Zweitens: **Transparenz.** Die Gruppenmitglieder müssen erkennen können, welche Rolle die KI gerade einnimmt. Ob ein Vorschlag aus der Moderationslogik stammt oder ein inhaltlicher Impuls aus dem Ally-Modus ist, wird klar angezeigt. Diese Offenheit reduziert Unsicherheit und stärkt das Vertrauen.

Drittens: **Modularität.** Analyse- und Generierungskomponenten sind voneinander getrennt. Dies ermöglicht es, die Auswahl des zugrunde liegenden Sprachmodells je nach Aufgabe anzupassen.

Viertens: **Theoretische Fundierung.** Technische Entscheidungen wurden nicht isoliert getroffen, sondern stets in Bezug auf die zuvor identifizierten Problemdynamiken reflektiert.

### 6.1.5. Einordnung im Kontext aktueller KI-Forschung und Modellevaluation

In den letzten zwei bis drei Jahren hat sich die Diskussion um grosse Sprachmodelle merklich verschoben. Es ist nicht nur so, dass die Modelle selbst leistungsfähiger geworden sind — obwohl das sicherlich zutrifft —, sondern auch, dass unser Verständnis davon, wie man sie evaluiert, komplizierter geworden ist. Frühere Benchmarks konzentrierten sich tendenziell auf klar definierte NLP-Aufgaben: Klassifikation, Übersetzung, Fragebeantwortung. Klare Inputs, klare Outputs. Heute versucht die Evaluation zunehmend, etwas Unordentlicheres zu erfassen — offene Interaktion, Dialog, kontextuelles Schlussfolgern. Und sobald Modelle in diese weniger strukturierten Settings wechseln, wird der Vergleich schwieriger. Gleichzeitig wird er viel wichtiger. Wie Ni et al. (2025) anmerken, kämpfen moderne Benchmark-Ökosysteme mit Problemen wie Kontaminationseffekten, Verteilungsverschiebungen und begrenzter Übertragbarkeit auf reale Anwendungsfälle. Was auf dem Papier überzeugend aussieht, hält in der Praxis nicht unbedingt stand.

Ein bekanntes Beispiel für dieses neuere Evaluationsparadigma ist Chatbot Arena (Chiang et al., 2024). Anstatt sich rein auf statische Datensätze zu verlassen, lässt die Plattform Modelle in anonymen paarweisen Vergleichen gegeneinander antreten. Echte Nutzende entscheiden, welche Antwort sie überzeugender finden. In vielerlei Hinsicht fühlt sich das erfrischend pragmatisch an. Es bringt die Evaluation näher an die Art und Weise, wie Modelle tatsächlich erlebt werden — durch menschliche Wahrnehmung. Was hier zählt, ist nicht nur, ob eine Antwort technisch korrekt ist, sondern ob sie hilfreich, klar oder kohärent wirkt.

Gleichzeitig führt dieser Ansatz eine andere Art von Komplexität ein. Chiang et al. (2024) erkennen an, dass die Ergebnisse stark vom Kontext abhängen. Die Art der eingereichten Prompts, die Diversität und der Hintergrund der Nutzerbasis, sogar die umgebende Interaktionsumgebung — all diese Faktoren beeinflussen die Ergebnisse. Ein Modell, das bei kreativen, offenen Gesprächen stark abschneidet, könnte bei strukturierten analytischen Aufgaben ganz andere Eigenschaften zeigen. Rankings, die in solchen Umgebungen generiert werden, können daher nicht als objektive Wahrheiten behandelt werden. Sie spiegeln ein spezifisches Evaluationssetup wider, keine absolute Qualitätshierarchie.

Diese Spannung wird in der Kritik von Singh et al. (2025) in *The Leaderboard Illusion* noch deutlicher. Ihre Analyse legt nahe, dass Leaderboard-Systeme keine rein neutralen Messinstrumente sind. Strukturelle Asymmetrien können entstehen. Insbesondere beschreiben die Autoren nichtöffentliche Testpraktiken, bei denen Anbieter intern mehrere Modellvarianten evaluieren, bevor sie eine öffentlich einreichen. Natürlich wird die am besten abschneidende Variante ausgewählt. Das öffentliche Ranking spiegelt folglich eine gefilterte Ansicht der Leistung wider. Singh et al. (2025) weisen zudem darauf hin, dass proprietäre Modelle innerhalb der Arena höhere Sampling-Raten erhalten können, was ihnen wiederum mehr Evaluationsdaten liefert. Im Laufe der Zeit kann diese Dynamik den Wettbewerb verzerren und sogar Anreize für Overfitting an Arena-spezifische Interaktionsmuster setzen, anstatt breitere Robustheit zu fördern.

Über Leaderboard-spezifische Dynamiken hinaus identifizieren Ni et al. (2025) allgemeinere Schwächen im zeitgenössischen Benchmark-Design. Datenkontamination bleibt ein anhaltendes Problem. Benchmark-Overfitting ist schwer vollständig auszuschliessen. Und vielleicht am wichtigsten: Starke Benchmark-Leistung übersetzt sich nicht automatisch in zuverlässiges Verhalten in komplexen, interaktiven Systemen. Scores können informativ sein — aber sie erzählen nicht die ganze Geschichte.

Für den in dieser Arbeit entwickelten Prototyp sind diese Überlegungen nicht abstrakt. Das System soll nicht einfach polierten eigenständigen Text generieren. Es muss Gesprächsverläufe analysieren, strukturelle Muster erkennen, vorsichtig in einer moderierenden Rolle eingreifen und — unter bestimmten Bedingungen — gezielte Impulse einbringen. Diese Aufgaben unterscheiden sich erheblich voneinander. Ein Modell, das bei Benchmarks für kreatives Schreiben herausragt, ist möglicherweise nicht gut geeignet für zurückhaltende, prozessorientierte Moderation. Umgekehrt kann ein Modell, das in präferenzbasierten Dialogvergleichen überzeugend abschneidet, Schwächen zeigen, wenn es wiederholt strukturierte analytische Bewertungen durchführen muss. «Modellqualität» als eine einzige, einheitliche Eigenschaft zu behandeln, wäre daher irreführend.

Neuere Arbeiten zum Model-Routing, insbesondere SelectLLM (Maurya et al., 2025), nehmen diese Differenzierung ernst. Anstatt anzunehmen, dass ein Modell alles gleich gut kann, schlagen die Autoren einen abfragebewussten Auswahlmechanismus vor. Eingehende Anfragen werden dynamisch an das geeignetste Modell innerhalb eines grösseren Pools geleitet. Die Kernidee ist einfach, aber überzeugend: Die Leistung hängt von den Aufgabeneigenschaften ab. Die Abstimmung der Modellwahl auf den Abfragetyp kann die Effizienz verbessern und gleichzeitig die Zuverlässigkeit erhöhen.

In diesem Licht wird die modulare Architektur des vorliegenden Prototyps leichter zu rechtfertigen. Die Modellauswahl sollte sich nicht ausschliesslich auf globale Rankings oder Schlagzeilen-Benchmark-Scores stützen. Diese können als erste Orientierung dienen — sind aber allein nicht ausreichend. Was letztlich zählt, ist, ob ein Modell zu den funktionalen Anforderungen einer bestimmten Systemkomponente passt — ob es für die Analyse, die Moderation oder die Impulsgenerierung verantwortlich ist. Die Evaluation muss mit anderen Worten aufgabensensitiv bleiben. Nur dann können Architekturentscheidungen sinnvoll in der aktuellen Forschung verankert werden.

## 6.2. Systemarchitektur und Interventionslogik

### 6.2.1. Funktionale Systemarchitektur

Die Systemarchitektur überführt die Interventionsszenarien aus Kapitel 4 in eine technisch operative Struktur. Es handelt sich nicht um eine universelle Kollaborationsplattform. Der Umfang ist bewusst eng gefasst: eine kontrollierte experimentelle Umgebung, in der verschiedene KI-Rollen unter identischen Bedingungen aktiviert, beobachtet und verglichen werden können.

Im Kern folgt die Architektur einem modularen, schichtbasierten Design. Sechs funktionale Module übernehmen jeweils unterschiedliche Verantwortlichkeiten — von der Audioübertragung bis zur Auslieferung gesprochener Interventionen. Diese Trennung spiegelt die theoretische Unterscheidung zwischen Beobachtung, Bewertung und Intervention wider, die in den vorangegangenen Kapiteln entwickelt wurde. Jede Schicht arbeitet unabhängig, was bedeutet, dass ein Fehler im Interventionsgenerierungsmodul weder den laufenden Videoanruf noch die Transkriptionspipeline unterbricht.

Die sechs Module sind:

1. Videokommunikationsschicht
2. Speech-to-Text-Schicht
3. Prozessanalyseschicht
4. Entscheidungs- und Triggerschicht
5. Interventionsgenerierungsschicht
6. Overlay-Interface

**Videokommunikationsschicht**

Die kommunikative Grundlage des Prototyps ist ein browserbasiertes Videokonferenzsystem, das auf WebRTC-Technologie mit einer Selective-Forwarding-Unit-(SFU-)Architektur aufbaut. Die Teilnehmenden treten direkt über die Webanwendung einem gemeinsamen Videoraum bei. Keine zusätzliche Software ist erforderlich.

Diese Schicht übernimmt Audio- und Videoübertragung, Teilnehmerverwaltung und die Bereitstellung von Metadaten wie Informationen zum aktiven Sprecher. Eine architektonische Entscheidung verdient hier besondere Beachtung. Das System erfasst individuelle Audiospuren pro Teilnehmendem statt eines einzigen gemischten Audiostreams. Diese Pro-Teilnehmer-Isolation ist nicht bloss eine technische Bequemlichkeit — sie ermöglicht direkt eine genaue Sprecherzuordnung in der Transkriptionsschicht, die wiederum die Grundlage für alle Partizipationsmetriken bildet. Ohne genau zu wissen, wer was gesagt hat, würde die Messung der Redezeitverteilung oder die Erkennung von Dominanzmustern eine nachträgliche Sprecherdiarisierung erfordern — ein fehleranfälliger und rechenintensiver Prozess, der Unsicherheit am Fundament der analytischen Pipeline einführt.

Die KI-Logik bleibt strikt von dieser Ebene getrennt. Das System modifiziert hier weder den Gesprächsfluss noch verändert es die Struktur des Anrufs. Selbst wenn alle analytischen Komponenten vorübergehend inaktiv wären, würde die Videositzung normal weiterlaufen.

**Speech-to-Text-Schicht**

Gesprochene Beiträge müssen in maschinenlesbare Texte transformiert werden, bevor eine Analyse stattfinden kann. Die Speech-to-Text-Komponente führt diese Transformation durch kontinuierliche Echtzeit-Transkription individueller Audioströme durch.

Die Transkription arbeitet nach einem Zweikanal-Modell. Ein Primärkanal nutzt eine Streaming-Spracherkennungs-API, die eine persistente bidirektionale Verbindung zwischen dem Browser jedes Teilnehmenden und dem Transkriptionsdienst aufrechterhält. Zwischenergebnisse erscheinen fast unmittelbar beim Sprechen, finalisierte Segmente kommen, sobald das System eine natürliche Pause erkennt. Ein Sekundärkanal auf Basis der browsereigenen Spracherkennung dient als automatischer Fallback bei Verbindungsunterbrechungen.

Die Ausgabe auf dieser Stufe besteht aus zeitgestempelten Textsegmenten mit Sprecherzuordnung und sequenzieller Ordnung. Keine bewertende oder interpretierende Verarbeitung findet hier statt.

**Prozessanalyseschicht**

Die Prozessanalyseschicht bildet die konzeptionelle Brücke zwischen theoretischer Problemidentifikation und technischer Messung. Ihr Zweck ist es, die in den Kapiteln 3 und 4 diskutierten kognitiven, sozialen und gruppendynamischen Mechanismen in quantifizierbarer Form zu operationalisieren.

Eine vollständige Diskursanalyse würde den Rahmen eines Forschungsprototyps sprengen. Das System arbeitet daher mit Proxy-Indikatoren — approximativen Metriken, die wiederkehrende strukturelle Muster erfassen, ohne Anspruch auf erschöpfendes semantisches Verständnis zu erheben. Diese Indikatoren fallen in zwei breite Kategorien.

Partizipationsmetriken quantifizieren die Verteilung und Balance der Beiträge über die Gruppenmitglieder. Sie erfassen Phänomene wie Redezeit-Ungleichgewichte, stille Teilnehmende und Dominanz-Streaks — Muster, die auf entstehende informelle Hierarchien oder Tendenzen zum sozialen Faulenzen hindeuten können, wie in Abschnitt 3.1.3 beschrieben.

Semantische Dynamikmetriken verwenden einbettungsbasierte Ähnlichkeitsanalyse zur Bewertung der thematischen Entwicklung der Diskussion. Einzelne Beiträge werden in Vektorrepräsentationen transformiert und hinsichtlich relativer Distanz verglichen. Zunehmende Ähnlichkeit über aufeinanderfolgende Segmente kann auf thematische Verengung hindeuten. Das Fehlen neuer semantischer Cluster über einen Zeitraum wird als Stagnation interpretiert.

Diese Indikatoren sind keine willkürlichen Auswahlen. Jeder einzelne verbindet sich mit einem spezifischen theoretischen Mechanismus, der zuvor beschrieben wurde. Ausgeprägte Redezeit-Ungleichgewichte operationalisieren beispielsweise das Konzept informeller Hierarchien und ungleicher Beteiligung. Anhaltende semantische Konvergenz approximiert den schrittweisen Einsatz von Gruppendenken-Dynamiken.

**Entscheidungs- und Triggerschicht**

Die Entscheidungslogik bildet den normativen Kern der Architektur. Hier bestimmt das System, ob und wann eingegriffen wird.

Wichtig ist, dass das System nicht auf momentane Schwankungen reagiert. Eine einzelne Person, die für dreissig Sekunden etwas mehr spricht als andere, rechtfertigt keine Intervention. Stattdessen reagiert das System nur auf Muster, die über definierte Zeitfenster bestehen bleiben. Diese Designentscheidung spiegelt das theoretische Verständnis wider, dass problematische Brainstorming-Dynamiken sich schrittweise entwickeln — sie bauen sich über Minuten auf, nicht über Sekunden.

Die Entscheidungsschicht arbeitet mit einem zustandsbasierten Modell. Zu jedem Zeitpunkt klassifiziert das System die Konversation in einen von fünf Zuständen, die verschiedene Aspekte der Gruppengesundheit erfassen. Zwei dieser Zustände repräsentieren produktive Dynamiken: ausgewogene Exploration und fokussierte Elaboration. Drei Zustände repräsentieren Risikobedingungen — Dominanz durch einzelne Teilnehmende, Konvergenz der Ideen in einen engen thematischen Korridor und Stagnation, bei der die Diskussion ihren kreativen Schwung vollständig verliert.

Die Zustandsklassifikation speist sich in einen vierphasigen Interventionszyklus. Das System beginnt in einer Monitoring-Phase, wechselt in eine Bestätigungsphase wenn ein Risikozustand erkannt wird, feuert eine Intervention wenn das Risiko bestehen bleibt, und tritt dann in eine Post-Interventions-Beobachtungsphase gefolgt von einer Abkühlphase ein. Diese mehrphasige Struktur verhindert Überreaktion und operationalisiert das Prinzip der minimalen Invasivität aus Abschnitt 6.1.4.

**Interventionsgenerierungsschicht**

Sobald die Entscheidungsschicht bestimmt, dass eine Intervention gerechtfertigt ist, übersetzt das Interventionsgenerierungsmodul den aktuellen Systemzustand in einen sprachlich formulierten Prompt. Die zugrunde liegende Triggerlogik ist regelbasiert, aber die tatsächliche Formulierung wird dynamisch von einem grossen Sprachmodell generiert.

In Szenario A operiert das System ausschliesslich als struktureller Moderator. Es kann auf ungleiche Beteiligung hinweisen, aufkommende thematische Wiederholung bemerken oder die Gruppe ermutigen, andere Blickwinkel zu erkunden. Die Sprache ist bewusst neutral und adressiert stets die Gruppe als Ganzes. Niemand wird einzeln herausgestellt.

In Szenario B wird eine zusätzliche inhaltsorientierte Impulsfunktion verfügbar. Dieser Ally-Modus aktiviert sich nur, wenn vorheriges prozessorientiertes Feedback keine messbare Veränderung bewirkt hat. Der Ally kann eine hypothetische Gegenperspektive einführen, eine Reframing-Frage stellen oder einen bewusst vereinfachten Blickwinkel auf das Thema anbieten. Auch in diesem Modus bleiben Interventionen offen. Der Ally schreibt keine Lösungen vor, sondern versucht, den thematischen Suchraum der Gruppe wieder zu öffnen.

Ein zentrales Designprinzip durchgängig ist Transparenz. Das System kennzeichnet explizit, ob eine Intervention aus der Moderationslogik oder aus der Ally-Funktion stammt. Diese Rollenklarheit reduziert Unsicherheit und verstärkt Vertrauen — eine Voraussetzung, die die Literatur als wesentlich für die Akzeptanz von KI in kollaborativen Settings identifiziert (Johnson et al., 2025).

**Overlay-Interface**

Interventionen erreichen die Teilnehmenden über ein dediziertes Interface-Panel, das neben dem Videoanruf positioniert ist. Diese räumliche Trennung ist beabsichtigt. Die Videokonferenzansicht belegt den zentralen Bildschirmbereich, während die Interface-Komponenten der KI in einem Seitenpanel erscheinen.

Die KI erscheint nicht als konventioneller Dialogpartner. Sie fungiert als reflektierende Präsenz, die situativ auftaucht und sich zurückzieht, sobald ihr Impuls übermittelt wurde. Optional können Interventionen auch hörbar durch Text-to-Speech-Ausgabe übermittelt werden. Rate-Limiting-Mechanismen stellen sicher, dass gesprochene Ausgaben sich nicht überlappen oder akkumulieren, um den natürlichen Diskussionsfluss zu schützen.

### 6.2.2. Interventionslogik

Während der vorherige Abschnitt die strukturellen Komponenten des Systems beschrieb, konzentriert sich dieser Abschnitt darauf, wie sich das System verhält — unter welchen Bedingungen es aktiv wird und wie es seine Reaktionen eskaliert.

**Fünf Gesprächszustände**

Das System klassifiziert die laufende Diskussion kontinuierlich in einen von fünf Zuständen. Diese Klassifikation läuft in regelmässigen Intervallen und stützt sich sowohl auf Partizipationsmetriken als auch auf semantische Dynamikmetriken, die in der Prozessanalyseschicht berechnet werden.

Zwei Zustände erfassen gesunde Dynamiken:

*Gesunde Exploration* beschreibt eine Phase, in der die Beteiligung ausgewogen ist, häufig neue Ideen entstehen und der thematische Suchraum der Gruppe sich erweitert. Dies repräsentiert die Art produktiven divergenten Denkens, die informelles Brainstorming anstrebt, aber oft nicht aufrechterhalten kann.

*Gesunde Elaboration* beschreibt eine Phase, in der die Gruppe sich darauf konzentriert, bestehende Ideen zu entwickeln und zu vertiefen, statt neue zu generieren. Die Neuheit ist geringer, aber die Beteiligung bleibt ausgewogen und die Diskussion verengt sich nicht. Dieser Zustand spiegelt einen natürlichen und produktiven Modus der Gruppenarbeit wider, der keine Intervention auslösen sollte.

Drei Zustände erfassen Risikobedingungen:

*Dominanzrisiko* wird ausgelöst, wenn die Beteiligung deutlich ungleich wird. Eine oder zwei Personen machen einen unverhältnismässig grossen Anteil der Beiträge aus, während andere verstummen oder sich auf kurze Bestätigungen beschränken. Dieser Zustand operationalisiert die in Abschnitt 3.1.3 beschriebenen informellen Hierarchie-Effekte.

*Konvergenzrisiko* entsteht, wenn die thematische Vielfalt der Beiträge abnimmt. Ideen gruppieren sich zunehmend eng um wenige Themen, die Neuheit sinkt und der Suchraum der Gruppe verengt sich. Dieses Muster approximiert die frühen Stadien des Gruppendenkens, wie in der Literaturübersicht diskutiert.

*Stagnierte Diskussion* beschreibt eine Situation, in der die Neuheit sehr gering ist, über einen längeren Zeitraum keine neuen semantischen Cluster aufgetaucht sind und die Diskussion effektiv ihren Vorwärtsschwung verloren hat. Die Gruppe redet möglicherweise noch, aber kreativ hat der Prozess eine Sackgasse erreicht.

Die Zustandsklassifikation verwendet gewichtete Konfidenzscores über mehrere Metriken anstelle einfacher binärer Schwellenwerte. Jeder Zustand erhält einen Konfidenzwert zwischen null und eins, berechnet aus einer gewichteten Kombination der relevanten Indikatoren. Ein Hysterese-Mechanismus verhindert, dass das System als Reaktion auf geringfügige Schwankungen zwischen Zuständen flackert — der inferierte Zustand muss einen bedeutsamen Konfidenzvorsprung gewinnen, bevor das System wechselt. Wenn zwei Zustände sehr nahe in der Konfidenz liegen, priorisiert das System Risikozustände gegenüber gesunden. Diese Asymmetrie ist beabsichtigt. Sie spiegelt das Prinzip wider, dass das Nichterkennen eines Problems kostspieliger ist als eine kurze Fehlidentifikation einer gesunden Phase als riskant.

**Vierphasiger Interventionszyklus**

Die Zustandsklassifikation allein löst keine Intervention aus. Das System folgt einem vierphasigen Zyklus, der zeitliche Sicherungen zwischen Erkennung und Handlung einführt.

In der *Monitoring*-Phase beobachtet und klassifiziert das System, ergreift aber keine sichtbare Massnahme. Brainstorming beinhaltet natürlicherweise Schwankungen in Fokus und Beteiligung. Nicht jedes vorübergehende Ungleichgewicht deutet auf ein strukturelles Problem hin. Solange der inferierte Zustand gesund bleibt oder Risikobedingungen vorübergehend sind, verbleibt das System in dieser Phase.

Wenn ein Risikozustand erkannt wird und über einen definierten Bestätigungszeitraum anhält, wechselt das System in die *Bestätigungsphase*. Während dieses Fensters prüft das System, ob die Mehrheit der jüngsten Metrik-Snapshots konsistent auf dieselbe Risikobedingung hinweist. Nur wenn dieser Konsistenzschwellenwert erreicht ist, fährt das System fort. Dies verhindert Interventionen auf Basis kurzlebiger Anomalien.

Bei Bestätigung tritt das System in die *Post-Check*-Phase ein. Eine Intervention wird generiert und an die Gruppe übermittelt. Das System beobachtet dann, ob sich die Metriken innerhalb eines definierten Beobachtungsfensters verbessern.

Nach dem Beobachtungsfenster wechselt das System in eine *Abkühlphase*, während der keine weiteren Interventionen erlaubt sind. Dies erzwingt zeitlichen Abstand und verhindert, dass die KI die Sitzung durch übermässige Aktivität dominiert. Der Zyklus kehrt dann zum Monitoring zurück.

Ein Ermüdungsmechanismus fügt eine adaptive Dimension hinzu. Wenn vorherige Interventionen keine Erholung bewirkt haben, verlängert das System sowohl die Bestätigungs- als auch die Abkühlungsdauer durch konfigurierbare Multiplikatoren. Wiederholte erfolglose Interventionen führen zu progressiv längeren Wartezeiten vor dem nächsten Versuch.

**Eskalation und Szenariodifferenzierung**

In Szenario A ist nur prozessorientierte Moderation verfügbar. Die Ally-Funktion bleibt unabhängig von den Post-Check-Ergebnissen inaktiv.

In Szenario B ist Eskalation erlaubt. Wenn eine Moderationsintervention während des Post-Check-Fensters keine messbare Verbesserung bewirkt, kann sich die Ally-Funktion im nächsten Zyklus aktivieren. Der Ally liefert einen einzelnen inhaltsbasierten Impuls und zieht sich dann zurück.

In der Baseline-Bedingung laufen alle analytischen Komponenten normal. Metriken werden berechnet, Zustände inferiert und alles wird protokolliert. Der einzige Unterschied besteht darin, dass keine sichtbare Intervention jemals generiert wird.


## 6.3. Implementierung und technische Umsetzung

### 6.3.1. Technologie-Stack und Systemumgebung

Der Prototyp wurde als browserbasierte Webanwendung unter Verwendung eines modernen Full-Stack-JavaScript-Frameworks mit serverseitigem Rendering implementiert. Diese Wahl wurde von drei Überlegungen geleitet. Eine browserbasierte Implementierung erfordert keine Softwareinstallation auf den Geräten der Teilnehmenden. Sie integriert sich natürlich in die WebRTC-basierte Videoinfrastruktur. Und sie unterstützt schnelle Iteration während der Entwicklung, ohne separate Build- und Deployment-Prozesse für Client- und Serverkomponenten zu erfordern.

Das System folgt einer hybriden Client-Server-Architektur. Die Aufteilung der Verantwortlichkeiten zwischen Client und Server war nicht willkürlich — sie spiegelt die unterschiedlichen Latenzanforderungen der funktionalen Komponenten des Systems wider.

Auf der Client-Seite übernimmt die Anwendung Echtzeit-Transkriptionsverarbeitung, Metrikberechnung, Decision-Engine-Ausführung, Zustandsverwaltung und das Rendering der Benutzeroberfläche. Diese Aufgaben erfordern sofortige Reaktionsfähigkeit. Sie über einen Remote-Server zu leiten, würde Netzwerklatenz genau an den Stellen einführen, wo Timing am wichtigsten ist.

Der Server übernimmt Aufgaben, die geschützte Anmeldedaten oder aufwändigere Berechnungen erfordern. Sprachmodell-API-Aufrufe zur Generierung von Interventionstexten laufen serverseitig, um API-Schlüssel aus der Browserumgebung herauszuhalten. Einbettungsberechnungen für semantische Ähnlichkeitsanalyse werden über einen Server-Endpunkt geleitet, der Caching verwaltet. Modell-Routing-Konfigurationen und Interventionsprotokolle werden über serverseitige API-Routen persistiert.

Externe Dienste bilden die dritte Säule der Architektur. Eine cloudbasierte Videokonferenzplattform stellt die WebRTC-Infrastruktur mit SFU-Topologie und Pro-Teilnehmer-Audiospurisolation bereit. Sprachmodelle übernehmen die Interventionstext-Generierung. Einbettungsmodelle unterstützen die semantische Ähnlichkeitsberechnung. Ein Text-to-Speech-Dienst ermöglicht die hörbare Übermittlung von Interventionen. Eine verwaltete PostgreSQL-Datenbank mit integrierten Echtzeit-Benachrichtigungsfähigkeiten dient als zentrale Persistenzschicht und bietet Datensynchronisation über alle verbundenen Clients.

### 6.3.2. Echtzeit-Datenfluss

Der Echtzeit-Datenfluss verbindet gesprochene Worte innerhalb von Sekunden mit analysierten Gesprächszuständen.

Der Prozess beginnt am Mikrofon jedes Teilnehmenden. Audio wird als isolierter Stream über die Videokonferenzinfrastruktur erfasst. Diese Pro-Teilnehmer-Erfassung eliminiert die Notwendigkeit einer Sprecherdiarisierung — den rechenintensiven und fehleranfälligen Prozess der Trennung individueller Stimmen aus einem gemischten Signal.

Jeder Audiostream speist in einen dedizierten Transkriptionskanal. Der Primärkanal unterhält eine persistente bidirektionale Verbindung zu einem Streaming-Spracherkennungsdienst. Ein Fallback-Kanal auf Basis der browsereigenen Spracherkennung aktiviert sich automatisch bei Verbindungsunterbrechungen.

Ein Echo-Gate-Mechanismus adressiert ein subtiles aber wichtiges Problem. Wenn eine Intervention laut durch Text-to-Speech gesprochen wird, könnte das resultierende Audio vom Mikrofon des Teilnehmenden wieder erfasst und als Phantombeitrag transkribiert werden. Das Echo-Gate unterdrückt die Transkription von Audio, das innerhalb eines kurzen Zeitfensters nach einem TTS-Ereignis auftritt.

Finalisierte Transkriptsegmente werden über zwei parallele Synchronisierungskanäle verteilt. Ein Peer-to-Peer-Datenkanal verteilt Segmente mit sehr niedriger Latenz an alle verbundenen Clients. Gleichzeitig werden Segmente in der zentralen Datenbank persistiert, die wiederum alle Clients über ihren Echtzeit-Abonnementmechanismus benachrichtigt. Diese Dual-Sync-Strategie kombiniert die Geschwindigkeit der Peer-to-Peer-Verteilung mit der Dauerhaftigkeit serverseitiger Persistenz.

Die Metrikberechnung läuft auf einem gleitenden Zeitfenster. In regelmässigen Intervallen schneidet das System die jüngsten Transkriptsegmente — typischerweise die letzten drei Minuten — und berechnet sowohl Partizipationsmetriken als auch semantische Dynamikmetriken.

### 6.3.3. Decision Engine und Interventionsauslieferung

Die Decision Engine läuft auf einem einzigen designierten Client — dem Decision Owner. Dieses Ownership-Modell verhindert widersprüchliche Entscheidungen, wenn mehrere Teilnehmende gleichzeitig verbunden sind. Nur ein Client berechnet Metriken, inferiert Zustände und evaluiert die Interventionspolitik zu jedem Zeitpunkt. Wenn der Decision Owner die Verbindung trennt oder aufhört Heartbeat-Signale zu senden, wird die Führung automatisch an einen anderen verbundenen Teilnehmenden übertragen.

Die Decision-Schleife wird alle zwei Sekunden ausgeführt. Sie liest die aktuellen Metriken, den inferierten Gesprächszustand und die aktuelle Phase des Interventionszyklus. Basierend auf diesen Eingaben bestimmt die Policy Engine, ob ein Phasenübergang stattfinden und ob eine Intervention generiert werden sollte.

Wenn eine Intervention gerechtfertigt ist, konstruiert das System einen Prompt, der den aktuellen Gesprächszustand, relevante Metrikwerte und eine Auswahl jüngster Transkriptsegmente als Kontext enthält. Dieser Prompt wird an einen serverseitigen API-Endpunkt gesendet, der ihn an ein grosses Sprachmodell weiterleitet.

Die Modellauswahl folgt einer aufgabenspezifischen Routing-Konfiguration. Moderationsprompts erfordern Neutralität und Klarheit. Ally-Prompts profitieren von höherer Variabilität und kreativer Divergenz. Einbettungsberechnungen verlangen repräsentationale Konsistenz. Die Routing-Konfiguration spezifiziert Modellbezeichner, Temperatureinstellungen, Token-Limits und Fallback-Ketten für jede Aufgabenkategorie. Als letzter Ausweg wählt das System aus einem Pool vorgeschriebener statischer Interventionen, um sicherzustellen, dass die Gruppe immer eine Antwort erhält, selbst unter degradierten Bedingungen.

Das System führt auch periodische Prüfungen gegen Osborns Brainstorming-Regeln durch. Jüngste Transkriptsegmente werden auf Anzeichen vorzeitiger Kritik, Ideenabweisung oder konformitätsgetriebener Selbstzensur evaluiert. Wird ein Regelverstoss erkannt, kann er in Kombination mit der nächsten metrikgetriggerten Intervention oder als eigenständiger Prompt behandelt werden.

### 6.3.4. Interface-Design und Transparenz

Die Benutzeroberfläche hält die KI visuell peripher. Die Videokonferenzansicht belegt den zentralen Bildschirmbereich. Die Interface-Komponenten der KI erscheinen in einem grössenverstellbaren Seitenpanel.

Dieses Panel ist in mehrere Tab-Ansichten organisiert. Eine Chat-Ansicht zeigt den chronologischen Feed aller Interventionen mit Zeitstempeln, Rollenlabels und Intent-Klassifikationen. Eine Transkript-Ansicht zeigt den Live-Transkriptionsstrom mit Sprecheridentifikation und Wortanzahl. Eine Analyse-Ansicht präsentiert die aktuellen Metrikwerte, Zustandsinferenz-Ergebnisse und Konfidenzverteilungen. Eine Tuning-Ansicht — nur für die das Experiment durchführende Forschungsperson zugänglich — ermöglicht die Live-Anpassung von Schwellenwerten, Bestätigungsdauern und Abkühlintervallen ohne Neustart der Sitzung.

Jede Intervention wird explizit gemäss ihrer Rolle gekennzeichnet. Teilnehmende können auf einen Blick unterscheiden, ob das System strukturelle Dynamiken als Moderator reflektiert oder einen kreativen Stimulus als Ally einführt.

## 6.4. Experimentelle Konfiguration und Operationalisierung

### 6.4.1. Szenariokonfiguration

Der Prototyp unterstützt drei experimentelle Konfigurationen, die direkt den in Kapitel 4 entwickelten Szenarien entsprechen.

| Szenario | KI-Rolle | Interventionsumfang | Zweck |
|---|---|---|---|
| Baseline | Keine aktive KI | Keiner | Referenzbedingung |
| Szenario A | Prozessmoderation | Nur strukturelles Feedback | Stabilisierung |
| Szenario B | Moderation + Ally | Strukturell + inhaltlicher Impuls | Reaktivierung |

**Konstante Parameter**

Um Vergleichbarkeit zu gewährleisten, bleiben mehrere Parameter über alle Szenarien hinweg identisch: Gruppengrösse, Brainstorming-Aufgabe, Sitzungsdauer, die Länge des gleitenden Analysefensters, alle Schwellenwertdefinitionen, Abkühlintervalle und die Metrikberechnungsstrategie.

**Variable Parameter**

Die einzige systematische Variation betrifft die Aktivierung der Moderationsschicht, die Aktivierung der Ally-Eskalationsfunktion und den Typ des generierten Prompts. Die analytische Schicht bleibt in allen Bedingungen aktiv.

### 6.4.2. Operationalisierung der Brainstorming-Dynamiken

Abstrakte gruppendynamische Konzepte müssen in messbare Systemzustände übersetzt werden, bevor sie Interventionsentscheidungen informieren können.

**Partizipationsungleichgewicht**

Das Partizipationsungleichgewicht wird durch mehrere komplementäre Masse quantifiziert. Der Hoover-Index erfasst die Ungleichheit in der Redezeitverteilung als Wert zwischen null und eins, wobei null perfekte Gleichheit und eins vollständige Konzentration auf einen einzelnen Sprecher repräsentiert. Ein Anteil stiller Teilnehmender berücksichtigt Gruppenmitglieder, die innerhalb des aktuellen Analysefensters nicht beigetragen haben. Eine Dominanz-Streak-Metrik misst die längste aufeinanderfolgende Sequenz von Redebeiträgen eines einzelnen Sprechers, normalisiert nach der Gesamtsegmentanzahl und angepasst für die Gruppengrösse. Eine kumulative Partizipationsungleichheit berechnet den Hoover-Index über ein längeres Zeitfenster, um langanhaltende Ungleichgewichte zu erkennen, die in kurzen Fenstern nicht sichtbar werden. Diese Einzelmasse fliessen in einen zusammengesetzten Partizipationsrisiko-Score mit konfigurierbaren Gewichten ein.

**Thematische Konvergenz**

Thematische Konvergenz wird durch einbettungsbasierte Ähnlichkeitsanalyse approximiert. Jeder Beitrag wird in eine hochdimensionale Vektorrepräsentation transformiert. Eine Neuheitsrate erfasst den Anteil jüngster Beiträge, deren maximale Ähnlichkeit zu allen vorherigen Beiträgen unter einem definierten Schwellenwert liegt — mit anderen Worten, Beiträge, die genuines neues thematisches Material einführen. Eine Cluster-Konzentrationsmetrik wendet gieriges zentroidbasiertes Clustering auf den Einbettungsraum an und berechnet einen normalisierten Konzentrationsindex (normalisierter Herfindahl-Hirschman-Index). Hohe Konzentration zeigt an, dass die Ideen der Gruppe um eine enge Menge von Themen clustern.

**Stagnation**

Stagnation wird als das Fehlen neuer semantischer Cluster innerhalb eines spezifizierten Zeitrahmens definiert. Das System verfolgt, wie viele Sekunden seit dem letzten Beitrag vergangen sind, der gemäss dem einbettungsbasierten Schwellenwert als neuartig qualifiziert wurde.

**Diversitätsentwicklung**

Anstatt absolute Diversität zu einem einzelnen Zeitpunkt zu messen, verfolgt das System, wie sich die Diversität im Zeitverlauf verändert. Ein semantischer Expansionsscore vergleicht aktuelle Konzentrations- und Neuheitswerte mit einer rollierenden Historie jüngster Metrik-Snapshots. Anhaltende Kontraktion — sinkende Neuheit kombiniert mit steigender Konzentration — signalisiert, dass der thematische Suchraum der Gruppe sich verengt.

**Ideenflüssigkeit**

Die Ideational Fluency Rate misst substantive Beiträge pro Minute. Ein Absinken der Fluenz ist ein starkes Signal für eine stagnierte Diskussion. Nur Beiträge mit mehr als zwei Wörtern werden gezählt; Backchannels wie «ja», «mhm» oder «genau» werden herausgefiltert.

**Aufbauverhalten (Piggybacking)**

Der Piggybacking-Score misst die semantische Ähnlichkeit zwischen aufeinanderfolgenden Sprecherwechseln. Ein hoher Score bedeutet, dass Sprechende auf den Ideen anderer aufbauen. Ein niedriger Score deutet darauf hin, dass Sprechende einander ignorieren und parallele Monologe führen.

### 6.4.3. Schwellenwert- und Persistenzlogik

Eine einzelne Metrikabweichung löst keine Intervention aus. Drei Kriterien müssen gleichzeitig erfüllt sein:

1. Eine relevante Metrik überschreitet einen vordefinierten Schwellenwert.
2. Die Abweichung besteht über ein definiertes Bestätigungsfenster.
3. Das Abkühlintervall seit der letzten Intervention ist abgelaufen.

Dieser dreistufige Mechanismus stellt sicher, dass vorübergehende Schwankungen — die in jeder Konversation normal sind — nicht zu unnötigen Interventionen führen.

### 6.4.4. Eskalationskonfiguration

In Szenario A ist nur Prozessstabilisierung erlaubt. Die Ally-Funktion bleibt inaktiv.

In Szenario B ist Eskalation unter folgender Bedingung aktiviert: Wenn eine Moderationsintervention innerhalb des Post-Check-Beobachtungsintervalls keine messbare Verbesserung bewirkt, wird die Ally-Funktion im nächsten Zyklus aktiv. Die Ally-Intervention ist auf einen einzelnen Impuls pro Eskalationszyklus begrenzt.

Der Ermüdungsmechanismus greift auch hier. Jede konsekutive erfolglose Intervention verlängert sowohl das Bestätigungsfenster als auch die Abkühlungsdauer. Nach zwei aufeinanderfolgenden Misserfolgen verdoppelt das System effektiv seine Wartezeiten.

### 6.4.5. Experimentelle Kontrollierbarkeit

Die experimentelle Konfiguration gewährleistet kontrollierte Variation der KI-Rolle unter identischen strukturellen Bedingungen. Alle operationalen Definitionen sind transparent und reproduzierbar. Die Live-Tuning-Fähigkeit beschleunigt den Kalibrierungsprozess, indem sie der Forschungsperson ermöglicht, die Effekte von Parameteränderungen während Pilotierungssitzungen zu beobachten, ohne die Codebasis zu modifizieren oder die Anwendung neu zu starten.

## 6.5. Deployment-Kontext

Der Prototyp operiert ausschliesslich in einer virtuellen, browserbasierten Umgebung. Alle Teilnehmenden treten von ihren eigenen Geräten über einen Standard-Webbrowser bei und verbinden sich mit einem gemeinsamen Videoraum. Es besteht keine Anforderung an physische Ko-Lokation.

Dies war kein Kompromiss, sondern eine bewusste methodische Entscheidung. Ein virtuelles Deployment bietet spezifische Vorteile für die in dieser Arbeit adressierten Forschungsfragen. Die Audioqualität ist konsistent, da das Mikrofon jedes Teilnehmenden den Input direkt über den Browser erfasst, frei von Raumakustik, Übersprechen oder Umgebungsgeräuschen. Die Sprecherzuordnung ist exakt, da individuelle Audiospuren auf Infrastrukturebene isoliert werden, anstatt durch nachträgliche Diarisierung getrennt zu werden.

Die kontrollierte technische Umgebung reduziert auch Störvariablen. In einem ko-lokalisierten Setting führen nonverbale Kommunikation, physische Nähe und räumliche Dynamiken zusätzliche Schichten sozialer Interaktion ein, die der Prototyp nicht beobachten oder berücksichtigen kann.

Gleichzeitig führt das rein virtuelle Deployment Einschränkungen ein, die anerkannt werden müssen. Informelles Brainstorming in ko-lokalisierten Umgebungen beinhaltet soziale Dynamiken, die sich von denen in Online-Videoanrufen unterscheiden. Befunde, die in diesem Kontext gewonnen werden, gelten daher primär für virtuelle Brainstorming-Situationen.

Die Entscheidung für eine rein virtuelle Umgebung spiegelt einen bewussten methodischen Kompromiss wider: Maximierung der internen Validität und Messpräzision auf Kosten ökologischer Breite. Für einen explorativen Prototyp, dessen primärer Zweck darin besteht zu testen, ob KI-basierte Moderation Brainstorming-Dynamiken messbar beeinflussen kann, ist dieser Kompromiss angemessen.

## 6.6. Forschungsdaten-Pipeline

Ein Merkmal, das diesen Prototyp von einem rein funktionalen Werkzeug unterscheidet, ist seine Ausrichtung auf systematische Datenerhebung. Jede experimentelle Sitzung produziert einen umfassenden Datensatz, der die vollständige Trajektorie des Brainstorming-Prozesses erfasst — von der Rohsprache bis zu den Interventionsergebnissen.

Die Datenpipeline operiert auf mehreren Ebenen. Auf der Transkriptebene wird jedes finalisierte Segment mit Sprecheridentität, Zeitstempel und Textinhalt gespeichert. Auf der Metrikebene werden Snapshots in regelmässigen Intervallen persistiert, die jeweils den vollständigen Satz an Partizipationsmetriken, semantischen Dynamikmetriken und den inferierten Gesprächszustand mit Konfidenzwerten für alle fünf Zustände enthalten. Auf der Interventionsebene wird jeder generierte Prompt mit seinem auslösenden Zustand, der Intent-Klassifikation, dem verwendeten Modell, der Antwortlatenz und — nach der Post-Check-Phase — einem Recovery-Ergebnis aufgezeichnet.

Der interne Zustand der Decision Engine wird als kontinuierliches Protokoll verfolgt. Phasenübergänge, Bestätigungsergebnisse, Abkühlungseintritte und Ermüdungsanpassungen werden alle mit Zeitstempeln aufgezeichnet.

Am Ende jeder Sitzung aggregiert ein strukturierter Export alle Datenebenen in einen einzelnen Datensatz. Zusammenfassende Statistiken — wie die Verteilung der in jedem Gesprächszustand verbrachten Zeit, durchschnittliche Recovery-Raten pro Interventions-Intent und Gesamtzahl der Zustandsübergänge — werden automatisch als Teil des Exports berechnet.

## 6.7. Technische und experimentelle Limitationen

Der Prototyp operiert unter mehreren bewussten Einschränkungen, die bei der Interpretation von Befunden anerkannt werden müssen.

Die Redezeit wird durch Transkriptlänge und erkannte Sprechersegmente approximiert statt durch akustische Signalanalyse. Diese Approximation erfasst relative Unterschiede in der Beteiligung, entspricht aber nicht perfekt der tatsächlichen Sprechdauer. Kurze bestätigende Einwürfe werden erkannt und separat gefiltert, um Verzerrungen der Partizipationsmetriken zu vermeiden.

Die Transkriptionsgenauigkeit hängt von Mikrofonqualität, Internetbandbreite und den Spracheigenschaften jedes Teilnehmenden ab. Akzente, schnelles Sprechen oder domänenspezifische Terminologie können die Erkennungsgenauigkeit reduzieren.

Einbettungsbasierte semantische Ähnlichkeit liefert eine nützliche Approximation thematischer Konvergenz, kann aber tiefere argumentative Strukturen, Ironie, implizite Referenzen oder die pragmatische Funktion eines Beitrags innerhalb der breiteren Diskussion nicht erfassen.

Das System analysiert strukturelle Trends statt individueller Intentionen. Es kann weder Motivation noch emotionale Zustände noch die subjektive Erfahrung der Teilnehmenden inferieren. Ein stiller Teilnehmender mag desengagiert sein oder aufmerksam zuhören und auf den richtigen Moment zum Sprechen warten. Das System kann zwischen diesen Möglichkeiten nicht unterscheiden.

Die Zustandsinferenz stützt sich auf gewichtete Heuristiken mit konfigurierbaren Schwellenwerten. Diese Schwellenwerte wurden durch iteratives Pilottesting kalibriert, bleiben aber Approximationen.

Kein persistentes Gedächtnis über Sitzungen hinweg ist implementiert. Jede Brainstorming-Sitzung wird als unabhängige experimentelle Einheit behandelt.

Das System benötigt stabile Internetverbindung und Zugang zu externen API-Diensten während der Sitzungen. Eine Netzwerkunterbrechung kann vorübergehend Transkription, Metrikberechnung oder Interventionsgenerierung deaktivieren. Während Fallback-Mechanismen die Auswirkungen kurzer Ausfälle mildern, machen anhaltende Konnektivitätsverluste die analytischen Komponenten funktionsunfähig.

## 6.8. Kapitelzusammenfassung und Überleitung

Dieses Kapitel beschrieb den Prototyp als integriertes experimentelles System. Ausgehend vom in Abschnitt 6.1 etablierten konzeptionellen Rahmen detaillierte es die funktionale Architektur und ihre sechs Schichten, die Interventionslogik mit fünf Gesprächszuständen und einem vierphasigen Eskalationszyklus, die technische Implementierung über clientseitige Echtzeit-Verarbeitung und serverseitige Sprachmodell-Integration, die experimentelle Konfiguration mit drei vergleichbaren Szenarien und den Deployment-Kontext.

Das System operationalisiert theoretische Konstrukte — Partizipationsungleichgewicht, thematische Verengung, Stagnation — durch messbare Proxy-Indikatoren. Es implementiert ein zustandsbasiertes Interventionsmodell, das einer graduellen Eskalationslogik folgt und gleichzeitig das Prinzip der minimalen Invasivität wahrt. Eine Forschungsdaten-Pipeline stellt sicher, dass jede Sitzung einen strukturierten Datensatz produziert, der für systematische Evaluation geeignet ist.

Ein Bekenntnis zieht sich durch jede architektonische Entscheidung, die in diesem Kapitel beschrieben wurde: Die KI bleibt eine unterstützende Präsenz, niemals eine dominante. Die kreative Verantwortung bleibt bei der Gruppe. Technische Entscheidungen — von der Pro-Teilnehmer-Audioisolation bis zur Dual-Sync-Strategie, von ermüdungsangepassten Abkühlphasen bis zur expliziten Rollenkennzeichnung — dienen konsequent diesem Bekenntnis.

Mit dem technischen und operationalen Fundament etabliert, verlagert das nächste Kapitel den Fokus vom Systemdesign zur empirischen Evaluation.

\newpage

# 7. Ergebnisse

*[Dieses Kapitel wird nach Durchführung der Experimente verfasst und enthält die quantitativen und qualitativen Ergebnisse der Studie.]*

\newpage

# 8. Diskussion

*[Dieses Kapitel wird nach der Ergebnisdarstellung verfasst und enthält die Interpretation und Einordnung der Befunde.]*

\newpage

# 9. Fazit

*[Dieses Kapitel fasst die zentralen Erkenntnisse zusammen und gibt einen Ausblick auf zukünftige Forschung.]*

\newpage

# 10. Literaturverzeichnis

Anderson, C. & Kilduff, G. J. (2009). Why Do Dominant Personalities Attain Influence in Face-to-Face Groups? The Competence-Signaling Effects of Trait Dominance. *Journal of Personality and Social Psychology*, 96(2), 491–503.

Carroll, J. M. (2000). *Making Use: Scenario-Based Design of Human-Computer Interactions*. MIT Press.

Chiang, W.-L. et al. (2024). Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference. *arXiv preprint arXiv:2403.04132*.

Collaros, P. A. & Anderson, L. R. (1969). Effect of perceived expertness upon creativity of members of brainstorming groups. *Journal of Applied Psychology*, 53(2), 159–163.

Diehl, M. & Stroebe, W. (1987). Productivity loss in brainstorming groups: Toward the solution of a riddle. *Journal of Personality and Social Psychology*, 53(3), 497–509.

Henriques, G. (2020). The Problem of Group Creativity. *Psychology Today*.

Johnson, D. et al. (2025). AI as a Collaborative Partner in Group Decision-Making. *Proceedings of the ACM Conference on Computer-Supported Cooperative Work*.

Latané, B., Williams, K. & Harkins, S. (1979). Many hands make light the work: The causes and consequences of social loafing. *Journal of Personality and Social Psychology*, 37(6), 822–832.

Maurya, A. et al. (2025). SelectLLM: Query-Aware Efficient Selection Mechanism for Large Language Models. *arXiv preprint*.

Ni, J. et al. (2025). Rethinking Benchmark Design for LLM Evaluation: Contamination, Distribution, and Transferability. *arXiv preprint*.

Offner, A. K., Kramer, T. J. & Winter, J. P. (1996). The effects of facilitation, recording, and pauses on group brainstorming. *Small Group Research*, 27(2), 283–298.

Osborn, A. F. (1963). *Applied Imagination: Principles and Procedures of Creative Problem-Solving* (3rd ed.). Scribner.

Oxley, N. L., Dzindolet, M. T. & Paulus, P. B. (1996). The effects of facilitators on the performance of brainstorming groups. *Journal of Social Behavior and Personality*, 11(4), 633–646.

Rickards, T. (1999). Brainstorming. In M. A. Runco & S. R. Pritzker (Eds.), *Encyclopedia of Creativity* (Vol. 1, pp. 219–227). Academic Press.

Singh, A. et al. (2025). The Leaderboard Illusion: Structural Asymmetries in LLM Evaluation Platforms. *arXiv preprint*.

Specker, E. et al. (2025). AI Agents as Brainstorming Partners: Enhancing Group Creativity through Autonomous Participation. *arXiv preprint*.

\newpage

# 11. Anhang

*[Anhang wird bei Bedarf ergänzt — z.B. Fragebogen, Konfigurationsparameter, Screenshots, vollständige Metrik-Definitionen.]*
