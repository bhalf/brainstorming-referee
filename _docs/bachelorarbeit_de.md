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

Methodisch orientiert sich diese Arbeit am szenariobasierten Designansatz nach Carroll (2000). Dessen Grundidee: Statt von technischen Spezifikationen auszugehen, entwickelt man zuerst konkrete Nutzungssituationen — typische Abläufe, Probleme, Handlungsmuster —, die dann als Leitplanken für den Systementwurf dienen. Gerade bei interaktiven Systemen, wo das Wechselspiel zwischen Mensch und Technologie im Mittelpunkt steht, hat sich dieser Zugang bewährt.

Konkret sah das in dieser Arbeit so aus: Kapitel 3 legte die theoretischen Grundlagen offen — kognitive, soziale und gruppendynamische Barrieren des Brainstormings. Aus diesen Erkenntnissen entstanden in Kapitel 4 drei Szenarien: ein Problemszenario, das die üblichen Dynamiken informeller Sitzungen abbildet, sowie zwei Interventionsszenarien mit jeweils unterschiedlicher KI-Rolle. Der Prototyp in Kapitel 6 wurde direkt daraus abgeleitet, jede Entwurfsentscheidung lässt sich auf ein bestimmtes theoretisches Konstrukt oder eine im Szenario identifizierte Problemdynamik zurückführen.

Warum dieser Ansatz? Weil er technische Entscheidungen an reale Nutzungssituationen bindet. Weil er eine nachvollziehbare Kette schafft — vom theoretischen Problem über das Szenario bis zur technischen Umsetzung. Und weil er die modulare Struktur des Systems stützt, da verschiedene Szenarien verschiedene Konfigurationen verlangen.

## 5.2. Evaluationsdesign

Der szenariobasierte Ansatz strukturiert den Systementwurf. Für die empirische Prüfung braucht es etwas anderes: ein experimentelles Design. Die Kernfrage ist simpel formuliert, aber alles andere als trivial zu beantworten — verändert KI-basierte Moderation den Verlauf und die Wahrnehmung informeller Brainstorming-Sitzungen tatsächlich messbar?

Gewählt wurde ein Within-Subject-Design, also ein Messwiederholungsansatz. Jede Gruppe durchläuft zwei Brainstorming-Sitzungen unter verschiedenen Bedingungen: einmal ohne KI-Intervention (Baseline), einmal mit KI-gestützter Moderation und Ally-Unterstützung. Der Vorteil liegt auf der Hand — individuelle Unterschiede in Kreativität, Kommunikationsstil oder Gruppendynamik fallen als Störfaktoren weitgehend weg, weil jede Gruppe quasi als ihre eigene Kontrollgruppe dient.

Natürlich birgt ein solches Design Risiken. Lerneffekte, Ermüdung, unterschiedliche Vertrautheit mit den Themen — all das könnte die Ergebnisse verzerren. Um dem entgegenzuwirken, wurden die zehn Gruppen fortlaufend nummeriert und einem alternierenden Schema zugewiesen: Ungerade Gruppen (1, 3, 5, 7, 9) starteten ihre erste Sitzung mit KI-Intervention, die zweite ohne. Bei den geraden Gruppen (2, 4, 6, 8, 10) war es umgekehrt. So lässt sich kontrollieren, ob beobachtete Unterschiede wirklich auf die experimentelle Bedingung zurückgehen — oder bloss auf die Reihenfolge.

## 5.3. Teilnehmende und Gruppenbildung

Insgesamt nahmen 30 Personen teil, aufgeteilt in zehn Dreiergruppen. Drei Personen pro Gruppe — das ist klein genug, damit alle wirklich zu Wort kommen und soziales Faulenzen weniger Spielraum hat. Gleichzeitig reicht die Grösse aus, um genau jene interpersonellen Dynamiken hervorzurufen, die das System erkennen soll: Dominanz, Konformitätsdruck, thematische Verengung. Durch die zehn Gruppen ergeben sich je fünf pro Ausbalancierungsreihenfolge, was eine solide Vergleichsbasis schafft.

Rekrutiert wurden die Teilnehmenden aus dem universitären Umfeld. Sie erhielten vorab eine kurze Einführung in die Brainstorming-Aufgabe, erfuhren aber nichts über die genaue KI-Logik oder die getesteten Hypothesen — ein bewusster Schritt, um Demand-Charakteristiken möglichst gering zu halten.

## 5.4. Experimenteller Ablauf

Jeder Durchlauf folgte demselben Muster, das sich in sechs Phasen gliedert.

Zuerst das Briefing. Die Teilnehmenden bekamen eine Einführung ins Format und die Brainstorming-Regeln: keine Kritik, Quantität vor Qualität, fremde Ideen aufgreifen und weiterdenken. Sie wussten, dass die Sitzung aufgezeichnet wird und ein KI-System dabei sein kann — die genaue Interventionslogik blieb ihnen aber verborgen.

Dann die erste Brainstorming-Sitzung, 15 bis 20 Minuten lang. Das Thema: *«Welche konkreten Massnahmen können Uni und Studierendenschaft ergreifen, um die Prüfungsphase für alle einfacher, klarer und unterstützender zu machen?»* Je nach Gruppenzuordnung lief diese Runde mit oder ohne KI-Unterstützung.

Direkt im Anschluss füllten die Teilnehmenden individuell den ersten Teil einer quantitativen Online-Umfrage aus. Erfasst wurde die subjektive Erfahrung der gerade beendeten Sitzung — wie ausgewogen die Beteiligung empfunden wurde, wie vielfältig die Ideen, wie zufrieden man insgesamt war. In der Interventionsbedingung kamen Fragen zur wahrgenommenen Nützlichkeit und Aufdringlichkeit des KI-Systems hinzu.

Es folgte die zweite Brainstorming-Sitzung, wieder 15 bis 20 Minuten. Diesmal ein anderes Thema: *«Welche konkreten Massnahmen können Uni und Studierendenschaft ergreifen, um den Start ins Studium für alle einfacher, klarer und unterstützender zu machen?»* Die Bedingung war jeweils die entgegengesetzte — wer in der ersten Runde mit KI brainstormte, tat es nun ohne, und umgekehrt.

Danach der zweite Teil der Umfrage, strukturell identisch zum ersten, nur eben bezogen auf die zweite Sitzung. Der direkte Vergleich war damit angelegt.

Den Abschluss bildeten qualitative Einzelinterviews von etwa 15 Minuten pro Person. Hier ging es darum, hinter die Zahlen zu blicken. Wie hatten die Teilnehmenden die beiden Sitzungen erlebt? Was fiel ihnen an den KI-Interventionen auf? Wo sahen sie Unterschiede? Solche Nuancen lassen sich mit einem Fragebogen allein nicht einfangen.

Beide Brainstorming-Themen wurden gezielt so gewählt, dass sie für Studierende gleichermassen greifbar, alltagsnah und in ihrer Offenheit vergleichbar sind. Welche Sitzung mit Intervention lief und welche ohne, bestimmte das in Abschnitt 5.2 beschriebene alternierende Schema.

## 5.5. Unabhängige und abhängige Variablen

Die unabhängige Variable ist denkbar klar: ob KI-basierte Moderation vorhanden war oder nicht.

Gemessen wurde auf zwei Ebenen. Einerseits über automatisch erfasste Prozessmetriken — der Hoover-Index für die Redezeitverteilung, der Anteil stiller Teilnehmender, ein Dominanz-Streak-Score und die kumulative Partizipationsungleichheit geben Aufschluss über die Beteiligungsbalance. Thematische Vielfalt wird über die Neuheitsrate, die Cluster-Konzentration (normalisierter HHI) und das Explorations-Elaborations-Verhältnis abgebildet. Hinzu kommen die Zeitanteile in den fünf inferierten Gesprächszuständen, die Anzahl der Zustandswechsel, die Dauer ohne substanziell neue Beiträge (Stagnation), eine Ideational Fluency Rate sowie ein Piggybacking-Score, der misst, inwieweit Sprechende aufeinander aufbauen.

Andererseits flossen subjektive Einschätzungen aus den Fragebögen ein: wahrgenommene Ideenvielfalt, wahrgenommene Fairness der Beteiligung, Gesamtzufriedenheit mit dem Prozess — und bei den Interventionssitzungen zusätzlich die eingeschätzte Nützlichkeit und Aufdringlichkeit der KI.

## 5.6. Analysestrategie

Bei zehn Gruppen wäre es gewagt, parametrische Verfahren mit ihren Normalverteilungsannahmen einzusetzen. Stattdessen kommt primär der Wilcoxon-Vorzeichen-Rang-Test zum Einsatz, der mit kleinen Stichproben robuster arbeitet und keine Verteilungsannahmen voraussetzt.

Verglichen werden vor allem der mittlere Hoover-Index zwischen den Bedingungen, Neuheitsrate und Cluster-Konzentration, der Anteil der Sitzungszeit in Risikozuständen gegenüber gesunden Phasen sowie die Recovery-Rate — also der Anteil der Interventionen, nach denen sich die Metriken innerhalb des Beobachtungsfensters tatsächlich verbesserten. Ob Reihenfolgeeffekte eine Rolle spielen, wird geprüft, indem die Erstrundenleistung der Gruppen mit Baseline-Start jener der Gruppen gegenübergestellt wird, die mit Intervention begannen.

Die Fragebogendaten werden deskriptiv ausgewertet und zwischen den Bedingungen verglichen. Für die qualitativen Interviews kommt eine inhaltsanalytische Auswertung zum Einsatz — sie sollen die Zahlen einordnen, erklären und dort vertiefen, wo Fragebögen an ihre Grenzen stossen.

## 5.7. Ethische Aspekte

Vor dem Experiment gaben alle Teilnehmenden eine informierte Einwilligung ab. Sie wussten, dass aufgezeichnet wird und dass ein KI-System anwesend sein kann. Niemand musste mitmachen, jederzeit war ein Abbruch ohne Konsequenzen möglich. Sämtliche Audio-, Transkript- und Interviewdaten werden sicher gespeichert und für die Analyse pseudonymisiert.

\newpage

# 6. Prototyp

## 6.1. Ziele und konzeptioneller Rahmen

Was genau wurde hier eigentlich gebaut — und was nicht?

Der Prototyp überführt die Szenarien aus Kapitel 4 in ein funktionierendes System. Kein fertiges Produkt, keine Plattform mit Ambitionen auf Skalierbarkeit oder kommerzielle Nutzung. Eher ein experimentelles Setup, das einen klar umgrenzten Zweck erfüllt: verschiedene KI-Rollen unter kontrollierten Bedingungen aktivieren, beobachten und vergleichen. Interface-Komplexität, Zusatzfunktionen, alles was vom eigentlichen Untersuchungsgegenstand ablenken könnte — bewusst weggelassen. Gerade diese Reduktion macht den Prototyp nützlich. Unterschiede zwischen den Szenarien treten schärfer hervor, wenn das Drumherum nicht stört.

### 6.1.1. Prozessunterstützung statt Ideenersetzung

Eine Entscheidung fiel früh und blieb bestehen: Die KI sollte keine Ideen liefern. Sprachmodelle können das mittlerweile, keine Frage — kreative Vorschläge formulieren, Zusammenhänge sprachlich aufbereiten. Aber genau das hätte den Schwerpunkt der Arbeit verschoben. Es geht hier nicht darum zu belegen, dass Maschinen kreativer denken als Menschen.

Was stattdessen interessiert: Wie verändert sich der Gruppenprozess, wenn KI strukturell eingreift? Kreativität in Gruppen lebt von Interaktion. Ideen werden aufgegriffen, gedreht, weitergesponnen, manchmal verworfen. Diese Dynamik kann kippen, sobald ein System dominante inhaltliche Beiträge beisteuert — die Gefahr, dass sich die Gruppe an maschinellen Vorschlägen orientiert oder sie ungeprüft übernimmt, ist real. Dann untersucht man plötzlich nicht mehr den Prozess, sondern die Qualität der KI-Outputs.

Der Prototyp wurde deshalb so angelegt, dass die KI zuerst auf der Prozessebene agiert: beobachten, Muster erkennen, moderierend eingreifen. Nur im erweiterten Szenario kommt eine inhaltliche Impulsfunktion dazu — kontrolliert und situativ. Die kreative Verantwortung? Bleibt bei der Gruppe.

### 6.1.2. Theoretische Anbindung

Konzeptionell dockt der Prototyp direkt an die Problemdynamiken aus Kapitel 4 an: ungleiche Beteiligung, inhaltliche Verengung, Stagnation, implizite Konformität. Diese Effekte kommen selten einzeln daher. Sie schaukeln sich gegenseitig hoch und verengen den Ideenraum schrittweise — oft ohne dass die Gruppe es überhaupt bemerkt.

Das System sollte deshalb nicht ein isoliertes Problem lösen, sondern mehrere Ebenen gleichzeitig adressieren. Gesprächsverläufe strukturell erfassen, wiederkehrende Muster annäherungsweise erkennen, zwischen verschiedenen Interventionsarten unterscheiden. Natürlich stösst die automatische Erkennung solcher Dynamiken an Grenzen. Eine vollständige Diskursanalyse leistet der Prototyp nicht. Er arbeitet mit operationalisierten Indikatoren — relative Redezeit, semantische Ähnlichkeit zwischen Beiträgen. Annäherungen, ja. Aber hinreichend genau, um Muster sichtbar zu machen und darauf zu reagieren.

### 6.1.3. Szenariobasierte Struktur

Das System ist modular aufgebaut. Statt eines starren KI-Verhaltens lassen sich verschiedene Interventionsmodi ein- und ausschalten, woraus drei klar getrennte Konfigurationen entstehen.

| Szenario | KI-Rolle | Interventionsgrad | Funktion |
|---|---|---|---|
| Baseline | Keine aktive KI | 0% | Referenzbedingung |
| Szenario A | Prozessmoderation | Niedrig | Stabilisierung |
| Szenario B | Moderation + Ally | Mittel | Reaktivierung |

Gruppengrösse, Aufgabe, Dauer — alles bleibt gleich. Nur die Rolle der KI ändert sich. So wird sichtbar, ob und wie sich die Prozessdynamiken verschieben.

### 6.1.4. Leitende Designprinzipien

Vier Prinzipien haben die Entwicklung durchgehend geprägt.

**Minimale Invasivität** — die KI greift nur ein, wenn es prozedural nötig erscheint. Permanente Aktivität würde sie selbst zur dominanten Instanz machen und neue Störfaktoren erzeugen. **Transparenz** — jederzeit erkennbar, welche Rolle die KI gerade einnimmt, ob Moderation oder inhaltlicher Impuls. Das senkt Unsicherheit und stärkt Vertrauen. **Modularität** — Analyse- und Generierungskomponenten sind getrennt, was erlaubt, je nach Aufgabe unterschiedliche Sprachmodelle einzusetzen. Und schliesslich **theoretische Fundierung** — keine technische Entscheidung ohne Bezug zu den identifizierten Problemdynamiken.

### 6.1.5. Einordnung im Kontext aktueller KI-Forschung und Modellevaluation

Die Diskussion um grosse Sprachmodelle hat sich in den letzten Jahren spürbar verschoben. Nicht nur die Modelle selbst sind leistungsfähiger geworden — auch die Frage, wie man ihre Leistung überhaupt misst, ist komplizierter geworden. Frühere Benchmarks hatten es leichter: Klassifikation, Übersetzung, Fragebeantwortung. Klare Inputs, klare Outputs. Heute geht es zunehmend um offene Interaktion, Dialog, kontextuelles Schlussfolgern — und sobald Modelle in solche weniger strukturierten Settings wechseln, wird der Vergleich schwieriger. Ni et al. (2025) beschreiben treffend, womit moderne Benchmark-Ökosysteme kämpfen: Kontaminationseffekte, Verteilungsverschiebungen, begrenzte Übertragbarkeit auf reale Anwendungen. Was auf dem Papier überzeugt, muss in der Praxis noch lange nicht funktionieren.

Chatbot Arena (Chiang et al., 2024) steht exemplarisch für einen neueren Evaluationsansatz. Statt statischer Datensätze treten Modelle in anonymen paarweisen Vergleichen gegeneinander an, und echte Nutzende entscheiden, welche Antwort überzeugender wirkt. Erfrischend pragmatisch. Was zählt, ist nicht bloss technische Korrektheit, sondern ob eine Antwort hilfreich, verständlich, kohärent rüberkommt. Allerdings hängen die Ergebnisse stark vom Kontext ab — Prompt-Typen, Nutzerbasis, Interaktionsumgebung beeinflussen alles. Ein Modell, das bei kreativen Gesprächen glänzt, kann bei strukturierten Analyseaufgaben ganz anders abschneiden. Rankings aus solchen Plattformen sind daher keine objektiven Wahrheiten, sondern Momentaufnahmen eines spezifischen Setups.

Singh et al. (2025) gehen in *The Leaderboard Illusion* noch weiter. Ihre Analyse offenbart, dass Leaderboard-Systeme alles andere als neutrale Messinstrumente sind. Anbieter evaluieren intern mehrere Modellvarianten und reichen nur die stärkste öffentlich ein — das Ranking bildet also eine gefilterte Sicht ab. Proprietäre Modelle können innerhalb der Arena höhere Sampling-Raten erhalten, was ihnen mehr Evaluationsdaten verschafft und langfristig den Wettbewerb verzerrt. Die Anreize driften Richtung Arena-Overfitting statt Richtung Robustheit.

Ni et al. (2025) identifizieren darüber hinaus allgemeinere Schwächen im Benchmark-Design. Datenkontamination bleibt ein hartnäckiges Problem, Benchmark-Overfitting lässt sich kaum restlos ausschliessen. Und starke Benchmark-Scores übersetzen sich nicht automatisch in zuverlässiges Verhalten innerhalb komplexer, interaktiver Systeme.

Für den vorliegenden Prototyp sind das keine abstrakten Überlegungen. Dieses System soll nicht einfach polierten Text produzieren. Es muss Gesprächsverläufe analysieren, strukturelle Muster erkennen, behutsam moderierend eingreifen — und unter bestimmten Bedingungen gezielte inhaltliche Impulse setzen. Das sind grundverschiedene Aufgaben. Ein Modell, das kreatives Schreiben beherrscht, eignet sich nicht zwingend für zurückhaltende Prozessmoderation. Eines, das in präferenzbasierten Dialogvergleichen punktet, kann bei wiederholten analytischen Bewertungen schwächeln. «Modellqualität» als einheitliche Grösse zu behandeln wäre schlicht irreführend.

Neuere Arbeiten zum Model-Routing, etwa SelectLLM (Maurya et al., 2025), nehmen diese Differenzierung ernst. Statt ein Modell für alles einzusetzen, schlagen die Autoren vor, eingehende Anfragen dynamisch an das jeweils geeignetste Modell weiterzuleiten. Die Kernidee: Leistung hängt von der Aufgabe ab, und die Modellwahl sollte das widerspiegeln.

Das stützt die modulare Architektur dieses Prototyps. Globale Rankings und Schlagzeilen-Scores taugen als erste Orientierung — mehr nicht. Entscheidend ist, ob ein Modell zu den konkreten Anforderungen einer bestimmten Systemkomponente passt. Evaluation muss aufgabensensitiv bleiben, sonst lassen sich Architekturentscheidungen nicht sauber in der aktuellen Forschung verankern.

## 6.2. Systemarchitektur

Fünf funktionale Bereiche bilden das Rückgrat des Systems. Beobachtung, Bewertung und Intervention sind konsequent voneinander getrennt.

Den Ausgangspunkt bildet die **Videokommunikation** — ein browserbasiertes Konferenzsystem auf WebRTC-Basis mit SFU-Architektur. Teilnehmende treten direkt über den Browser bei, keine Zusatzsoftware nötig. Entscheidend: Das System erfasst individuelle Audiospuren pro Person statt eines gemischten Streams. Ohne diese Isolation wäre eine exakte Sprecherzuordnung in der Transkription nicht möglich, und sämtliche Partizipationsmetriken würden auf wackligem Fundament stehen.

Aufbauend darauf die **Echtzeit-Transkription**. Gesprochenes wird laufend in Text umgewandelt, wobei für jede teilnehmende Person eine eigene Verbindung zu einem Streaming-Spracherkennungsdienst besteht. Serverseitige Sprachaktivitätserkennung identifiziert Pausen und erzeugt finalisierte Segmente mit Sprecheridentität und Zeitstempel. Mehrere Filterebenen fangen Halluzinationen des Spracherkennungsmodells ab — ein bei Echtzeit-Transkription bekanntes Problem, das ohne Gegenmassnahmen die gesamte Analysekette verfälschen würde.

Die **Prozessanalyse** macht aus den Rohdaten messbare Grössen. Partizipationsmetriken bilden ab, wie die Beiträge über die Gruppenmitglieder verteilt sind: Redezeit-Ungleichgewichte, stille Teilnehmende, Dominanzmuster. Semantische Dynamikmetriken nutzen einbettungsbasierte Ähnlichkeitsanalyse, um die thematische Entwicklung zu verfolgen — wachsende Ähnlichkeit signalisiert Verengung, fehlende neue Cluster deuten auf Stagnation.

Die **Entscheidungs- und Interventionslogik** läuft als serverseitiger Agentenprozess. Wie das Zustandsmodell und der Interventionszyklus genau funktionieren, beschreibt Abschnitt 6.3.

Die **Benutzeroberfläche** hält die KI bewusst peripher. Video bleibt im Zentrum. Interventionen erreichen die Teilnehmenden über synthetische Sprache und erscheinen gleichzeitig als Texteinblendung. Ob das System gerade als Moderator strukturelle Dynamiken reflektiert oder als Ally einen kreativen Impuls setzt — das ist jederzeit erkennbar.

## 6.3. Interventionslogik

### 6.3.1. Fünf Gesprächszustände

Laufend klassifiziert das System die Diskussion in einen von fünf Zuständen, gestützt auf die berechneten Partizipations- und Semantikmetriken.

Zwei davon bilden produktive Phasen ab. *Gesunde Exploration* — ausgewogene Beteiligung, regelmässig neue Ideen, der thematische Raum dehnt sich aus. *Gesunde Elaboration* — die Gruppe vertieft bestehende Ansätze, weniger Neues kommt hinzu, aber die Beteiligung bleibt ausgeglichen und nichts verengt sich. Beides sind Modi, in denen das System keinen Grund zum Eingreifen sieht.

Drei Zustände markieren Risiken. Beim *Dominanzrisiko* kippt die Beteiligung: Eine oder zwei Personen bestreiten den Grossteil der Beiträge, andere verstummen. *Konvergenzrisiko* entsteht, wenn die thematische Vielfalt schrumpft und sich die Ideen zunehmend um wenige Pole gruppieren. Und eine *stagnierte Diskussion* liegt vor, wenn über einen längeren Zeitraum nichts Neues mehr auftaucht — die Gruppe redet vielleicht noch, aber kreativ bewegt sich kaum etwas.

Statt binärer Schwellenwerte arbeitet die Klassifikation mit gewichteten Konfidenzscores. Ein Hysterese-Mechanismus verhindert nervöses Hin-und-Her-Springen zwischen Zuständen. Liegen zwei Zustände nah beieinander, bekommt der Risikozustand den Vorzug — ein übersehenes Problem wiegt schwerer als ein kurzer Fehlalarm.

### 6.3.2. Vierphasiger Interventionszyklus

Ein erkannter Risikozustand allein führt noch zu nichts Sichtbarem. Zwischen Erkennung und Handlung liegen vier Phasen mit eingebauten Sicherungen.

Im *Monitoring* beobachtet das System still. Schwankungen in Fokus und Beteiligung gehören zum normalen Verlauf eines Brainstormings — nicht jede Delle rechtfertigt einen Eingriff. Hält ein Risikozustand über einen definierten Zeitraum an, beginnt die *Bestätigungsphase*: Das System prüft, ob die jüngsten Metrik-Snapshots konsistent auf dasselbe Problem hinweisen. Nur wenn das der Fall ist, wird tatsächlich eine Intervention erzeugt und übermittelt — die *Post-Check*-Phase. Das System beobachtet dann, ob sich die Metriken erholen. Anschliessend folgt eine *Abkühlphase*, in der keine weiteren Eingriffe stattfinden.

Ergänzend gibt es einen Ermüdungsmechanismus. Blieben vorherige Interventionen wirkungslos, verlängern sich die Wartezeiten schrittweise — das System wird vorsichtiger, statt stur weiterzufeuern.

### 6.3.3. Interventionsgenerierung und Eskalation

Steht eine Intervention an, werden Gesprächszustand, relevante Metrikwerte und ein Ausschnitt jüngster Transkriptsegmente an ein grosses Sprachmodell übergeben. Was den Eingriff auslöst, ist regelbasiert. Wie er sprachlich formuliert wird, entsteht dynamisch.

In Szenario A agiert das System rein als struktureller Moderator — Hinweise auf ungleiche Beteiligung, Bemerkungen zu thematischer Wiederholung, Anstösse in Richtung neuer Perspektiven. Der Ton bleibt neutral, adressiert wird immer die Gruppe, nie eine Einzelperson.

Szenario B ergänzt das um eine inhaltsorientierte Impulsfunktion. Dieser Ally-Modus springt nur an, wenn prozessorientiertes Feedback zuvor wirkungslos geblieben ist. Er bringt dann eine hypothetische Gegenperspektive ein oder stellt eine Reframing-Frage — ohne Lösungen vorzuschreiben.

Die Interventionen erreichen die Gruppe als synthetisch gesprochene Audiobeiträge, direkt in die Videokonferenz eingespeist. Die KI tritt als eigener Teilnehmer auf, dessen Rolle klar gekennzeichnet ist.

Und die Baseline? Da laufen sämtliche analytischen Komponenten ganz normal und protokollieren alles — nur dass nie eine sichtbare Intervention daraus entsteht.

## 6.4. Technologie-Stack

Zwei Hauptkomponenten: ein browserbasiertes Frontend und ein serverseitiger Agentenprozess.

Das Frontend — gebaut mit Next.js und React, serverseitig gerendert — stellt die Videokonferenz dar, zeigt Interventionen an und liefert die Oberfläche für die Teilnehmenden. Browserbasiert, keine Installation nötig.

Im Backend läuft ein Python-basierter Agentenprozess, der die eigentliche Schwerarbeit übernimmt: Echtzeit-Transkription über persistente WebSocket-Verbindungen, Metrikberechnung, Zustandsinferenz, Entscheidungslogik, Interventionsgenerierung und deren hörbare Übermittlung. Warum die Trennung? API-Schlüssel bleiben so aus dem Browser raus, und die Analysepipeline arbeitet unabhängig davon, was auf dem Gerät der Teilnehmenden gerade passiert.

Dazu kommen externe Dienste. Eine cloudbasierte Videokonferenzplattform auf WebRTC-Basis mit Pro-Teilnehmer-Audioisolation. Grosse Sprachmodelle für die Interventionstext-Generierung, Einbettungsmodelle für semantische Ähnlichkeitsberechnung. Ein Text-to-Speech-Dienst, der generierte Texte in Sprache umwandelt und als Audiostream direkt in die Konferenz einspeist. Und eine verwaltete PostgreSQL-Datenbank mit Echtzeit-Benachrichtigungen als zentrale Persistenz- und Synchronisationsschicht.

## 6.5. Experimentelle Konfiguration

Drei Konfigurationen, direkt abgeleitet aus den Szenarien in Kapitel 4:

| Szenario | KI-Rolle | Interventionsumfang | Zweck |
|---|---|---|---|
| Baseline | Keine aktive KI | Keiner | Referenzbedingung |
| Szenario A | Prozessmoderation | Nur strukturelles Feedback | Stabilisierung |
| Szenario B | Moderation + Ally | Strukturell + inhaltlicher Impuls | Reaktivierung |

Gruppengrösse, Thema, Sitzungsdauer, analytische Konfiguration — alles bleibt über die Szenarien hinweg identisch. Variiert wird einzig die Aktivierung der Moderations- und Ally-Funktionen. Auch in der Baseline laufen Transkription, Metrikberechnung und Zustandsinferenz vollständig im Hintergrund mit und werden protokolliert. So stehen für jede Bedingung vergleichbare Datensätze zur Verfügung.

## 6.6. Deployment-Kontext

Rein virtuell, rein browserbasiert. Alle Teilnehmenden verbinden sich von ihren eigenen Geräten aus über einen Standard-Webbrowser. Physische Anwesenheit am selben Ort ist nicht erforderlich.

Das hat handfeste Vorteile. Jedes Mikrofon erfasst den Input direkt, ohne Raumakustik oder Übersprechen. Die Sprecherzuordnung ist exakt, weil individuelle Audiospuren bereits auf Infrastrukturebene isoliert werden. Störvariablen wie nonverbale Signale, physische Nähe oder Raumdynamik — Dinge, die der Prototyp ohnehin nicht erfassen könnte — fallen weg.

Der Preis dafür: Befunde gelten primär für virtuelle Brainstorming-Situationen. Ein ko-lokalisiertes Setting bringt andere soziale Dynamiken mit sich. Für einen explorativen Prototyp, der zunächst prüfen will, ob KI-Moderation überhaupt einen messbaren Unterschied macht, ist dieser Kompromiss zugunsten interner Validität vertretbar.

## 6.7. Forschungsdaten-Pipeline

Jede Sitzung erzeugt einen geschichteten Datensatz, der den gesamten Brainstorming-Verlauf dokumentiert. Auf der untersten Ebene: Transkriptsegmente mit Sprecheridentität und Zeitstempel. Darüber: periodische Metrik-Snapshots — Partizipationswerte, Semantikwerte, der inferierte Gesprächszustand. Dann die Interventionsprotokolle mit auslösendem Zustand, Intent-Klassifikation und Recovery-Ergebnis. Auch der interne Zustand der Entscheidungslogik wird durchgehend mitgeschrieben — Phasenübergänge, Bestätigungsergebnisse, Abkühlungseintritte.

Am Ende jeder Sitzung fasst ein strukturierter Export alles zusammen und berechnet automatisch Zusammenfassungsstatistiken.

## 6.8. Technische und experimentelle Limitationen

Ein paar Einschränkungen gehören offen benannt.

Die Transkriptionsgenauigkeit schwankt mit der Mikrofonqualität, der Internetbandbreite und den Spracheigenschaften der Teilnehmenden. Akzente, hohes Sprechtempo, Fachbegriffe — all das drückt die Erkennungsrate. Und Redezeit wird über Transkriptlänge approximiert, was der tatsächlichen Sprechdauer nur ungefähr entspricht.

Einbettungsbasierte Ähnlichkeit erfasst thematische Konvergenz brauchbar, stösst aber bei tieferen argumentativen Strukturen, bei Ironie oder pragmatischen Funktionen eines Beitrags an ihre Grenzen. Was das System erkennt, sind strukturelle Trends — keine Intentionen. Ob jemand schweigt, weil er desinteressiert ist oder weil er aufmerksam zuhört und auf den richtigen Moment wartet: Das bleibt dem System verborgen.

Die Zustandsinferenz beruht auf gewichteten Heuristiken mit Schwellenwerten, die durch Pilottesting kalibriert wurden. Approximationen, keine exakten Messungen. Eine stabile Internetverbindung und Zugang zu den externen API-Diensten sind ebenfalls Voraussetzung — fällt beides länger aus, werden die analytischen Komponenten funktionsunfähig.

## 6.9. Kapitelzusammenfassung

Der Prototyp gliedert Videokommunikation, Transkription, Prozessanalyse, Entscheidungslogik und Interventionsauslieferung in eigenständige Module. Fünf Gesprächszustände klassifizieren die Dynamik, ein vierphasiger Zyklus verhindert Überreaktion, eine Datenpipeline sichert strukturierte Datensätze für die Auswertung. Was sich durch jede Designentscheidung zieht: Die KI bleibt Unterstützung, nie Hauptdarstellerin. Die kreative Arbeit gehört der Gruppe.

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
