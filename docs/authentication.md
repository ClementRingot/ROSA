# Authentication

The server supports three authentication modes, auto-detected from environment variables. The same codebase handles all modes — no code changes or separate builds needed.

## Authentication Modes

| Mode | Trigger | Use case |
| --- | --- | --- |
| **Public** | No auth env vars | Railway, local dev, Docker public |
| **OIDC / OAuth 2.1** | `OAUTH_ISSUER` + `OAUTH_AUDIENCE` | Docker private (Keycloak, Entra ID, Auth0) |
| **XSUAA** | `VCAP_SERVICES` with xsuaa binding | SAP BTP Cloud Foundry |

Detection priority: XSUAA > OIDC > Public.

## Public Mode (No Auth)

Default when no authentication environment variables are set. All endpoints are open.

```bash
# Local
TRANSPORT=http node dist/index.js

# Docker
docker run --rm -p 3001:3001 sap-released-objects-server
```

Suitable for:
- Local development
- Public-facing instances serving read-only public data
- Behind a corporate VPN or firewall

## OIDC / OAuth 2.1 Mode

Activated by setting `OAUTH_ISSUER` and `OAUTH_AUDIENCE`. The server validates Bearer JWT tokens on `/mcp` and `/api` endpoints.

```bash
docker run --rm -p 3001:3001 \
  -e OAUTH_ISSUER=https://login.company.com/oauth \
  -e OAUTH_AUDIENCE=https://mcp.internal.company.com \
  sap-released-objects-server
```

### How it works

1. Client sends request to `/mcp` or `/api` without a token
2. Server responds with `401 Unauthorized` and `WWW-Authenticate: Bearer` header
3. MCP client (Claude Desktop, Claude Code) initiates OAuth 2.1 authorization flow
4. Client obtains access token from the Authorization Server
5. Client includes `Authorization: Bearer <token>` in subsequent requests
6. Server validates the JWT (signature, issuer, audience, expiry)

### Compatible Identity Providers

Any OAuth 2.1 / OIDC-compliant provider:
- Keycloak
- Microsoft Entra ID (Azure AD)
- Auth0
- Okta
- Google Identity Platform

### Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `OAUTH_ISSUER` | Yes | Authorization Server issuer URL (e.g., `https://login.company.com/oauth`) |
| `OAUTH_AUDIENCE` | Yes | Expected `aud` claim in JWT (e.g., `https://mcp.company.com`) |

## XSUAA Mode (SAP BTP)

Auto-detected when the app runs on Cloud Foundry with an XSUAA service binding. The `VCAP_SERVICES` environment variable (injected by CF) contains the XSUAA credentials.

This mode uses the `@arc-mcp/xsuaa-auth` library which implements:
- Full MCP OAuth 2.1 authorization flow proxy
- Stateless Dynamic Client Registration (DCR)
- OAuth callback proxy (fixes XSUAA's `+`-in-state encoding bug)
- JWT token verification against XSUAA JWKS

### How it works

1. MCP client connects to `/mcp`
2. Server responds with `401` and `WWW-Authenticate` pointing to Protected Resource Metadata
3. Client discovers the XSUAA Authorization Server via `/.well-known/oauth-protected-resource`
4. Client registers dynamically (stateless DCR) or uses pre-registered client ID
5. Client redirects user to XSUAA login page
6. After authentication, XSUAA redirects to `/oauth/callback` with authorization code
7. Client exchanges code for access token
8. All subsequent requests include `Authorization: Bearer <token>`

### Redirect URIs

The `xs-security.json` includes redirect URI patterns for common MCP clients:

| Pattern | Client |
| --- | --- |
| `http://localhost:*/**` | Local development, MCP Inspector |
| `https://*.hana.ondemand.com/**` | SAP Business Application Studio |
| `https://claude.ai/api/mcp/auth_callback` | Claude Desktop / Claude.ai |
| `cursor://anysphere.cursor-retrieval/**` | Cursor IDE |
| `vscode://vscode.microsoft-authentication/**` | VS Code |

### Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `VCAP_SERVICES` | Auto (CF) | Injected by Cloud Foundry with XSUAA binding |
| `DCR_SIGNING_SECRET` | Recommended | Stable secret for OAuth DCR + state codec. Generate with `openssl rand -base64 48`. Without this, a random secret is generated at startup (clients must re-register after restart). |
| `OAUTH_DCR_TTL_SECONDS` | Optional | DCR client registration lifetime. `0` = never expire. Default: 30 days. |

## API Key Authentication

API keys work alongside any mode (public, OIDC, or XSUAA). They provide a simple alternative for scripts and CI pipelines that can't perform OAuth flows.

```bash
# Set API keys (key:profile format, comma-separated)
docker run --rm -p 3001:3001 \
  -e API_KEYS="ci-key:viewer,admin-key:admin" \
  sap-released-objects-server
```

Usage:

```bash
curl -H "Authorization: Bearer ci-key" \
  http://localhost:3001/api/search?query=purchase+order
```

## Route Protection

| Route | Auth required | Notes |
| --- | --- | --- |
| `GET /health` | Never | Always public (load balancers, orchestrators) |
| `GET /.well-known/oauth-protected-resource` | Never | OAuth metadata discovery (only served when auth enabled) |
| `GET /authorize` | N/A | OAuth authorization endpoint (only when XSUAA) |
| `GET /oauth/callback` | N/A | OAuth callback proxy (only when XSUAA) |
| `POST /mcp` | When auth enabled | MCP protocol endpoint |
| `GET /api/*` | When auth enabled | REST API endpoints |

## CORS Configuration

For browser-based MCP clients (e.g., Claude.ai web), set allowed origins:

```bash
CORS_ALLOWED_ORIGINS=https://claude.ai,https://cursor.sh
```

When not set, the API router applies a permissive `Access-Control-Allow-Origin: *` header for GET requests.

## Rate Limiting

Rate limiting is always active, regardless of authentication mode:

| Endpoint | Default limit | Env var |
| --- | --- | --- |
| `/mcp` | 600 req/min | `MCP_RATE_LIMIT` |
| `/api/*` | 600 req/min | `API_RATE_LIMIT` |
| OAuth endpoints | 20 req/min | Built-in (via `@arc-mcp/xsuaa-auth`) |

## Security Headers

The server uses [Helmet](https://helmetjs.github.io/) for security headers:
- `X-Powered-By` disabled
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- Content Security Policy and Cross-Origin-Opener-Policy disabled (required for popup OAuth flows)
- `trust proxy` set to 1 (for Cloud Foundry GoRouter / reverse proxies)
