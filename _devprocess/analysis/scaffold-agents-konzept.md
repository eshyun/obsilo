# Agent-Integration im Scaffold: Bewertung & Konzept

## Ausgangslage

Drei Copilot-Agents (BA, RE, Architect) decken die Discovery- und Design-Phase ab.
Claude Code uebernimmt als "Boss" die finale Architektur und die gesamte Implementierung.

```
Copilot: BA -> RE -> Architect
                        |
                  plan-context.md + ADRs + arc42
                        |
Claude Code: Finaler Implementierungsplan -> Code -> Tests -> Deploy
                        |
                  Security Scanner (periodisch)
```

Die Agents liegen im **GitHub Copilot Format** (`.github/agents/*.agent.md`,
`.github/instructions/*.instructions.md`). Basis: die aktuellen Definitionen aus
`pssah4/python-uv-speckit-template` (SpecKit-Referenzen entfernt, Pfade angepasst).

---

## Bewertung: Kilo Code vs GitHub Copilot vs Claude Code

### Die drei Plattformen im Vergleich

| Kriterium | GitHub Copilot | Kilo Code | Claude Code |
|-----------|----------------|-----------|-------------|
| **Agent-Format** | .agent.md, .chatmode.md, .instructions.md | .kilocodemodes, rules/, skills/ | Kein eigenes Format (wird durch Memory + CLAUDE.md gesteuert) |
| **Handoff zwischen Agents** | Frontmatter `handoffs:` mit `send: true/false` | Workflow Bootstrap + Subtask-Delegation | Nicht nativ (manuelle Uebergabe oder Plan-Mode) |
| **Interaktive Interviews** | Chat-UI mit Agent-Picker, gut fuer Q&A | Custom Modes mit Dialog | Gut, aber CLI-basiert |
| **Shell-Zugriff** | Begrenzt (`runCommands` Tool) | Begrenzt (`command` Group) | Voll (Bash, volle Kontrolle) |
| **Memory-System** | Keins | Memory Bank (rules/memory-bank/) | 2-Ebenen (MEMORY.md + CLAUDE.md) |
| **Plan-Mode** | Nicht vorhanden | Nicht nativ | Vollstaendig (Plan erstellen, Review, Implementieren) |
| **Datei-Erzeugung** | Gut (editFiles, createFiles) | Gut (edit Group) | Gut (Write, Edit) |
| **Web-Recherche** | `fetch`, `web_search`, MCP-Server | Begrenzt | WebSearch, WebFetch |
| **Modell-Auswahl pro Agent** | Ja (model: im Frontmatter) | Nicht direkt | Nein (ein Modell pro Session) |
| **File-basierte Validation** | instructions.md mit `applyTo:` Globs | rules/ mit Kontext-Matching | Keine automatische Validierung |
| **IDE-Integration** | Nativ in VS Code | VS Code Extension | Terminal + VS Code Extension |
| **Status** | Von Microsoft/GitHub aktiv entwickelt | Community-getrieben, Fork | Von Anthropic aktiv entwickelt |

### Staerken pro Plattform

**GitHub Copilot ist am besten fuer:**
- Interaktive Agents (BA-Interview, RE-Intake, Architect-Intake)
- Agents die hauptsaechlich Dokumente erstellen (keine Code-Ausfuehrung noetig)
- Auto-Validierung via .instructions.md (greifen automatisch bei passenden Dateien)
- Agent-Handoffs (native Unterstuetzung im Frontmatter)
- Mermaid-Diagramme (direkte Vorschau in VS Code)

**Kilo Code ist am besten fuer:**
- Orchestrierung (Workflow Bootstrap mit definierten Reihenfolgen)
- Memory Bank als dauerhafte Wissensquelle
- Subtask-Delegation (z.B. Translate-Mode + Workflow)
- File-Zugriffsbeschraenkung (fileRegex in Custom Modes)

**Claude Code ist am besten fuer:**
- Implementierung (voller Shell-Zugriff, Build, Deploy, Tests)
- Debugging (voller Code-Zugriff, Ausfuehrung, Analyse)
- Langzeit-Kontext (Memory-System, Plan-Mode, Feature-Lifecycle)
- Security-Scanning (braucht CodeQL CLI, npm audit, etc.)
- Git-Operationen (Commits, Branch-Management, PRs)

### Bewertung: Wo laeuft welcher Agent am besten?

| Agent | Copilot | Kilo Code | Claude Code | Empfehlung |
|-------|---------|-----------|-------------|------------|
| **Business Analyst** | +++ | ++ | + | **Copilot** -- interaktives Interview, Dokument-Erstellung |
| **Requirements Engineer** | +++ | ++ | + | **Copilot** -- Epics/Features erstellen, Auto-Validierung |
| **Architect** | ++ | ++ | ++ | **Copilot** -- ADRs, arc42, Mermaid, Web-Recherche |
| **Developer** | + | + | +++ | **Claude Code** -- Shell, Build, Tests, Memory, Plans |
| **Debugger** | + | + | +++ | **Claude Code** -- Shell, Analyse, Fix, Tests |
| **Security Scanner** | ++ | - | +++ | **Claude Code** -- braucht CodeQL CLI, npm audit, Shell |

---

## Empfehlung: Hybrid-Ansatz

### Phase 1: Discovery & Design -> GitHub Copilot

```
@business-analyst  -> _devprocess/analysis/BA-[PROJECT].md
@requirements-engineer -> _devprocess/requirements/epics/, features/, handoff/
@architect -> _devprocess/architecture/ADRs, arc42 + _devprocess/requirements/handoff/plan-context.md
```

**Warum Copilot:**
- Agents sind BEREITS im Copilot-Format (kein Konvertierungsaufwand)
- Interaktive Chat-UI ist ideal fuer strukturierte Interviews
- Agent-Handoffs funktionieren nativ (BA -> RE -> Architect)
- instructions.md validieren automatisch die erstellten Artefakte
- Mermaid-Vorschau direkt in VS Code
- Modell-Auswahl pro Agent (model: im Frontmatter)

### Phase 2: Implementation -> Claude Code (der Boss)

```
Claude Code -> Liest ADRs + arc42 + plan-context.md als Kontext
           -> Trifft finale Architektur-Entscheidungen
           -> Erstellt Implementierungsplan (Plan-Mode)
           -> Implementierung, Tests, Debugging, Security, Deployment
```

**Warum Claude Code als Boss:**
- Voller Shell-Zugriff fuer Build, Tests, Deployment
- Memory-System fuer Langzeit-Kontext
- Plan-Mode fuer nicht-triviale Aufgaben
- Feature-Lifecycle (Backlog -> Spec -> Plan -> Code -> Update)
- Git-Workflow (Commits, Branches, PRs)
- **Finale Entscheidungsgewalt:** Die Copilot-Agents liefern VORSCHLAEGE
  (ADR-Proposals, arc42-Entwurf). Claude Code entscheidet final ueber
  Architektur, Issue-Zerlegung und Implementierungsreihenfolge.

**Developer + Debugger Agents werden NICHT als separate Copilot-Agents gebraucht:**
- Claude Code IST der Developer + Debugger Agent
- Die Quality Standards aus developer.chatmode.md und debugger.chatmode.md
  fliessen in die globale CLAUDE.md und Projekt-Memory ein
- Plan-Mode + Feature-Lifecycle ersetzen die 5-Phasen-Workflows der Agents

### Security Scanner -> Claude Code

```
Claude Code -> Security Scan -> _devprocess/analysis/security/SCAN-*.md
```

**Warum Claude Code statt Copilot:**
- Braucht CodeQL CLI (`codeql database create`, `codeql database analyze`)
- Braucht npm audit, npx license-checker, dependency checks
- Braucht Shell-Zugriff fuer alle 5 Phasen
- Copilot-Agent kann die CLI-Tools nicht zuverlaessig ausfuehren

---

## Kilo Code: Rolle im Scaffold

**Entscheidung: Kilo Code wird NICHT im Scaffold verwendet.**

**Begruendung:**
1. Die Agents sind bereits im Copilot-Format -- Konvertierung waere Mehraufwand
2. Copilot-Handoffs decken die Orchestrierung ab
3. Claude Code uebernimmt die Implementierung (wo Kilo Code am schwachsten ist)
4. Der globale Workflow Bootstrap war ein fruehes Konzept, das jetzt durch den
   Hybrid-Ansatz (Copilot + Claude Code) besser abgedeckt ist
5. Ein Tool weniger im Stack = weniger Komplexitaet

**Was vom Kilo Code Workflow Bootstrap uebernommen wird:**
- Orchestrierungs-Reihenfolge -> README + Copilot-Handoffs
- Memory Bank Konzept -> Claude Code Memory (MEMORY.md)
- Coding Brief -> Projekt-Memory (MEMORY.md) + Context-Dokumente

---

## Folder-Mapping: Agent-Outputs -> _devprocess/-Struktur

Die Agents wurden fuer eine andere Verzeichnisstruktur geschrieben. Im Scaffold
muessen die Pfade angepasst werden:

### Mapping-Tabelle

| Agent-Output (Original) | Scaffold-Pfad (_devprocess/) | Aenderung |
|--------------------------|---------------------------|-----------|
| `docs/business-analysis.md` | `_devprocess/analysis/BA-[PROJECT].md` | Umbenannt |
| `docs/constitution-draft.md` | `_devprocess/analysis/constitution-draft.md` | Umbenannt (optional, nur bei Spec Kit) |
| `requirements/epics/EPIC-*.md` | `_devprocess/requirements/epics/EPIC-*.md` | **NEU: epics/ Ordner** |
| `requirements/features/FEATURE-*.md` | `_devprocess/requirements/features/FEATURE-*.md` | Bereits vorhanden |
| `requirements/handoff/architect-handoff.md` | `_devprocess/requirements/handoff/architect-handoff.md` | **NEU: handoff/ Ordner** |
| `architecture/adr/ADR-*.md` | `_devprocess/architecture/ADR-*.md` | Bereits vorhanden |
| `docs/ARC42-DOCUMENTATION.md` | `_devprocess/architecture/arc42.md` | Bereits vorhanden |
| `requirements/handoff/plan-context.md` | `_devprocess/requirements/handoff/plan-context.md` | **NEU: Architect -> Claude Code** |
| `docs/security-scan/SCAN-*.md` | `_devprocess/analysis/security/SCAN-*.md` | **NEU: security/ Ordner** |

### Erweiterte _devprocess/-Struktur

```
_devprocess/
  analysis/
    BA-[PROJECT].md                    # Business Analysis (vom BA Agent)
    constitution-draft.md              # Optional: Projekt-Prinzipien (vom BA Agent)
    security/
      SCAN-[PROJECT]-[DATE].md         # Security Scan Reports
    *.md                               # Weitere Analysen
  architecture/
    arc42.md                           # ARC42 Dokumentation (vom Architect, Vorschlag)
    ADR-001-*.md                       # Architecture Decision Records (Vorschlaege)
    ADR-NNN-*.md
  context/
    01_product-vision.md
    ...
    10_backlog.md                      # Lebendes Backlog (single source of truth)
  implementation/
    TECH-*.md, IMPL-*.md
  requirements/
    REQUIREMENTS-overview.md
    epics/                             # NEU
      EPIC-001-*.md                    # Epics (vom RE Agent)
    features/
      FEATURE-001-*.md                 # Features (vom RE Agent)
    handoff/                           # NEU
      architect-handoff.md             # RE -> Architect Uebergabe
      plan-context.md                  # Architect -> Claude Code (Tech-Stack, ADR-Summary)
```

### Was sich aendert gegenueber dem bisherigen Scaffold

1. **`_devprocess/requirements/epics/`** -- Neuer Ordner fuer SAFe-Epics
2. **`_devprocess/requirements/handoff/`** -- Neuer Ordner fuer Agent-Uebergaben
3. **`_devprocess/analysis/security/`** -- Neuer Ordner fuer Security-Scan-Reports
4. **`_devprocess/requirements/handoff/plan-context.md`** -- Technische Zusammenfassung
   vom Architect als Kontext fuer Claude Code

**Entfernt:** `_devprocess/requirements/backlog/ISSUE-*.md` -- Der Architect erstellt
KEINE atomaren Issues mehr. Claude Code entscheidet final ueber Issue-Zerlegung
und erstellt seinen eigenen Implementierungsplan (Plan-Mode).

---

## Agent-Anpassungen fuer das Scaffold

Die Copilot-Agents aus dem speckit-template muessen angepasst werden:

### 1. SpecKit-Referenzen entfernen

Alle Verweise auf `/speckit.specify`, `/speckit.plan`, `/speckit.constitution` werden
durch den direkten Workflow ersetzt:
- `specify-context.md` -> entfaellt (Success Criteria bleiben in den Features)
- `plan-context.md` -> bleibt, wird aber als Kontext fuer Claude Code beschrieben
- `constitution-draft.md` -> optional, als Projekt-Prinzipien-Dokument nutzbar

### 2. Output-Pfade auf _devprocess/-Struktur aendern

```diff
BA Agent:
- docs/business-analysis.md
+ _devprocess/analysis/BA-[PROJECT].md

RE Agent:
- requirements/epics/EPIC-*.md
+ _devprocess/requirements/epics/EPIC-*.md
- requirements/features/FEATURE-*.md
+ _devprocess/requirements/features/FEATURE-*.md
- requirements/handoff/architect-handoff.md
+ _devprocess/requirements/handoff/architect-handoff.md

Architect Agent:
- architecture/adr/ADR-*.md
+ _devprocess/architecture/ADR-*.md
- docs/ARC42-DOCUMENTATION.md
+ _devprocess/architecture/arc42.md
- requirements/handoff/plan-context.md
+ _devprocess/requirements/handoff/plan-context.md
```

### 3. applyTo-Pfade in den Instructions

```diff
BA:
- applyTo: "docs/business-analysis*.md, docs/constitution-draft.md"
+ applyTo: "_devprocess/analysis/BA-*.md, _devprocess/analysis/constitution-draft.md"

RE:
- applyTo: "requirements/epics/**/*.md, requirements/features/**/*.md, requirements/handoff/**/*.md"
+ applyTo: "_devprocess/requirements/epics/**/*.md, _devprocess/requirements/features/**/*.md, _devprocess/requirements/handoff/**/*.md"

Architect:
- applyTo: "architecture/adr/**/*.md, docs/ARC42-DOCUMENTATION.md, requirements/handoff/plan-context.md"
+ applyTo: "_devprocess/architecture/**/*.md, _devprocess/requirements/handoff/plan-context.md"
```

### 4. Handoff-Anweisungen anpassen

- BA -> RE: Bleibt gleich (`@Requirements Engineer`)
- RE -> Architect: Bleibt gleich (`@Architect`)
- Architect -> Claude Code: NEUER Handoff:
  ```
  Die Architektur steht! Wechsle nun zu Claude Code:
  1. Oeffne Terminal, starte `claude`
  2. "Lies _devprocess/requirements/handoff/plan-context.md und erstelle einen Implementierungsplan"
  3. Claude Code liest ADRs, arc42 und Features als Kontext
  4. Claude Code erstellt den finalen Implementierungsplan (Plan-Mode)
  ```

### 5. Architect: Issue-Erstellung entfernen

Der Architect erstellt KEINE Issues/Tasks mehr. Alles was mit `backlog/ISSUE-*.md`
oder atomaren Issues zu tun hat wird entfernt. Stattdessen:
- Architect erstellt `plan-context.md` als technische Zusammenfassung
- Claude Code entscheidet ueber Issue-Zerlegung im Plan-Mode

---

## Scaffold-Integration: Was wird hinzugefuegt

### Im Template-Repo (jeder Flavor)

```
project-scaffold/
  .github/
    agents/                              # NEU
      business-analyst.agent.md          # Angepasst: _devprocess/-Pfade, ohne SpecKit
      requirements-engineer.agent.md     # Angepasst: _devprocess/-Pfade, ohne SpecKit
      architect.agent.md                 # Angepasst: NUR ADRs + arc42, KEINE Issues
    instructions/                        # NEU
      business-analyst.instructions.md   # BA-Dokument-Qualitaet
      requirements-engineer.instructions.md  # NFR/ASR/Success-Criteria-Validierung
      architect.instructions.md          # ADR/arc42-Validierung (ohne Issue-Validierung)
    templates/                           # NEU
      EPIC-TEMPLATE.md                   # Epic-Template (SAFe)
      FEATURE-TEMPLATE.md               # Feature mit Benefits Hypothesis + tech-agnostische SC
    workflows/                           # Existiert bereits
      sync-public.yml
      release.yml
      ...
  _devprocess/
    requirements/
      epics/                             # NEU: Leerer Ordner mit .gitkeep
        .gitkeep
      handoff/                           # NEU
        .gitkeep
    analysis/
      security/                          # NEU
        .gitkeep
```

**Entfernt gegenueber der vorherigen Version:**
- `_devprocess/requirements/backlog/` -- Keine vordefinierten Issues. Claude Code plant selbst.
- `.github/chatmodes/` -- Nicht noetig, agents/ reicht fuer aktuelle Copilot-Versionen.
- `.github/templates/ISSUE-TEMPLATE.md` -- Issues werden von Claude Code im Plan-Mode definiert.

### Developer + Debugger: Nicht als Copilot-Agents

Developer und Debugger werden NICHT als Copilot-Agents ins Scaffold aufgenommen.
Stattdessen fliessen ihre Quality Standards in:

1. **Globale CLAUDE.md** (`_global/CLAUDE.md`):
   - Abschnitt D (Implementierungs-Workflow) enthaelt die Developer-Prinzipien
   - Abschnitt E (Debugging) enthaelt die Debugger-Prinzipien
   - Test-Pflicht, Error-Logging, Clean-Code -- alles bereits dort

2. **Projekt-Memory** (`_memory/MEMORY.md`):
   - Quality Standards pro Projekt (Coverage-Ziel, Lint-Config, Test-Framework)

### Security Scanner: Als Claude Code Prompt

Der Security Scanner wird als **wiederverwendbarer Prompt** ins Scaffold integriert,
nicht als Copilot-Agent (braucht Shell-Zugriff):

```
_devprocess/
  prompts/                               # NEU
    security-scan.md                     # Angepasste Version des Security Scanners
```

Aufruf in Claude Code:
```
"Fuehre einen Security Scan durch gemaess _devprocess/prompts/security-scan.md"
```

---

## Workflow im Scaffold: Von der Idee zum Code

### Kompletter Ablauf (MVP/PoC)

```
Phase 0: Discovery (GitHub Copilot)
  @business-analyst
  -> Input: Projektidee
  -> Output: _devprocess/analysis/BA-[PROJECT].md
  -> Handoff: "Wechsle zu @Requirements Engineer"

Phase 1: Requirements (GitHub Copilot)
  @requirements-engineer
  -> Input: BA-Dokument
  -> Output: _devprocess/requirements/epics/EPIC-*.md
             _devprocess/requirements/features/FEATURE-*.md
             _devprocess/requirements/handoff/architect-handoff.md
  -> QG1: Alle NFRs quantifiziert? Alle ASRs markiert?
          Tech-agnostische Success Criteria vorhanden?
  -> Handoff: "Wechsle zu @Architect"

Phase 2: Architecture-VORSCHLAG (GitHub Copilot)
  @architect
  -> Input: architect-handoff.md + Features + Epics
  -> Output: _devprocess/architecture/ADR-*.md (VORSCHLAEGE!)
             _devprocess/architecture/arc42.md (Entwurf)
             _devprocess/requirements/handoff/plan-context.md (Tech-Summary)
  -> QG2: ADRs in MADR-Format? arc42 scope-passend?
  -> KEIN Issue-Output! Keine atomaren Tasks!
  -> Handoff: "Wechsle zu Claude Code"

--- Wechsel zu Claude Code (der Boss) ---

Phase 3: Finale Architektur + Implementierungsplan (Claude Code)
  -> Input: plan-context.md + ADRs + arc42 + Features + Epics
  -> Claude Code liest alle Kontext-Dokumente
  -> Trifft FINALE Architektur-Entscheidungen:
     - Akzeptiert, modifiziert oder verwirft ADR-Vorschlaege
     - Ergaenzt fehlende Entscheidungen
     - Definiert die Issue-Zerlegung
  -> Erstellt Implementierungsplan (Plan-Mode):
     - Phasen mit unabhaengig deploybaren Schritten
     - Dateien-Tabelle pro Phase
     - Verifikationsschritte
  -> Output: Plan genehmigt -> Implementation startet

Phase 4: Implementation (Claude Code)
  -> Workflow: Feature-Lifecycle (Backlog -> Spec -> Plan -> Code -> Update)
  -> Build+Deploy nach jedem Schritt
  -> Output: src/**/*.ts, tests/**/*.ts
  -> QG3: Tests bestanden? Coverage >= 90%?
  -> Backlog + Memory aktualisieren

Phase 5: Security (Claude Code, periodisch)
  -> Input: _devprocess/prompts/security-scan.md
  -> Output: _devprocess/analysis/security/SCAN-*.md
  -> Findings -> _devprocess/context/10_backlog.md (Offene Punkte)
```

### Vereinfachter Ablauf (Simple Test)

```
Copilot: @architect (direkt, ohne BA/RE)
  -> 1-2 ADRs (minimale Vorschlaege)
  -> Kurzer plan-context.md

Claude Code:
  -> Liest plan-context.md als Kontext
  -> Erstellt Plan, implementiert direkt
  -> Tests + Build
```

### Rollenverteilung: Wer entscheidet was?

```
Copilot-Agents (VORSCHLAEGE):              Claude Code (ENTSCHEIDUNGEN):
  BA:  Problem & Stakeholder                 Finale Architektur
  RE:  Features & NFRs                       Issue-Zerlegung & Reihenfolge
  Architect: ADR-Vorschlaege & arc42         Implementierungsplan
                                             Code, Tests, Deployment
                                             ADRs akzeptieren/aendern
```

---

## Entscheidungen & Trade-offs

### E1: Warum nicht alles in Claude Code?

BA- und RE-Agents sind **interview-basiert**. Sie stellen 15-50 Fragen mit
Multiple-Choice-Optionen. Das funktioniert in Copilots Chat-UI besser als
im Claude Code Terminal. Ausserdem haben die Copilot-Agents native
Handoff-Unterstuetzung.

### E2: Warum ist Claude Code der Boss?

Die Copilot-Agents haben keinen Shell-Zugriff und koennen die Codebase nicht
ausfuehren. Deshalb koennen sie nur VORSCHLAEGE machen, aber nicht verifizieren
ob eine Architektur-Entscheidung tatsaechlich funktioniert. Claude Code dagegen:
- Kann den Code lesen, bauen, testen und deployen
- Hat Memory ueber vergangene Sessions (weiss was funktioniert hat)
- Kann Plan-Mode nutzen um Entscheidungen systematisch zu evaluieren
- Kennt die tatsaechlichen Abhaengigkeiten und Einschraenkungen der Codebase

Deshalb trifft Claude Code die FINALEN Entscheidungen. Die ADRs vom Architect
sind wertvolle Vorschlaege mit Kontext und Optionen-Analyse, aber Claude Code
entscheidet basierend auf dem realen Zustand der Codebase.

### E3: Warum erstellt der Architect keine Issues?

Der Architect kennt die Codebase nicht im Detail. Atomare Issues erfordern
Wissen ueber:
- Welche Dateien betroffen sind
- Welche Abhaengigkeiten existieren
- In welcher Reihenfolge implementiert werden muss
- Wie gross der Aufwand pro Schritt ist

Claude Code hat dieses Wissen (durch Memory und Code-Analyse) und erstellt
daher bessere, realistischere Implementierungsplaene als der Architect.

### E4: Warum Kilo Code rauslassen?

Drei Tools im Stack (Copilot + Kilo Code + Claude Code) erhoehen die
Komplexitaet, ohne proportionalen Nutzen. Copilot deckt die Discovery/Design-
Phase besser ab (native Handoffs, Auto-Validierung). Claude Code deckt die
Implementation besser ab (Shell, Memory). Kilo Code waere "mittendrin"
ohne klaren Vorteil.

### E5: Warum keine Copilot-Agents fuer Developer/Debugger im Scaffold?

Die chatmodes/agents fuer Developer und Debugger existieren im
digital-innovation-agents Repo. Aber:
- Sie duplizieren was Claude Code nativ kann
- Ihre Prinzipien sind bereits in unserer CLAUDE.md
- Wer Copilot statt Claude Code fuer Implementation nutzt, kann sie
  optional aktivieren (sie sind im Quell-Repo verfuegbar)

---

## Orchestrierung ohne Kilo Code

### Wie funktioniert der Handoff zwischen Agents?

Ohne Kilo Code gibt es keinen automatischen Orchestrator. Stattdessen:

**1. Agent-interne Handoff-Anweisungen:**
Jeder Agent hat am Ende seiner Ausgabe eine "Naechste Schritte"-Section
die dem User sagt, welchen Agent er als naechstes aufrufen soll:
```
BA:       "Wechsle zu @Requirements Engineer"
RE:       "Wechsle zu @Architect"
Architect: "Wechsle zu Claude Code im Terminal"
```

**2. Der User steuert den Wechsel manuell:**
- In VS Code Copilot Chat: `@agent-name` tippen
- Fuer Claude Code: Terminal oeffnen, `claude` starten

**3. Kontext-Uebergabe ueber Dateien (nicht Clipboard):**
Jeder Agent schreibt seine Artefakte in `_devprocess/`. Der naechste Agent
liest sie von dort. Es gibt keine Clipboard-Uebergabe oder manuelle
Copy-Paste-Schritte. Die Handoff-Dokumente (architect-handoff.md,
plan-context.md) fassen den Kontext zusammen.

**4. Quality Gates als manueller Check:**
Der User prueft nach jeder Phase ob die Qualitaet stimmt:
- QG1 (nach RE): NFRs quantifiziert? ASRs markiert?
- QG2 (nach Architect): ADRs vollstaendig? arc42 scope-passend?
- QG3 (nach Implementation): Tests bestanden? Build erfolgreich?

### Warum reicht das?

Die Orchestrierung ist bewusst einfach gehalten:
- Nur 3 Agents + Claude Code -- kein komplexer Workflow noetig
- Sequentieller Ablauf (keine parallelen Agents)
- Klare Artefakte pro Phase (nachpruefbar)
- Der User behaelt die Kontrolle ueber den Uebergang
- Keine Tooling-Abhaengigkeit (funktioniert mit jedem VS Code Setup)

---

## Naechste Schritte

1. **Agent-Dateien erstellen** -- speckit-template als Basis, SpecKit entfernen, _devprocess/-Pfade
2. **Instructions erstellen** -- applyTo-Globs fuer _devprocess/-Pfade anpassen
3. **Templates erstellen** -- EPIC + FEATURE Templates mit angepassten Pfaden
4. **Security-Scanner-Prompt erstellen** -- Angepasste Version fuer Claude Code
5. **scaffold-concept.md finalisieren** -- Verzeichnisstruktur + Agent-Integration
6. **scaffold-anleitung.md finalisieren** -- Workflow mit neuer Rollenverteilung
7. **Template-Repo erstellen** -- pssah4/project-scaffold mit allen Artefakten

---

## Zusammenfassung

```
Discovery & Design    ->  GitHub Copilot (3 Agents: BA, RE, Architect)
                          Liefern VORSCHLAEGE: BA-Dokument, Epics, Features, ADRs, arc42
Finale Architektur    ->  Claude Code (der Boss)
                          Liest Kontext, trifft finale Entscheidungen
Implementation        ->  Claude Code
                          Plan-Mode, Feature-Lifecycle, Tests, Deployment
Security              ->  Claude Code (Security-Scan-Prompt)
Orchestrierung        ->  Agent-Handoffs (manuell) + plan-context.md als Kontext-Bruecke
Memory & Lernen       ->  Claude Code Memory (MEMORY.md + CLAUDE.md)
Qualitaetsvalidierung ->  Copilot .instructions.md (auto) + Claude Code (manuell)
```

Zwei Tools, klare Rollenverteilung:
- **Copilot** = interaktive Analyse & Vorschlaege (Dokumente erzeugen)
- **Claude Code** = finale Entscheidungen & autonome Ausfuehrung (Architektur, Code, Tests, Deploy)
