# Feature: Memory Transparency (Agent vs. Human)

> **Feature ID**: FEATURE-1411
> **Epic**: EPIC-014 - MCP Connector
> **Priority**: P1-High
> **Effort Estimate**: S

## Feature Description

Source-Tracking fuer alle Interaktionen: `human` (Standalone) vs. `mcp` (Connector).
Ermoeglicht Audit-Trail und verhindert unkontrolliertes Memory-Poisoning.
Beide Quellen fliessen in denselben Memory-Speicher -- eine gemeinsame History.

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Source bei jeder Session gespeichert | 100% | Audit-Log |
| SC-02 | Sessions aus beiden Modi in einer History | Gemeinsame DB | History-Pruefung |
| SC-03 | Learnings aus MCP gleichwertig gelernt | Recipes + Patterns | Vergleichstest |

## Definition of Done

- [ ] sessions-Tabelle: `source` Feld ('human' | 'mcp')
- [ ] sync_session setzt `source = 'mcp'`
- [ ] Standalone SessionExtractor setzt `source = 'human'`
- [ ] Memory-Updates via MCP mit `[via MCP]` markiert
- [ ] Bestehende Sessions: `source = 'human'` (Default, keine Migration)

## Dependencies
- **FEATURE-1400**: MCP Server Core
- **MemoryService, MemoryDB**: Bestehend (sessions-Tabelle hat bereits `source` Spalte)
