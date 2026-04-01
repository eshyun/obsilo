# Architect Handoff: Website-Dokumentation & Roadmap (EPIC-017)

> **Quelle**: BA-010-website-documentation.md
> **Epic**: EPIC-017
> **Features**: FEATURE-1700 bis FEATURE-1707
> **Erstellt**: 2026-04-01

---

## 1. Kontext

Obsilo braucht eine ueberarbeitete Website-Dokumentation. Die bestehende raw-HTML-Site hat ~40% Content-Luecken und ist feature-orientiert statt nutzer-orientiert. Die Migration zu einem SSG mit Markdown-Authoring schafft die Grundlage fuer schnelle Content-Pflege und ermoeglicht die Dual-Use der Markdown-Quellen als Obsilo-Skill.

## 2. Aggregierte ASRs

### CRITICAL

**ASR-1: SSG-Auswahl** (FEATURE-1700)
- Bestimmt den gesamten Authoring-Workflow, Build-Pipeline und Feature-Set
- Anforderungen: Markdown-First, GitHub Pages Deploy, i18n (EN+DE), Sidebar-Navigation, Suche, Dark/Light Theme, Code-Highlighting
- Betrifft alle nachfolgenden Features
- Kandidaten: VitePress, Astro (Starlight), Docusaurus

**ASR-2: Progressive Disclosure in Navigation** (FEATURE-1701)
- Die Seitenstruktur bestimmt ob User den Guide als hilfreich oder ueberfordernd empfinden
- 4 Bereiche: Getting Started -> Using Obsilo -> Intelligence & Knowledge -> Reference
- Sidebar muss Gruppierung und aktuelle Position klar zeigen

### MODERATE

**ASR-3: Dual-Use Markdown** (FEATURE-1700, 1702)
- Markdown muss als SSG-Input (mit Frontmatter) und als Obsilo-Skill (plain Markdown) funktionieren
- Frontmatter-Schema muss mit beiden Systemen kompatibel sein
- Build-Step oder Symlink fuer Skill-Extraktion noetig

**ASR-4: Token-Budget fuer Doku-Skill** (FEATURE-1702)
- Gesamter User Guide ist zu gross fuer System-Prompt-Injection (~50.000+ Tokens)
- Loesungsansaetze: Kompakte Zusammenfassung als Skill, oder mehrere Topic-spezifische Skills, oder selektives Laden via Keyword-Matching

**ASR-5: Architektur-Diagramme** (FEATURE-1703)
- Dev Docs brauchen Systemdiagramme (Architecture Overview, Subsystem-Zusammenhaenge)
- Mermaid (SSG-nativ, Markdown-kompatibel) vs. statische SVGs

## 3. NFR-Zusammenfassung

### Performance
- Build-Zeit unter 30 Sekunden
- Seiten-Ladezeit unter 1 Sekunde (static HTML, kein JS-Framework-Overhead)
- Kein schweres CSS-Framework, Custom CSS bleibt

### Wartbarkeit
- Markdown als Single Source, kein duplizierter Content
- Sidebar-Navigation automatisch aus Dateistruktur generiert
- Eine Aenderung = ein File
- EN als Primary, DE als Uebersetzung mit Fallback

### Kompatibilitaet
- GitHub Pages kompatibel (static Output, keine Server-Komponente)
- Bestehende URL-Pfade soweit moeglich erhalten (Redirects wo noetig)
- Bestehendes Design-System migrieren (CSS-Variablen, Dark/Light Toggle)

### SEO
- Sinnvolle Seitentitel, Meta-Descriptions
- Clean URLs (kein .html Suffix ideal, aber GitHub Pages Constraint beachten)

### Accessibility
- Mobile-Lesbarkeit (375px aufwaerts)
- Screen-Reader-kompatibel (semantisches HTML)

## 4. Constraints

| Constraint | Auswirkung |
|------------|------------|
| GitHub Pages (kostenlos) | Kein Server-Side Rendering, nur static Output |
| Ein-Personen-Projekt | Wartungsaufwand minimal halten, keine komplexen Build-Pipelines |
| Dual-Use (Website + Skill) | Markdown muss in beiden Kontexten funktionieren |
| URL-Kompatibilitaet | Bestehende Links duerfen nicht brechen |
| Kein Budget | Keine Premium-Themes, keine Cloud-Services |

## 5. Open Questions

1. **VitePress vs Astro Starlight vs Docusaurus**: Welcher SSG passt am besten? (i18n, GitHub Pages, Markdown-First, Sidebar-Auto-Generation, Suche, Dark/Light, Mermaid-Support)
2. **URL-Migration**: Bestehende Pfade (`/getting-started.html`) beibehalten oder zu Clean URLs (`/getting-started/`) wechseln? Redirect-Strategie?
3. **Skill-Extraktion**: Separater Build-Step der Markdown zu Skill konvertiert, oder Skill referenziert Markdown-Quellen direkt via Dateipfad?
4. **Diagramme**: Mermaid (inline, SSG-rendered) oder statische SVGs (mehr Kontrolle, weniger wartbar)?
5. **Seitengranulatitaet**: Eine Seite "Vault-Operationen" mit allen Read/Write/Search-Tools, oder separate Seiten pro Thema?

## 6. Feature-Abhaengigkeiten

```
FEATURE-1700 (SSG-Migration)          -- Grundlage fuer alles
    |
    +-- FEATURE-1701 (User Guide)     -- Content-Erstellung
    |       |
    |       +-- FEATURE-1702 (Skill)  -- basiert auf User Guide Content
    |
    +-- FEATURE-1703 (Dev Docs)       -- Content-Erstellung
    |
    +-- FEATURE-1704 (Roadmap)        -- Homepage-Sektion
    |
    +-- FEATURE-1705 (Hero Update)    -- Homepage-Sektion
    |
    +-- FEATURE-1706 (Design)         -- ueber alle Seiten
    |
    +-- FEATURE-1707 (DE)             -- abhaengig von 1700 + 1701
```

## 7. Empfohlene Reihenfolge

1. **FEATURE-1700**: SSG aufsetzen, bestehendes CSS migrieren, Build + Deploy verifizieren
2. **FEATURE-1701**: User Guide Content erstellen (groesster Block)
3. **FEATURE-1705**: Hero-Section aktualisieren (schneller Win)
4. **FEATURE-1704**: Roadmap + Versions-Log (schneller Win)
5. **FEATURE-1702**: Doku-Skill erstellen (basierend auf fertigen Guide-Inhalten)
6. **FEATURE-1703**: Dev Docs updaten und erweitern
7. **FEATURE-1706**: Design-Feinschliff (ueber alle Seiten)
8. **FEATURE-1707**: DE-Uebersetzung (zum Schluss, wenn EN-Content stabil)
