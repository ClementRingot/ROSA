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

The Railway deployment runs in **public mode** (no authentication). This is appropriate because:
- The data served is 100% public (SAP's GitHub repository)
- The server is read-only (no writes, no mutations)
- No credentials or secrets are involved

To add authentication, set `OAUTH_ISSUER` and `OAUTH_AUDIENCE` in Railway's environment variables. See [Authentication](./authentication.md).

## Monitoring

Railway provides built-in:
- **Logs** — real-time log streaming
- **Metrics** — CPU, memory, network
- **Health checks** — configure `/health` as the health check endpoint

## Cost

Railway's free tier is sufficient for low-traffic use. The server uses ~100-150 MB memory at runtime.
