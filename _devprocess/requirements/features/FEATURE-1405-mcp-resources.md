# Feature: MCP Resources

> **Feature ID**: FEATURE-1405
> **Epic**: EPIC-014 - MCP Connector
> **Priority**: P1-High
> **Effort Estimate**: S

## Feature Description

Vault-Metadaten als MCP Resources exponieren. Claude kann die Vault-Struktur verstehen
ohne explizite Tool Calls. Ergaenzt `get_context` (Tool) um passiv abrufbare Daten.

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Vault-Struktur als Resource | Folder-Baum + Stats | Resource-Listing |
| SC-02 | Tags als Resource | Alle Tags mit Counts | Resource-Listing |

## Definition of Done

- [ ] `vault://structure` Resource: Folder-Hierarchie
- [ ] `vault://tags` Resource: Tag-Cloud mit Counts
- [ ] `vault://stats` Resource: Note-Anzahl, Index-Status
- [ ] Intern: VaultStats + GraphStore.getTagCount() (read-only, 0 Aenderungen)

## Dependencies
- **FEATURE-1400**: MCP Server Core
