# Plan Context: Website-Dokumentation & Roadmap (EPIC-017)

> **Purpose:** Technische Zusammenfassung fuer Claude Code
> **Created by:** Architect
> **Date:** 2026-04-01

---

## Technical Stack

**Static Site Generator:**
- Framework: VitePress (Vue-basiert, Markdown-First) -- ADR-056
- Build Output: Static HTML (GitHub Pages kompatibel)
- Suche: MiniSearch (VitePress built-in, keine externe Dependency)
- Diagramme: Mermaid via vitepress-plugin-mermaid

**Hosting:**
- Platform: GitHub Pages (kostenlos)
- Domain: www.obsilo.ai (CNAME beibehalten)
- Deploy: GitHub Actions (vitepress build -> gh-pages Branch)

**i18n:**
- Strategie: VitePress Locale-Ordner (/de/ fuer Deutsch, Root fuer Englisch)
- Fallback: Englisch wenn DE-Seite fehlt

**Content:**
- Authoring: Markdown mit YAML-Frontmatter
- Dual-Use: Markdown-Quellen dienen gleichzeitig als Obsilo-Skill (FEATURE-1702)

## Architecture Style

- Pattern: Static Site mit Markdown-Authoring
- Key Quality Goals:
  1. **Wartbarkeit:** Eine Markdown-Datei = eine Seite, Navigation auto-generiert
  2. **User Experience:** Progressive Disclosure, best-in-class Design
  3. **Dual-Use:** Markdown als Website + Obsilo-Skill ohne Duplikation

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-056 | SSG-Auswahl | VitePress (Markdown-First, alles built-in) | High |
| ADR-057 | Informationsarchitektur | Themen-basierte Gruppierung mit Progressive Disclosure | High |

**Detail pro ADR:**

1. **ADR-056 VitePress:** Schnellster Build, bestes Default-Design, i18n/Suche/Dark-Light nativ. Markdown-First ohne MDX-Zwang. Homepage via Custom Layout. Mermaid via Plugin.
   - Rationale: Minimaler Overhead fuer Ein-Personen-Projekt bei maximalem Feature-Set out of the box.

2. **ADR-057 Informationsarchitektur:** 4-Gruppen User Guide (Getting Started -> Working With -> Advanced -> Reference), separate Dev Docs. Doku-Skill laedt selektiv pro Seite (~2000-4000 Tokens statt ~50.000).
   - Rationale: Progressive Disclosure natuerlich abgebildet, Token-effizient fuer Skill, Auto-Sidebar aus Ordnerstruktur.

## Seitenstruktur (Content Model)

```
docs/
  index.md                          -- Homepage (Custom Layout: Hero, Features, Roadmap)
  about.md                          -- About-Seite
  imprint.md                        -- Impressum

  guide/
    getting-started.md              -- Installation, erstes Modell, erster Chat
    first-conversation.md           -- Chat-Grundlagen, Modes, Kontext
    choosing-a-model.md             -- Provider-Uebersicht, Empfehlungen

    working-with-obsilo/
      chat-interface.md             -- Attachments, @-Mentions, Tool-Picker, History
      vault-operations.md           -- Lesen, Schreiben, Suchen, Frontmatter
      knowledge-discovery.md        -- Semantic Search, Graph, Implicit Connections
      memory-personalization.md     -- Memory, Onboarding, Chat-Linking
      safety-control.md             -- Permissions, Checkpoints, Approvals

    advanced/
      skills-rules-workflows.md     -- Eigene Regeln und Automatisierungen
      office-documents.md           -- PPTX, DOCX, XLSX aus dem Chat
      connectors.md                 -- MCP Client, MCP Server, Remote Access
      multi-agent.md                -- Sub-Tasks, Task Extraction

    reference/
      tools.md                      -- Alle Tools tabellarisch
      providers.md                  -- Alle Provider mit Setup
      settings.md                   -- Alle Einstellungen
      troubleshooting.md            -- FAQ, haeufige Probleme

  dev/
    index.md                        -- Architecture Overview (Mermaid-Diagramm)
    agent-loop.md
    tool-system.md
    system-prompt.md
    knowledge-layer.md              -- NEU
    memory-system.md
    office-pipeline.md              -- NEU
    provider-auth.md                -- NEU
    mcp-architecture.md             -- NEU
    governance.md
    self-development.md             -- NEU
    mode-system.md
    ui-architecture.md
    vault-dna.md

  de/                               -- Deutsche Uebersetzung (FEATURE-1707)
    guide/
      ...                           -- Spiegel der EN-Struktur
    dev/
      ...
```

## URL-Migration (Alt -> Neu)

| Alter Pfad | Neuer Pfad | Methode |
|------------|------------|---------|
| /getting-started.html | /guide/getting-started | Redirect |
| /chat-interface.html | /guide/working-with-obsilo/chat-interface | Redirect |
| /memory.html | /guide/working-with-obsilo/memory-personalization | Redirect |
| /modes.html | /guide/first-conversation | Redirect (integriert) |
| /permissions.html | /guide/working-with-obsilo/safety-control | Redirect |
| /rules-skills-workflows.html | /guide/advanced/skills-rules-workflows | Redirect |
| /semantic-search.html | /guide/working-with-obsilo/knowledge-discovery | Redirect |
| /tools.html | /guide/reference/tools | Redirect |
| /providers.html | /guide/reference/providers | Redirect |
| /mcp-servers.html | /guide/advanced/connectors | Redirect |
| /remote-access.html | /guide/advanced/connectors | Redirect |
| /checkpoints.html | /guide/working-with-obsilo/safety-control | Redirect |
| /settings-reference.html | /guide/reference/settings | Redirect |
| /dev/index.html | /dev/ | Redirect |
| /dev/*.html | /dev/* | Pfade bleiben |

Redirect-Strategie: Fuer jeden alten Pfad eine minimale HTML-Datei mit `<meta http-equiv="refresh">` im VitePress `public/`-Verzeichnis platzieren. VitePress rewrites funktionieren nur im Dev-Server, nicht im Static Build auf GitHub Pages.

## Doku-Skill-Architektur (FEATURE-1702)

**Strategie:** Ein Bundled Skill (`obsilo-guide`) mit sektions-basiertem Keyword-Matching.

```
skills/obsilo-guide/
  SKILL.md                  -- Frontmatter mit Keywords, Haupt-Skill
  sections/
    getting-started.md      -- Kompakte Version der Guide-Seite
    knowledge-discovery.md  -- Kompakte Version
    office-documents.md     -- Kompakte Version
    connectors.md           -- Kompakte Version
    ...
```

Der SkillsManager matched Keywords im User-Query und laedt nur die passende Sektion (~2000-4000 Tokens) in den System-Prompt. Keine Aenderung am Skill-System noetig.

**Build-Step:** Phase 1 ohne automatischen Build-Step. Der Bundled Skill referenziert handgeschriebene kompakte Markdown-Sektionen (wie alle anderen Bundled Skills). Automatisierung erst wenn sich der Content haeufig aendert.

## Performance & Wartbarkeit

**Performance:**
- Build-Zeit: <10s (VitePress, ~30 Markdown-Dateien)
- Seiten-Ladezeit: <500ms (Static HTML, kein Framework-Runtime)
- Bundle-Size: ~200KB JS (VitePress Runtime + MiniSearch)

**Wartbarkeit:**
- Neue Seite: Markdown-Datei erstellen -> erscheint automatisch in Sidebar
- Content-Update: Markdown editieren -> git push -> GitHub Actions deployed
- Neues Feature dokumentieren: 1 Markdown-Datei + Skill-Sektion aktualisieren

---

## Implementierungsreihenfolge

| Phase | Feature | Aufwand | Abhaengigkeit |
|-------|---------|---------|---------------|
| 1 | FEATURE-1700: VitePress Setup + CSS-Migration + Redirects | M (3-5 Tage) | -- |
| 2 | FEATURE-1701: User Guide Content (groesster Block) | L (1-2 Wochen) | 1700 |
| 3 | FEATURE-1705: Hero & Messaging Update | S (1 Tag) | 1700 |
| 4 | FEATURE-1704: Roadmap & Versions-Log | S (1 Tag) | 1700 |
| 5 | FEATURE-1702: Doku-Skill | S (1-2 Tage) | 1701 |
| 6 | FEATURE-1703: Dev Docs Update | M (3-5 Tage) | 1700 |
| 7 | FEATURE-1706: Design-Feinschliff | M (3-5 Tage) | 1700 |
| 8 | FEATURE-1707: DE-Uebersetzung | M (3-5 Tage) | 1701 |

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-056-ssg-selection.md`
2. `_devprocess/architecture/ADR-057-information-architecture.md`
3. `_devprocess/requirements/features/FEATURE-170*.md` (alle 8 Features)
4. `_devprocess/requirements/epics/EPIC-017-website-documentation.md`
5. `_devprocess/context/10_backlog.md` (fuer Roadmap-Content)
6. `docs/` (bestehende Website fuer Migration)
