# Railway Deployment

[Railway](https://railway.app) is the simplest deployment option — no Docker, no CF CLI, no build tools.

## Setup

1. Connect your GitHub repository to Railway
2. Railway auto-detects the Node.js project
3. Set environment variables in the Railway dashboard

## Environment Variables

Set these in the Railway dashboard (Settings > Variables):

| Variable | Value |
| --- | --- |
| `TRANSPORT` | `http` |
| `PORT` | Set by Railway automatically |
| `NODE_ENV` | `production` |

Railway injects `PORT` automatically. The server reads it from `process.env.PORT`.

## Build & Start

Railway runs these commands automatically (from `package.json`):

- **Build:** `npm run build` (compiles TypeScript)
- **Start:** `npm start` (runs `node dist/index.js`)

## Public URL

Railway provides a public URL like:

```
https://sap-released-objects-server-production.up.railway.app
```

This URL is used for:
- MCP endpoint: `https://...railway.app/mcp`
- REST API: `https://...railway.app/api`
- Health check: `https://...railway.app/health`

## MCP Client Configuration

```json
{
  "mcpServers": {
    "sap-released-objects": {
      "type": "url",
      "url": "https://sap-released-objects-server-production.up.railway.app/mcp"
    }
  }
}
```

## Authentication

### Public Mode (default)

The Railway deployment runs in **public mode** (no authentication). This is appropriate because:
- The data served is 100% public (SAP's GitHub repository)
- The server is read-only (no writes, no mutations)
- No credentials or secrets are involved

### OAuth 2.1 Mode (private deployment)

For enterprise deployments requiring authentication, add OIDC variables in the Railway dashboard (Settings > Variables):

| Variable | Value |
| --- | --- |
| `OAUTH_ISSUER` | Your OIDC provider URL (e.g., `https://login.company.com/realms/prod`) |
| `OAUTH_AUDIENCE` | Resource identifier (e.g., `sap-released-objects`) |

The server detects `OAUTH_ISSUER` at startup and switches to OIDC mode automatically. No code change, no rebuild.

**Compatible providers:** Keycloak, Microsoft Entra ID (Azure AD), Auth0, Okta, Google Identity Platform — any OIDC-compliant provider.

**MCP client config (with auth):**

```json
{
  "mcpServers": {
    "sap-released-objects": {
      "type": "url",
      "url": "https://your-railway-instance.up.railway.app/mcp"
    }
  }
}
```

MCP clients with OAuth 2.1 support (Claude Desktop, Claude Code, Cursor) handle the authorization flow automatically — no token management needed on the client side.

### API Keys (optional)

For scripts or CI pipelines that can't perform OAuth flows, add API keys:

| Variable | Value |
| --- | --- |
| `API_KEYS` | `my-ci-key:viewer,admin-key:admin` |

```bash
curl -H "Authorization: Bearer my-ci-key" \
  https://your-railway-instance.up.railway.app/api/search?query=purchase+order
```

API keys work alongside both public and OAuth modes.

See [Authentication](./authentication.md) for full details.

## Monitoring

Railway provides built-in:
- **Logs** — real-time log streaming
- **Metrics** — CPU, memory, network
- **Health checks** — configure `/health` as the health check endpoint

## Cost

Railway's free tier is sufficient for low-traffic use. The server uses ~100-150 MB memory at runtime.
