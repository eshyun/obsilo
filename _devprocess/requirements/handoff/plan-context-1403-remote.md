# Plan Context: FEATURE-1403 Remote Transport

> **Feature**: FEATURE-1403
> **ADR**: ADR-055 (Cloudflare Worker + Durable Object Relay)
> **Erstellt**: 2026-03-31

---

## 1. Ueberblick

Zwei Deliverables:
- **A) Relay-Server** (separates Repo): Cloudflare Worker + Durable Object
- **B) Plugin-Erweiterung**: WebSocket-Client + Settings UI

## 2. Deliverable A: Relay-Server (neues Repo)

### Repo-Struktur: `obsilo-relay/`

```
obsilo-relay/
+-- src/
|   +-- index.ts          # Worker: Router + Auth
|   +-- relay.ts           # Durable Object: WebSocket + HTTP Proxy
+-- wrangler.toml          # Cloudflare Config
+-- package.json
+-- README.md              # Setup-Guide + "Deploy to Cloudflare" Anleitung
```

### Worker (index.ts)

```typescript
export default {
    async fetch(request: Request, env: Env) {
        // Auth check
        const token = request.headers.get('Authorization')?.replace('Bearer ', '');
        if (token !== env.RELAY_TOKEN) return new Response('Unauthorized', { status: 401 });

        // Route to Durable Object
        const url = new URL(request.url);
        const relayId = env.RELAY_ID ?? 'default';
        const id = env.RELAY_DO.idFromName(relayId);
        const relay = env.RELAY_DO.get(id);
        return relay.fetch(request);
    }
};
```

### Durable Object (relay.ts)

- `fetch()`: WebSocket-Upgrade fuer Plugin ODER HTTP-Request forwarding
- `webSocketMessage()`: Response vom Plugin empfangen, wartenden Request resolven
- Hibernation API: `ctx.acceptWebSocket()` + `webSocketMessage/webSocketClose` Handler
- Pending-Requests Map: `correlationId -> { resolve, reject, timeout }`
- Keepalive: Ignoriert Ping-Frames (WebSocket-Protokoll)

### wrangler.toml

```toml
name = "obsilo-relay"
main = "src/index.ts"
compatibility_date = "2026-03-31"

[durable_objects]
bindings = [{ name = "RELAY_DO", class_name = "RelayDO" }]

[[migrations]]
tag = "v1"
new_classes = ["RelayDO"]

[vars]
RELAY_ID = "default"
# RELAY_TOKEN set via: wrangler secret put RELAY_TOKEN
```

### Deploy-Anleitung (README.md)

```
1. Fork dieses Repo
2. npm install
3. npx wrangler login
4. npx wrangler secret put RELAY_TOKEN  (generiere ein sicheres Token)
5. npx wrangler deploy
6. Deine Relay-URL: https://obsilo-relay.{account}.workers.dev
```

## 3. Deliverable B: Plugin-Erweiterung

### Neue Datei: `src/mcp/RelayClient.ts`

```typescript
class RelayClient {
    private ws: WebSocket | null = null;
    private reconnectDelay = 1000;
    private maxReconnectDelay = 30000;

    constructor(private plugin: ObsidianAgentPlugin) {}

    async connect(relayUrl: string, token: string): Promise<void>
    disconnect(): void
    private reconnect(): void   // exponentieller Backoff
    private handleMessage(msg): void  // -> handleToolCall -> send response
    private sendKeepalive(): void  // alle 30s
}
```

Verbindet sich zu `wss://{relay-url}/ws` mit Bearer Token Header.
Bei eingehender Nachricht: `handleToolCall()` aufrufen (gleicher Dispatcher wie lokaler HTTP-Server).

### Settings-Erweiterung: McpTab.ts

Im Connector-Card:
```
Remote access                           [Off]
  Relay URL:  [https://obsilo-relay.xxx.workers.dev]
  Token:      [sk-xxxxxxxxxxxxx]           [Show/Hide]
  Status:     Connected / Disconnected / Reconnecting

  Use this URL as Custom Connector in:
  - claude.ai (Settings → Connectors → Add)
  - ChatGPT (Apps → Developer Mode → Connector)
  - Any MCP-compatible AI assistant
```

### settings.ts

```typescript
enableRemoteRelay: boolean;     // default: false
relayUrl: string;               // Cloudflare Worker URL
relayToken: string;             // Shared secret (SafeStorage encrypted)
```

### McpBridge.ts Erweiterung

McpBridge startet den RelayClient zusaetzlich zum lokalen HTTP-Server:

```typescript
async start() {
    // Lokaler HTTP-Server (wie bisher)
    await this.startHttpServer();

    // Remote Relay (wenn konfiguriert)
    if (this.plugin.settings.enableRemoteRelay && this.plugin.settings.relayUrl) {
        this.relayClient = new RelayClient(this.plugin);
        await this.relayClient.connect(
            this.plugin.settings.relayUrl,
            this.plugin.settings.relayToken,
        );
    }
}
```

## 4. Implementierungsreihenfolge

1. **Relay-Server Repo** erstellen (Worker + DO, ~200 LOC)
2. **RelayClient.ts** im Plugin (WebSocket + Reconnect, ~150 LOC)
3. **Settings**: relayUrl + relayToken + UI
4. **McpBridge**: RelayClient starten wenn konfiguriert
5. **Deploy Relay** auf Cloudflare (eigener Account)
6. **Test**: claude.ai + ChatGPT E2E

## 5. Verifikation

1. Relay deployed auf Cloudflare
2. Plugin verbindet per WebSocket zum Relay
3. claude.ai: Custom Connector mit Relay-URL -> search_vault funktioniert
4. ChatGPT: Developer Mode -> Connector -> search_vault funktioniert
5. Obsidian Neustart: Reconnect automatisch
6. Falsches Token: 401 Unauthorized
7. Lokaler Connector (Claude Desktop): funktioniert weiterhin unabhaengig
