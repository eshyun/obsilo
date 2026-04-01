# Plan Context: FEATURE-1403 Remote Transport (Revised)

> **Feature**: FEATURE-1403
> **ADR**: ADR-055 (Cloudflare Worker + Durable Object, REST API Deploy)
> **Erstellt**: 2026-03-31 (revised 2026-04-01)

---

## 1. Kern-Aenderung gegenueber dem ersten Plan

**Vorher:** User deployed per CLI (`wrangler deploy`), braucht Terminal
**Nachher:** Obsilo deployed per Cloudflare REST API, kein Terminal noetig

User-Flow:
1. Klickt Link → erstellt API Token bei Cloudflare (Browser, 2 Min)
2. Gibt Token in Obsilo Settings ein
3. Klickt "Deploy relay" → Obsilo deployt alles per API
4. Fertig -- URL wird automatisch angezeigt

## 2. Neue Datei: `src/mcp/CloudflareDeployer.ts`

Deployt den Relay-Worker per Cloudflare REST API.

```typescript
class CloudflareDeployer {
    constructor(private apiToken: string) {}

    async deploy(relaySecret: string): Promise<{ url: string; accountId: string }> {
        // 1. Account ID ermitteln
        const accountId = await this.getAccountId();

        // 2. Workers Subdomain ermitteln (fuer die URL)
        const subdomain = await this.getSubdomain(accountId);

        // 3. Worker-Code hochladen mit DO Bindings
        await this.uploadWorker(accountId, relaySecret);

        // 4. URL zusammenbauen
        return { url: `https://obsilo-relay.${subdomain}.workers.dev`, accountId };
    }

    private async getAccountId(): Promise<string>
    // GET https://api.cloudflare.com/client/v4/accounts
    // Header: Authorization: Bearer {apiToken}
    // Returns: accounts[0].id

    private async getSubdomain(accountId: string): Promise<string>
    // GET https://api.cloudflare.com/client/v4/accounts/{id}/workers/subdomain
    // Returns: subdomain (z.B. "username")

    private async uploadWorker(accountId: string, secret: string): Promise<void>
    // PUT https://api.cloudflare.com/client/v4/accounts/{id}/workers/scripts/obsilo-relay
    // Body: Multipart (metadata JSON + worker.js)
    // Metadata: { main_module: "worker.js", bindings: [DO + secret], migrations: [...] }

    // Dann: Secret setzen
    // PUT https://api.cloudflare.com/client/v4/accounts/{id}/workers/scripts/obsilo-relay/secrets
    // Body: { name: "RELAY_TOKEN", text: secret, type: "secret_text" }
}
```

Alle API-Calls via `requestUrl` (Obsidian API, Review-Bot-konform).

## 3. Worker-Code als eingebetteter String

Der Relay-Worker-Code (`relay/src/index.ts`) wird als kompilierter JS-String
im Plugin eingebettet. Bei "Deploy" wird dieser String an die Cloudflare API gesendet.

Der Build-Prozess:
1. `relay/src/index.ts` wird per esbuild zu einem einzelnen JS-File kompiliert
2. Dieses File wird als String-Konstante in `CloudflareDeployer.ts` eingebettet
3. Alternativ: zur Laufzeit aus einer mitgelieferten Datei gelesen

## 4. Settings UI Aenderung

Kein Wizard mit Terminal-Schritten mehr. Stattdessen:

```
Remote access (claude.ai, ChatGPT, Cursor)
  Enable remote access                              [Toggle]

  Cloudflare API token
  [Create token →] (Link mit vorbefuellten Permissions)
  [cfp_xxxxxxxxxxxxxxxxx]

  [Deploy relay]

  Status: Deployed ✓
  Relay URL: https://obsilo-relay.xxx.workers.dev    [Copy]

  Add this URL as connector in:
  - claude.ai: Settings > Connectors > Add
  - ChatGPT: Apps > Developer Mode > Connector
```

## 5. Settings-Felder

```typescript
enableRemoteRelay: boolean;          // default: false
cloudflareApiToken: string;          // SafeStorage encrypted
relayUrl: string;                    // auto-filled after deploy
relayToken: string;                  // auto-generated, SafeStorage encrypted
cloudflareAccountId: string;         // auto-detected
```

## 6. Implementierungsreihenfolge

1. Relay-Code kompilieren (esbuild → JS-String)
2. `CloudflareDeployer.ts` (REST API Calls)
3. Settings UI umbauen (kein Terminal-Wizard)
4. Testen: Deploy + WebSocket-Verbindung + E2E
