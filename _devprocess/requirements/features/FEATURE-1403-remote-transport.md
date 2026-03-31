# Feature: Remote Transport (Streamable HTTP)

> **Feature ID**: FEATURE-1403
> **Epic**: EPIC-014 - MCP Connector
> **Priority**: P1-High
> **Effort Estimate**: L

## Feature Description

HTTP-basierter MCP-Transport fuer Remote-Zugriff auf den Vault ueber claude.ai.
Erfordert einen laufenden Rechner mit Obsidian + Obsilo (Always-on oder Wake-on-Demand).
Tunnel-basierter Ansatz (Cloudflare Tunnel o.ae.) um Electron's HTTP-Server-Limitation zu umgehen.

**Wichtig:** Remote erfordert dass Obsidian auf einem Rechner laeuft und der Tunnel aktiv ist.
iCloud-Sync ist orthogonal -- es synct die Vault-Daten, aber der MCP Server braucht den laufenden Prozess.

## User Stories

### Story 1: Vault von unterwegs
**Als** mobiler Knowledge Worker
**moechte ich** von claude.ai auf meinen Vault zugreifen
**um** auch ausserhalb meines Rechners auf mein Wissen zuzugreifen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | claude.ai kann auf den Vault zugreifen | Verbindung via URL | Funktionstest |
| SC-02 | Tunnel startet/stoppt zuverlaessig | Kein Zombie-Tunnel | Prozess-Pruefung |
| SC-03 | Antwortzeit akzeptabel | Unter 2s | Zeitmessung |
| SC-04 | Explizites Opt-in mit Datenschutz-Hinweis | User muss bestaetigen | UX-Review |

---

## Definition of Done

- [ ] HTTP-Server als separater Prozess
- [ ] Streamable HTTP MCP-Transport (MCP Spec konform)
- [ ] Tunnel-Integration (Cloudflare Tunnel oder vergleichbar)
- [ ] Opt-in mit Datenschutz-Dialog
- [ ] Tunnel-URL in Settings kopierbar
- [ ] Standalone: 0 Aenderungen

---

## Dependencies
- **FEATURE-1400**: MCP Server Core
- **FEATURE-1404**: Remote Authentication
