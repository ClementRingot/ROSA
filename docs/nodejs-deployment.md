# Node.js Deployment (Generic)

This guide covers deploying to **any Node.js hosting platform** that supports buildpack-style deployments (auto-detect, `npm run build`, `npm start`). This includes Railway, Render, Heroku, Fly.io, Coolify, DigitalOcean App Platform, and others.

For platform-specific details, see also: [Railway](./railway-deployment.md) | [Docker](./docker-deployment.md) | [BTP Cloud Foundry](./btp-deployment.md)

## Requirements

The server needs:
- **Node.js 20+**
- **npm 10+**
- Two commands: `npm run build` (compile TypeScript) and `npm start` (run `node dist/index.js`)
- One mandatory environment variable: `TRANSPORT=http`

Most platforms detect Node.js automatically from `package.json` and run these commands without configuration.

## Environment Variables

### Minimum (public mode)

| Variable | Value | Notes |
| --- | --- | --- |
| `TRANSPORT` | `http` | **Required** — switches from stdio to HTTP server |
| `PORT` | *(auto-injected)* | Most platforms inject this automatically |
| `NODE_ENV` | `production` | Recommended |

### With OAuth 2.1 (private mode)

| Variable | Value | Notes |
| --- | --- | --- |
| `TRANSPORT` | `http` | Required |
| `OAUTH_ISSUER` | `https://auth.company.com/realms/prod` | OIDC provider URL |
| `OAUTH_AUDIENCE` | `sap-released-objects` | Expected `aud` claim in JWT |

### Optional

| Variable | Default | Description |
| --- | --- | --- |
| `API_KEYS` | - | API key auth (`key:profile` format, comma-separated) |
| `MCP_RATE_LIMIT` | `600` | `/mcp` requests per minute |
| `API_RATE_LIMIT` | `600` | `/api` requests per minute |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated allowed origins |

See [Configuration Reference](./configuration-reference.md) for the full list.

## Platform Setup

### Railway

1. Connect GitHub repo
2. Railway auto-detects Node.js
3. Set `TRANSPORT=http` in dashboard (Settings > Variables)
4. Deploy

See [Railway Deployment](./railway-deployment.md) for full details.

### Render

1. New Web Service → connect GitHub repo
2. Render auto-detects Node.js
3. Build Command: `npm run build` (auto-detected)
4. Start Command: `npm start` (auto-detected)
5. Add environment variable: `TRANSPORT=http`

### Heroku

```bash
heroku create my-sap-released-objects
heroku config:set TRANSPORT=http NODE_ENV=production
git push heroku main
```

Heroku detects `package.json`, runs `npm run build` (via `build` script), then `npm start`.

### Fly.io

```bash
fly launch
```

Edit `fly.toml`:

```toml
[env]
  TRANSPORT = "http"
  NODE_ENV = "production"

[http_service]
  internal_port = 3001

[[services.http_checks]]
  path = "/health"
```

```bash
fly deploy
```

### DigitalOcean App Platform

1. New App → connect GitHub repo
2. Component type: Web Service
3. Build Command: `npm run build`
4. Run Command: `npm start`
5. Add env var: `TRANSPORT=http`
6. Health check path: `/health`

### Coolify

1. New Resource → connect GitHub repo
2. Build pack: Nixpacks (auto-detects Node.js)
3. Add env var: `TRANSPORT=http`
4. Health check path: `/health`

## Endpoints

Once deployed, the server exposes:

| Endpoint | Description |
| --- | --- |
| `POST /mcp` | MCP protocol (for AI agents) |
| `GET /api/*` | REST API (for scripts, integrations) |
| `GET /health` | Health check (always public, even with auth) |
| `GET /api` | API auto-documentation |

## MCP Client Configuration

```json
{
  "mcpServers": {
    "sap-released-objects": {
      "type": "url",
      "url": "https://your-deployed-instance.example.com/mcp"
    }
  }
}
```

No additional config needed. If OAuth is enabled, MCP clients with OAuth 2.1 support (Claude Desktop, Claude Code, Cursor) handle the authorization flow automatically.

## Adding OAuth 2.1

On any platform, set `OAUTH_ISSUER` and `OAUTH_AUDIENCE` in the environment variables. No code change, no rebuild needed — the server detects OIDC mode at startup.

**Compatible providers:** Keycloak, Microsoft Entra ID (Azure AD), Auth0, Okta, Google Identity Platform — any OIDC-compliant provider exposing a `.well-known/openid-configuration`.

**Flow:**
1. MCP client connects to `/mcp`
2. Server responds `401 Unauthorized` with `WWW-Authenticate: Bearer`
3. Client initiates OAuth 2.1 authorization flow with the OIDC provider
4. Client obtains access token and includes it in subsequent requests
5. Server validates JWT (signature, issuer, audience, expiry)

See [Authentication](./authentication.md) for full details.

## Health Checks

Configure your platform's health check to `GET /health`. This endpoint:
- Always returns `200 OK` with `{"status":"ok"}`
- Is always public (never requires auth)
- Responds in < 1ms

## Resource Usage

The server is lightweight:
- **Memory:** ~100-150 MB at runtime (data cache ~2-5 MB per system type)
- **CPU:** Minimal (no background processing, no WebSockets)
- **Disk:** Not used at runtime (all data fetched from GitHub and cached in memory)
- **Network:** Initial data fetch from GitHub on first request, then cached for 24 hours

Most platforms' free or starter tiers are sufficient for low-to-medium traffic.

## Docker vs Buildpack

Both approaches work. Choose based on your needs:

| | Buildpack (this guide) | Docker |
| --- | --- | --- |
| **Setup** | Connect repo, set env vars | Build image, push to registry |
| **Build** | Platform handles it | You control the Dockerfile |
| **Portability** | Platform-specific | Runs anywhere with Docker |
| **Use case** | Quick deployment, PaaS | Full control, Kubernetes, air-gapped |

See [Docker Deployment](./docker-deployment.md) for container-based deployments.
