# Feature: Content Classification Framework

> **Feature ID**: FEATURE-1109
> **Epic**: EPIC-011 - Office Document Quality
> **Priority**: P0-Critical
> **Effort Estimate**: S (1-2 Tage)
> **Status**: **Integriert** -- In FEATURE-1105 (Universelle Design-Prinzipien) aufgegangen. Content Classification Framework und Visualization Decision Tree sind bereits im presentation-design Skill implementiert und werden dort weiterentwickelt.
> **Ersetzt**: FEATURE-1104 (Storyline-Framework-Skills)

## Feature Description

Erweiterung des `presentation-design` Bundled-Skills um template-agnostische Methodik: Content Classification Framework, Visualisierungs-Entscheidungsbaum, Kompositionsregeln und Shape-Name-basierte Key-Mapping-Anleitung.

## Technical Design

### Erweiterungen in `bundled-skills/presentation-design/SKILL.md`

**Neuer Abschnitt: Content Classification Framework**
- Mapping-Tabelle: Inhaltstyp -> Visualisierungsform -> Element-Kategorie
- Visualisierungs-Entscheidungsbaum (Zahlen? -> KPI/Chart; Sequenz? -> Prozess; etc.)
- Kompositionsregeln (max 30% Text, Abwechslung, Section-Divider)

**Neuer Abschnitt: Template-basierte Slide-Erstellung**
- Shape-Namen aus Template-Skill als Keys verwenden (nicht Text)
- Slide-Kompositionen aus Template-Skill als Referenz
- Brand-DNA fuer Tonalitaet und Konsistenz

### Anpassungen in `bundled-skills/office-workflow/SKILL.md`

- Neuer Step "ANALYZE" zwischen TEMPLATE und PLAN
- Verweis auf Template-Skill statt manuellen Katalog
- Vereinfachte Corporate-Template-Regeln

## Definition of Done

- [ ] Content Classification Framework im presentation-design Skill
- [ ] Visualisierungs-Entscheidungsbaum
- [ ] Shape-Name-basierte Key-Mapping-Anleitung
- [ ] office-workflow um ANALYZE-Step erweitert
- [ ] Agent waehlt nachweislich diverse Folientypen bei Praesentation
