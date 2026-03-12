# Feature: Basis-Praesentationsregeln (Prompt)

> **Feature ID**: FEATURE-1105
> **Epic**: EPIC-011 - Office Document Quality
> **Priority**: P0-Critical
> **Effort Estimate**: S
> **Status**: **Implementiert** -- office-workflow + presentation-design Skills

## Feature Description

Konditionale Prompt-Section die Basis-Regeln fuer professionelle Praesentationserstellung in den System-Prompt injiziert. Nur aktiv wenn die `edit`-Toolgroup verfuegbar ist.

## Regeln

### Template-Workflow
- Agent fragt vor PPTX-Erstellung nach Template (siehe FEATURE-1102)
- Template-Upload per Bueroklammer oder Vault-Pfad
- Skip wenn bereits Template in Memory vorhanden

### Slide-Struktur
- Jeder Slide hat genau EINEN Key-Takeaway
- Action Titles die eine Aussage/Schlussfolgerung enthalten: "Umsatz stieg um 15%" statt "Umsatz"
- Maximum 5 Bullet Points pro Slide (weniger ist besser)
- Erster Slide: Titel + Kontext. Letzter Slide: Zusammenfassung oder Call-to-Action
- Section-Layout als Divider zwischen Hauptthemen

### Visuelle Hierarchie
- Theme konsistent ueber alle Slides anwenden
- Tabellen immer mit Header und Theme-Farben
- Layout passend zum Inhalt waehlen:
  - Datenvergleich -> comparison Layout
  - Bild + Erklaerung -> image_right Layout
  - Pro/Con oder Vorher/Nachher -> two_column Layout
  - Thema-Uebergang -> section Layout

### Nach Erstellung
- Anbieten das Theme fuer zukuenftige Nutzung zu speichern
- Passendes DOCX-Handout anbieten

## Implementation

Neue Datei `src/core/prompts/sections/officeBaseRules.ts`:
- Exportiert `getOfficeBaseRulesSection(toolGroups?: ToolGroup[]): string`
- Gibt leeren String zurueck wenn `edit`-Gruppe nicht verfuegbar
- Token-Budget: < 500 Tokens

## Success Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| SC-01 | Regeln werden nur im edit-Mode in den Prompt injiziert | Konditional |
| SC-02 | Agent nutzt Action Titles statt deskriptiver Titel | Beobachtbar |
| SC-03 | Agent begrenzt Bullet Points pro Slide auf max 5 | Beobachtbar |
| SC-04 | Token-Overhead der Section < 500 Tokens | Messbar |

## Definition of Done

- [ ] officeBaseRules.ts implementiert mit konditionaler Aktivierung
- [ ] In systemPrompt.ts / Prompt-Index eingehaengt
- [ ] Agent befolgt Regeln bei PPTX-Erstellung
