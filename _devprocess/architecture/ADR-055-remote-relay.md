# ADR-055: Remote MCP Relay via Cloudflare Workers + Durable Objects

**Status:** Proposed
**Date:** 2026-03-31
**Deciders:** Sebastian Hanke

## Context

Obsilo's MCP Server laeuft auf localhost:27182 im Electron Renderer. Fuer Remote-Zugriff
(claude.ai, ChatGPT, etc.) muss der Server ueber eine oeffentliche HTTPS-URL erreichbar sein.

Direkte Tunnel-Loesungen (cloudflared, ngrok) erfordern ein Binary auf dem User-Rechner
und liefern instabile URLs (Free Tier). Ein Relay-Server in der Cloud loest beide Probleme:
Das Plugin verbindet sich per ausgehender WebSocket -- kein Binary, kein Port-Oeffnen.

**Triggering ASR:**
- ASR: Kein Binary auf User-Rechner, Multi-Plattform (Claude + ChatGPT + Cursor)

## Decision Drivers

- **Kein lokales Binary**: WebSocket-Verbindung ist ausgehend, keine Firewall-Probleme
- **Persistente URL**: Ueberlebt Neustarts, einmal in MCP-Clients eintragen
- **Self-Deploy (BYOK)**: User hostet auf eigener Cloudflare-Instanz
- **Kosten**: Minimal ($5/Monat Cloudflare Workers Paid)
- **Multi-Client**: Ein Endpoint fuer alle MCP-Clients

## Considered Options

### Option 1: Cloudflare Quick Tunnel (cloudflared Binary)
- Pro: Zero Config, kein Account
- Con: Binary auf User-Rechner, URL aendert sich bei Neustart
- **Abgelehnt:** Instabil, Binary-Requirement

### Option 2: ngrok mit Authtoken
- Pro: Persistente URL (Free Tier)
- Con: Native NAPI-Bindings (Electron-Risiko), 1 GB Bandwidth-Limit
- **Abgelehnt:** Electron-Kompatibilitaet unsicher

### Option 3: Cloudflare Workers + Durable Objects (Relay)
- Pro: Kein Binary, persistente URL, Hibernation (keine Idle-Kosten)
- Pro: Edge-global (niedrige Latenz), $5/Monat pauschal
- Pro: "Deploy to Cloudflare" Button moeglich
- Con: User braucht Cloudflare-Account ($5/Monat)
- Con: Relay-Code muss gepflegt werden

### Option 4: Fly.io (Node.js Server)
- Pro: Volle Kontrolle, einfacher Code (~150 LOC)
- Pro: Free Tier (3 VMs)
- Con: Kein Scale-to-Zero (VM muss laufen), Cold Start bei Scale-to-Zero
- **Alternative fuer Power-User**

## Decision

**Option 3: Cloudflare Workers + Durable Objects**

### Relay-Architektur

```
MCP Client (claude.ai, ChatGPT, etc.)
    │
    │  HTTPS POST /{relay-id}/mcp
    │  Header: Authorization: Bearer {token}
    ▼
Cloudflare Worker (Router)
    │
    │  Lookup Durable Object by relay-id
    ▼
Durable Object (per User)
    │
    │  Forward request over WebSocket
    │  Wait for response (30s timeout)
    ▼
Obsilo Plugin (WebSocket Client)
    │
    │  handleToolCall() → result
    │
    ▲  Send response back over WebSocket
    │
Durable Object → HTTP Response → MCP Client
```

### Durable Object Design

```typescript
export class RelayDO {
    // Hibernation API: WebSocket bleibt offen, DO schlaeft wenn idle
    async fetch(request: Request) {
        if (isWebSocketUpgrade(request)) {
            // Plugin verbindet sich
            const [client, server] = Object.values(new WebSocketPair());
            this.ctx.acceptWebSocket(server);
            return new Response(null, { status: 101, webSocket: client });
        }

        // MCP Request von claude.ai/ChatGPT
        const correlationId = crypto.randomUUID();
        const ws = this.ctx.getWebSockets()[0];
        ws.send(JSON.stringify({ id: correlationId, ...await request.json() }));

        // Warte auf Response (Plugin antwortet ueber WebSocket)
        return await this.waitForResponse(correlationId, 30000);
    }

    webSocketMessage(ws, message) {
        // Response vom Plugin empfangen, wartenden HTTP-Request resolven
        const data = JSON.parse(message);
        this.resolveRequest(data.id, data);
    }
}
```

### Auth: Shared Secret

```
Relay generiert bei Deploy: RELAY_TOKEN=sk-{random-64-chars}
Plugin Settings:  Relay URL + Token (SafeStorageService verschluesselt)
MCP Client:       Authorization: Bearer {token} Header

Relay validiert Token bei JEDEM Request (Worker-Level, vor DO-Dispatch).
```

### Plugin WebSocket Client

```typescript
class RelayClient {
    private ws: WebSocket | null = null;

    async connect(relayUrl: string, token: string) {
        this.ws = new WebSocket(`${relayUrl}/ws`, { headers: { Authorization: `Bearer ${token}` } });
        this.ws.onmessage = (msg) => this.handleRequest(JSON.parse(msg.data));
        this.ws.onclose = () => this.reconnect(); // exponentieller Backoff
    }

    private async handleRequest(request) {
        const result = await handleToolCall(this.plugin, request.tool, request.args);
        this.ws.send(JSON.stringify({ id: request.id, result }));
    }
}
```

## Consequences

### Positive
- Kein Binary auf User-Rechner
- Persistente URL (ueberlebt alles)
- Multi-Client (Claude, ChatGPT, Cursor, etc.)
- Hibernation: keine Idle-Kosten
- Self-Deploy: User kontrolliert seine Daten

### Negative
- User braucht Cloudflare-Account ($5/Monat)
- Relay-Code muss als separates Repo gepflegt werden
- WebSocket-Reconnect-Logik noetig

### Risks
- Cloudflare Durable Objects Pricing aendert sich: Mitigation: Fly.io als Alternative dokumentiert
- WebSocket Idle-Timeout: Mitigation: Keepalive Pings alle 30s
- Relay-Ausfall: Mitigation: Lokaler Connector (Claude Desktop) funktioniert weiterhin

## Related
- ADR-053: MCP Server Prozess-Architektur
- ADR-054: MCP Tool-Mapping
- FEATURE-1403: Remote Transport
