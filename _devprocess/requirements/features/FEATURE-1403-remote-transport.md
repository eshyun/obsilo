# Feature: Remote Transport (Cloudflare Relay)

> **Feature ID**: FEATURE-1403
> **Epic**: EPIC-014 - MCP Connector
> **Priority**: P1-High
> **Effort Estimate**: L

## Feature Description

Obsilo's MCP Server wird ueber einen selbst-gehosteten Relay-Server von ueberall erreichbar.
Der Relay laeuft auf Cloudflare Workers + Durable Objects ($5/Monat). Das Plugin verbindet
sich per ausgehender WebSocket-Verbindung zum Relay -- kein Tunnel-Binary, kein Port-Oeffnen.

Funktioniert mit ALLEN MCP-Clients: claude.ai, ChatGPT, Cursor, Windsurf, etc.

## Architektur

```
claude.ai  ──┐
ChatGPT    ──┼──→ HTTPS → Cloudflare Worker → Durable Object ←── WebSocket ←── Obsilo Plugin
Cursor     ──┘             (Relay, User-deployed)                                (lokal)
                           Auth: Shared Secret
```

### Wie es funktioniert

1. **User deployed Relay** einmalig auf Cloudflare ("Deploy to Cloudflare" Button)
2. **Relay generiert** eine Relay-ID + Shared Secret Token
3. **User traegt Token** in Obsilo Settings ein
4. **Plugin verbindet** sich per WebSocket zum Relay (ausgehend, keine Firewall-Probleme)
5. **MCP-Clients** senden Requests an die Relay-URL (HTTPS)
6. **Relay forwarded** Request ueber WebSocket an Plugin, wartet auf Response, gibt sie zurueck
7. **Durable Object Hibernation:** Relay schlaeft wenn keine Requests kommen (keine Kosten im Idle)

### Zwei Komponenten

**A) Relay-Server (separates Repo, Cloudflare Worker)**
- Cloudflare Worker als Router
- Durable Object pro Relay-ID (Hibernation API)
- WebSocket-Endpoint fuer Plugin-Verbindung
- HTTPS-Endpoint fuer MCP-Client-Requests
- Auth: Shared Secret Token (Bearer Header)

**B) Plugin-Erweiterung (in Obsilo)**
- WebSocket-Client der sich zum Relay verbindet
- Reconnect-Logik (exponentieller Backoff)
- Keepalive Pings
- Settings: Relay-URL + Token

## Benefits Hypothesis

**Wir glauben dass** ein selbst-gehosteter Relay
**Folgende messbare Outcomes liefert:**
- Obsilo von jedem Geraet und jeder AI-Plattform erreichbar
- Kein Tunnel-Binary auf dem User-Rechner noetig
- Stabile, persistente URL (ueberlebt Neustarts)

**Wir wissen dass wir erfolgreich sind wenn:**
- claude.ai kann Obsilo-Tools ueber die Relay-URL nutzen
- ChatGPT kann denselben Relay nutzen
- Verbindung ueberlebt Obsidian-Neustart (automatischer Reconnect)

## User Stories

### Story 1: Vault von ueberall
**Als** Knowledge Worker
**moechte ich** von claude.ai im Browser auf meinen Vault zugreifen
**um** auch unterwegs mein Wissen zu nutzen

### Story 2: Multi-Plattform
**Als** User der Claude UND ChatGPT nutzt
**moechte ich** denselben Connector fuer beide Plattformen verwenden
**um** nicht zwei Setups pflegen zu muessen

### Story 3: Einfaches Setup
**Als** technisch versierter User
**moechte ich** den Relay mit einem "Deploy" Button aufsetzen
**um** nicht manuell Server konfigurieren zu muessen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | claude.ai kann ueber Relay auf Vault zugreifen | search_vault funktioniert | E2E-Test |
| SC-02 | ChatGPT kann denselben Relay nutzen | Tools verfuegbar | E2E-Test |
| SC-03 | Verbindung ueberlebt Plugin-Neustart | Automatischer Reconnect | Restart-Test |
| SC-04 | Unautorisierte Requests abgelehnt | 401 ohne Token | Security-Test |
| SC-05 | Relay-Setup unter 10 Minuten | Anleitung + Deploy Button | User-Test |
| SC-06 | Latenz akzeptabel | Unter 2s Ende-zu-Ende | Zeitmessung |

---

## Technical NFRs

### Performance
- Relay-Hop-Latenz: <100ms (Cloudflare Edge)
- Ende-zu-Ende: <2s (Relay + Plugin Tool Execution)
- WebSocket Reconnect: <5s nach Verbindungsabbruch

### Security
- Shared Secret Token (Bearer Header) fuer alle Requests
- TLS erzwungen (Cloudflare automatisch)
- Token in Obsilo via SafeStorageService verschluesselt
- Relay speichert keine Daten (reine Weiterleitung)

### Reliability
- Durable Object Hibernation: WebSocket bleibt offen auch wenn DO schlaeft
- Plugin-seitiger Reconnect mit exponentiellem Backoff
- Keepalive Pings alle 30s

### Kosten
- Cloudflare Workers Paid: $5/Monat (inkl. Durable Objects)
- Realistischer Verbrauch: wenige hundert Requests/Tag pro User
- Keine Kosten im Idle (Hibernation)

---

## Architecture Considerations

### ASRs

**CRITICAL ASR #1**: Kein Binary auf dem User-Rechner
- Plugin verbindet sich per WebSocket (ausgehend) -- keine Firewall-Probleme
- Kein cloudflared, kein ngrok

**CRITICAL ASR #2**: Multi-Plattform-kompatibel
- Ein Relay-Endpoint fuer alle MCP-Clients
- MCP JSON-RPC ueber HTTPS (Streamable HTTP kompatibel)

**MODERATE ASR #3**: Self-Deploy fuer BYOK-Zielgruppe
- "Deploy to Cloudflare" Button im Repo
- User deployed auf eigene Cloudflare-Instanz
- Spaeter: Managed Service Option

---

## Definition of Done

### Functional
- [ ] Relay-Server Code (Cloudflare Worker + Durable Object)
- [ ] "Deploy to Cloudflare" Anleitung/Button
- [ ] Plugin: WebSocket-Client mit Reconnect
- [ ] Plugin: Settings (Relay-URL + Token)
- [ ] Auth: Shared Secret Token Validierung
- [ ] claude.ai: E2E funktioniert
- [ ] ChatGPT: E2E funktioniert
- [ ] Standalone-Modus: 0 Regressionen

### Quality
- [ ] Security: Unautorisierte Requests abgelehnt
- [ ] Reliability: Reconnect nach Verbindungsabbruch
- [ ] Performance: <2s Ende-zu-Ende

### Documentation
- [ ] Setup-Guide fuer Cloudflare Relay
- [ ] Feature-Spec aktualisiert

---

## Dependencies
- **FEATURE-1400**: MCP Server Core (lokaler HTTP-Server)
- **Cloudflare Account**: $5/Monat Workers Paid Plan

## Out of Scope
- OAuth 2.1 (FEATURE-1404 -- spaeter, Shared Secret reicht fuer BYOK)
- Managed Relay Service (spaeter -- erstmal Self-Deploy)
- Approval-Pipeline fuer Remote Writes (FEATURE-1408)
