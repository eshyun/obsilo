# Von 634.000 auf 60.000 Tokens: Wie ich die Kosten meines AI-Agenten um 90% gesenkt habe

Mein Obsidian-Plugin "Obsilo" ist ein AI-Agent mit ueber 40 Tools, der direkt im Vault arbeitet: Notizen durchsuchen, zusammenfassen, verknuepfen, Canvas erstellen. Ein simpler Task wie "Suche meine Notizen zum Thema Kant und erstelle eine Zusammenfassung" kostete $2 und verbrauchte 634.000 Input-Tokens. Bei GitHub Copilot crashte der Agent bei 183.000 Tokens komplett, weil dort das Kontextlimit bei 168.000 liegt.

Zwei Dollar fuer eine Zusammenfassung. An dem Punkt habe ich aufgehoert, neue Features zu bauen.

## Wo die Tokens hinflossen

Ich habe einen Systemtest durchgefuehrt und die Token-Verteilung aufgeschluesselt:

| Kostenblock | Tokens | Anteil | Kosten (~$3/MTok) |
|---|---|---|---|
| System Prompt (25k x 8 Iterationen) | 200.000 | 32% | $0.60 |
| Tool-Definitionen (10k x 8 Iterationen) | 80.000 | 13% | $0.24 |
| Tool-Ergebnisse in der History | 250.000 | 39% | $0.75 |
| Assistant-Antworten in der History | 100.000 | 16% | $0.30 |

Ich haette gewettet, der System Prompt ist das Problem. War er nicht. Der groesste Posten waren die akkumulierten Tool-Ergebnisse: 39%. Eine semantische Suche liefert 10 Excerpts mit je 2.000 Zeichen, ein read_file bis zu 20.000 Zeichen. Nach acht Iterationen sind das ueber 250.000 Tokens fuer Ergebnisse, die der Agent laengst verarbeitet hat, aber trotzdem bei jedem Aufruf wieder mitschickt.

Und acht Iterationen fuer "suche und fasse zusammen" sind schlicht zu viele. Der Agent weiss nach dem dritten Aufruf, was er tun muss. Aber der ReAct-Loop fragt trotzdem fuenfmal nach.

## Ein Agent, der aus Erfahrung lernt

Die wirksamste Massnahme kam nicht aus Prompt-Optimierung. Sie kam aus einem System, das dem Agenten erlaubt, sich zu erinnern.

Wenn der Agent dieselbe Art von Task schon dreimal erfolgreich geloest hat, muss er nicht jedes Mal von vorn ueberlegen. Dafuer braucht er ein Gedaechtnis, das in drei Schichten funktioniert.

### Episoden, Recipes, Langzeitgedaechtnis

Episoden sind Aufzeichnungen einzelner Task-Ausfuehrungen. Nutzer-Nachricht, Tool-Sequenz, Ergebnis: erfolgreich oder nicht. Der Agent zeichnet jede Interaktion auf, bei der mindestens zwei Tools zum Einsatz kamen. Die letzten 500 Episoden bleiben, aeltere werden nach FIFO verworfen.

Recipes sind abstrahierte Handlungsanleitungen, die aus Episoden entstehen. Wenn drei oder mehr aehnliche Episoden erfolgreich waren, generiert ein LLM-Aufruf aus den konkreten Beispielen eine verallgemeinerte Rezeptur: welche Tools in welcher Reihenfolge, mit welchen Parametern. Acht statische Recipes fuer haeufige Vault-Operationen liefere ich als Plugin-Autor mit. Gelernte Recipes entstehen automatisch, maximal 50 Stueck.

Das Langzeitgedaechtnis speichert Erkenntnisse ueber den Nutzer: Arbeitsmuster, Vorlieben, Projektkontext. Sechs Markdown-Dateien, jede mit einem harten Budget von 800 Zeichen. Ein LLM-Extractor entscheidet bei jeder Aktualisierung, was bleibt und was durch neuere Informationen ersetzt wird. Ohne das Budget waechst die Datei unbegrenzt, und nach einem Jahr sind die sichtbaren 800 Zeichen voll mit veralteten Eintraegen. Ob der Extractor tatsaechlich gut genug priorisiert, muss sich noch zeigen, aber das Budget als harten Constraint zu setzen war auf jeden Fall richtig.

### Warum Intent-Matching statt Sequenz-Matching

Die erste Version des Promotionssystems hat Monate gekostet und nie funktioniert.

Die Logik war: Wenn dreimal die Tool-Folge `search_files -> read_file -> write_file` auftritt, ist es dasselbe Muster. Promote to Recipe. Das Problem ist, dass LLMs Tools nicht deterministisch waehlen. Drei funktional identische Tasks ("suche Notizen zum Thema Kant und fasse zusammen", "finde alles zu Hegel und erstelle eine Uebersicht", "was habe ich zu Nietzsche und schreib eine Zusammenfassung") produzierten drei verschiedene Tool-Sequenzen. Mal wird `update_todo_list` zwischengeschaltet, mal werden unterschiedlich viele Dateien gelesen. Drei separate Patterns mit je einer Beobachtung, keine einzige Promotion. Ich habe zu lange an der Sequenz-Idee festgehalten, weil sie so einleuchtend klang.

Die Loesung war ein Wechsel zu semantischem Intent-Matching ueber Embeddings. Statt Tool-Folgen zu vergleichen, vergleicht das System die Nutzer-Nachrichten per Cosine Similarity. "Suche Kant-Notizen und fasse zusammen" und "Finde Hegel-Material und erstelle Uebersicht" haben einen hohen Aehnlichkeitswert, obwohl die Tool-Sequenzen voellig verschieden aussehen. Nicht die Aktion definiert die Wiederholung, sondern die Absicht. Nach drei aehnlichen erfolgreichen Episoden wird ein Recipe generiert.

## Fast Path Execution

Wenn ein Recipe existiert, muss der Agent nicht mehr iterativ ueberlegen.

Die Nutzer-Nachricht kommt rein, das RecipeMatchingService prueft per Keyword-Matching (und ggf. Description-Fallback), ob ein passendes Recipe existiert. Falls ja: Ein einziger Planner-LLM-Aufruf erhaelt die Nachricht plus das Recipe und erzeugt einen konkreten Ausfuehrungsplan als JSON-Array von Tool-Aufrufen mit Parametern. Der Plan wird dann deterministisch abgearbeitet, ohne weitere LLM-Aufrufe. Lese-Tools laufen parallel via Promise.all, Schreib-Tools sequenziell. Danach uebernimmt der normale Agent-Loop fuer ein bis zwei abschliessende Iterationen: Ergebnis formulieren, Datei oeffnen.

Statt acht LLM-Aufrufe: zwei bis drei. Statt 634.000 Tokens: ca. 70.000.

Der Fast Path hat Leitplanken. Nur Recipes, die mindestens dreimal erfolgreich verwendet wurden und einen Score ueber 0.5 haben, qualifizieren sich. Ungueltiges Planner-JSON fuehrt zum Fallback auf den normalen ReAct-Loop. Alle Tool-Aufrufe laufen weiterhin ueber die ToolExecutionPipeline mit Approval-Checks und Logging. Ich wollte bewusst keinen Shortcut an der Governance vorbei, auch wenn es verlockend war.

## KV-Cache-optimierter Prompt-Aufbau

Moderne LLM-APIs cachen den KV-State des Prompt-Prefix. Solange der Anfang des Prompts identisch bleibt, muessen die gecachten Tokens nicht neu berechnet werden. Die Anthropic-API bietet das explizit an, bei OpenAI und DeepSeek passiert es automatisch.

Mein System Prompt hatte einen dummen Fehler: An Position 1 stand `getDateTimeSection()`. Jeder API-Aufruf hat einen anderen Timestamp. Ein einziges veraendertes Token am Anfang invalidiert den gesamten KV-Cache fuer alles danach. 25.000 Tokens, achtmal berechnet, null Cache-Hits. Ich habe monatelang Geld verbrannt, weil ein `new Date()` an der falschen Stelle stand.

Die Loesung: Prompt-Sektionen nach Stabilitaet sortieren. Positionen 1-8 sind stabil und werden gecacht: Mode-Definition, Capabilities, Obsidian-Konventionen, Tool-Definitionen (~8.000 Tokens), Tool-Routing-Regeln, Objective, Response-Format, Security Boundary. Positionen 9-16 sind dynamisch: Plugin Skills, aktive Skills, Memory-Kontext, Recipes, Custom Instructions, Vault-Kontext, und ganz am Ende: DateTime.

Die stabilen 20.000+ Tokens am Anfang werden einmal berechnet und dann aus dem Cache bedient. Bei acht Iterationen sind das statt 8 x 25.000 = 200.000 nur noch 25.000 + 7 x 5.000 = 60.000 tatsaechlich berechnete Tokens.

Ein Nebeneffekt, den ich nicht erwartet hatte: Skills rutschen von Position 3 auf Position 10 und verlieren den Primacy Effect, die Tendenz von LLMs, Instruktionen am Anfang des Kontexts staerker zu gewichten. Ob das in der Praxis ein echtes Problem ist, weiss ich noch nicht sicher. Meine Gegenmassnahme: Die aktuelle Todo-Liste wird als letzte Nutzer-Nachricht vor jedem LLM-Aufruf angehaengt, was den Recency Bias nutzt. Die Idee kommt aus Manus' Context Engineering Paper, wo sie Todo-Listen als "Recency Anchor" beschreiben.

## Context Externalization

Jedes Tool-Ergebnis wird komplett in die History geschrieben und bei jeder folgenden Iteration mitgeschickt. Eine semantische Suche mit 10 Treffern: 20.000 Zeichen. Ein gelesenes Dokument: bis zu 20.000 Zeichen. Nach acht Iterationen addiert sich das auf ueber 250.000 Tokens fuer Ergebnisse, die der Agent laengst verarbeitet hat.

Die Context Externalization sitzt in der ToolExecutionPipeline, zwischen Tool-Ausfuehrung und History-Eintrag. Wenn ein Tool-Ergebnis laenger als 2.000 Zeichen ist, wird das vollstaendige Ergebnis in eine temporaere Datei geschrieben. In der History steht dann nur eine kompakte Referenz: Art des Ergebnisses, Anzahl der Treffer, die Top-N-Eintraege mit Score, und der Dateipfad.

Konkretes Beispiel: Statt 50 Suchergebnissen in der History steht dort: "Found 50 matches. Top 5: [Pfad (Score)]... Full results: .obsidian-agent/tmp/{id}/search.md". Der Agent hat genug Information, um zu entscheiden, welche Dateien er als naechstes lesen will, ohne dass die History mit jedem Schritt um 20.000 Zeichen waechst.

Ein Detail, das leicht zu uebersehen ist: Die Externalisierung passiert beim Erstellen des Tool-Ergebnisses, nicht rueckwirkend. Die History bleibt append-only, wird also nie nachtraeglich veraendert, nur erweitert. Deterministische Dateipfade ohne Timestamps stellen sicher, dass keine Cache-Invalidierung entsteht. Dieses append-only-Prinzip zieht sich durch alle Massnahmen: KV-Caching, Externalization und Context Condensing profitieren alle davon.

Waehrend des Fast Path ist die Externalisierung deaktiviert. Der Presenter-Aufruf am Ende braucht die vollstaendigen Inhalte fuer eine gute Zusammenfassung, und bei nur zwei bis drei Aufrufen ist die Akkumulation ohnehin minimal.

## Das Zusammenspiel

| Massnahme | Was es tut | Nebeneffekt |
|---|---|---|
| Fast Path | 8 -> 2-3 Iterationen | Weniger History-Akkumulation |
| Prompt-Reordering | ~90% Cache-Hit auf System Prompt | Spart pro verbleibender Iteration |
| Externalization | Tool-Ergebnisse -80% in History | Context Condensing seltener noetig |

Fuer den Standard-Task "suche und fasse zusammen": vorher 8 Iterationen, 634.000 Tokens, ~$2.00, GitHub Copilot crasht. Nachher 2-3 Iterationen, ~60.000 Tokens, ~$0.15, funktioniert ueberall.

Fuer komplexe Tasks mit vielen Tool-Aufrufen: vorher ueber 800.000 Tokens, nachher ~257.000.

## Was ich daraus gelernt habe

Ich haette intuitiv zuerst den System Prompt gekuerzt. Die Daten haben gezeigt, dass 39% der Tokens auf akkumulierte Tool-Ergebnisse entfallen. Messen haette mir Wochen gespart.

Der Fast Path bringt die groesste Reduktion, und er funktioniert nur, weil der Agent aus Erfahrung weiss, welche Tools er braucht. Ohne das Recipe-System waere die einzige Option gewesen, den bestehenden Loop effizienter zu machen. Das haette vielleicht 20-30% gebracht, nicht 90%.

Das gescheiterte Sequenz-Matching hat mich etwas gelehrt, das ueber dieses Projekt hinausgeht: LLMs sind nicht deterministisch, und jedes System, das auf stabilen Tool-Sequenzen aufbaut, wird frueher oder spaeter daran scheitern. Die Absicht ist stabil, die Ausfuehrung nicht. Ich bin mir nicht sicher, ob diese Erkenntnis auch fuer andere Agent-Architekturen gilt, aber fuer ReAct-Loops mit vielen Tools stimmt sie definitiv.

Und schliesslich: Ein einzelnes `new Date()` an der falschen Stelle im Prompt hat 200.000 Tokens pro Task unkachbar gemacht. Die Reihenfolge von Prompt-Sektionen ist kein Implementierungsdetail. Sie ist Architektur.

## Ausblick

Die 90%-Reduktion gilt fuer Tasks, fuer die ein Recipe existiert. Neue Tasks durchlaufen den vollen ReAct-Loop. Aber jeder dieser Tasks fuettert das System. Nach drei erfolgreichen Durchlaeufen steht ein Recipe bereit, und der naechste identische Task kostet 90% weniger.

Ob sich das Lernverhalten langfristig bewaehrt, ob der Extractor die richtigen Eintraege priorisiert, ob 50 Recipes reichen oder ob es 200 sein muessen: Das weiss ich noch nicht. Die ersten Wochen sehen gut aus. Aber das haette ich auch ueber die Sequenz-basierte Pattern-Erkennung gesagt.
