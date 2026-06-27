# Configuration Reference

All configuration is done via environment variables. No configuration files are needed beyond `xs-security.json` (for BTP deployments).

## Core

| Variable | Default | Description |
| --- | --- | --- |
| `TRANSPORT` | `stdio` | Transport mode: `stdio` (MCP client) or `http` (HTTP server) |
| `PORT` | `3001` | HTTP server port (only used with `TRANSPORT=http`) |
| `NODE_ENV` | - | Set to `production` in Docker and CF deployments |

## Authentication

| Variable | Default | Mode | Description |
| --- | --- | --- | --- |
| `OAUTH_ISSUER` | - | OIDC | Authorization Server issuer URL. Setting this activates OIDC auth. |
| `OAUTH_AUDIENCE` | - | OIDC | Expected `aud` claim in JWT. Required when `OAUTH_ISSUER` is set. |
| `API_KEYS` | - | Any | API key authentication. Format: `key:profile,key2:profile2`. Works alongside OIDC or XSUAA. |
| `VCAP_SERVICES` | - | XSUAA | Auto-injected by Cloud Foundry. Contains XSUAA service binding. Setting this activates XSUAA auth. |
| `DCR_SIGNING_SECRET` | Random | XSUAA | Stable signing secret for OAuth DCR and state codec. Generate: `openssl rand -base64 48`. Without this, clients must re-register after each restart. |
| `OAUTH_DCR_TTL_SECONDS` | 2592000 (30d) | XSUAA | DCR client registration lifetime in seconds. `0` = never expire. |

## Rate Limiting

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_RATE_LIMIT` | `600` | Maximum requests per minute on `/mcp` |
| `API_RATE_LIMIT` | `600` | Maximum requests per minute on `/api/*` |

Rate limiting is always active. OAuth endpoints (`/authorize`, `/oauth/callback`) are limited to 20 req/min by the auth library.

## CORS

| Variable | Default | Description |
| --- | --- | --- |
| `CORS_ALLOWED_ORIGINS` | - | Comma-separated list of allowed origins for browser-based MCP clients. Example: `https://claude.ai,https://cursor.sh`. When not set, the API router uses `Access-Control-Allow-Origin: *`. |

## Auth Mode Detection

The server detects the authentication mode at startup using this priority:

```
1. VCAP_SERVICES has xsuaa binding?  → XSUAA mode
2. OAUTH_ISSUER set?                 → OIDC mode
3. Neither?                          → Public mode (no auth)

API_KEYS can be added alongside any mode.
```

## Examples

### Local Development (stdio)

```bash
npm start
# No env vars needed — stdio transport, no auth
```

### Local Development (HTTP)

```bash
TRANSPORT=http node dist/index.js
# Public access on http://localhost:3001
```

### Docker Public

```bash
docker run --rm -p 3001:3001 sap-released-objects-server
# TRANSPORT=http and PORT=3001 are set in Dockerfile
```

### Docker with OIDC (Keycloak)

```bash
docker run --rm -p 3001:3001 \
  -e OAUTH_ISSUER=https://keycloak.company.com/realms/myrealm \
  -e OAUTH_AUDIENCE=sap-released-objects \
  -e MCP_RATE_LIMIT=300 \
  sap-released-objects-server
```

### Docker with API Keys Only

```bash
docker run --rm -p 3001:3001 \
  -e API_KEYS="ci-pipeline:viewer,admin-tool:admin" \
  sap-released-objects-server
```

### BTP Cloud Foundry

Environment variables are set via `mta.yaml` properties and `cf set-env`:

```bash
cf set-env sap-released-objects-mcp DCR_SIGNING_SECRET "$(openssl rand -base64 48)"
cf set-env sap-released-objects-mcp OAUTH_DCR_TTL_SECONDS 0
cf set-env sap-released-objects-mcp MCP_RATE_LIMIT 300
cf restage sap-released-objects-mcp
```
