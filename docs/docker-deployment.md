# Docker Deployment

## Building the Image

```bash
docker build -t sap-released-objects-server .
```

The Dockerfile uses a multi-stage build:

1. **Build stage** (node:20-alpine): installs dependencies, compiles TypeScript, prunes dev dependencies
2. **Runtime stage** (node:20-alpine): copies only production artifacts (dist, node_modules, dictionary)

The resulting image is ~150 MB with only production dependencies.

## Running

### Public Mode (no authentication)

```bash
docker run --rm -p 3001:3001 sap-released-objects-server
```

Endpoints:
- MCP: `http://localhost:3001/mcp`
- REST API: `http://localhost:3001/api`
- Health: `http://localhost:3001/health`

### Custom Port

```bash
docker run --rm -e PORT=8080 -p 8080:8080 sap-released-objects-server
```

### Private Mode (OAuth 2.1)

```bash
docker run --rm -p 3001:3001 \
  -e OAUTH_ISSUER=https://login.company.com/oauth \
  -e OAUTH_AUDIENCE=https://mcp.internal.company.com \
  sap-released-objects-server
```

See [Authentication](./authentication.md) for details on OIDC configuration.

### With API Keys

```bash
docker run --rm -p 3001:3001 \
  -e API_KEYS="my-key:admin" \
  sap-released-objects-server
```

### With Rate Limiting

```bash
docker run --rm -p 3001:3001 \
  -e MCP_RATE_LIMIT=100 \
  -e API_RATE_LIMIT=200 \
  sap-released-objects-server
```

## Docker Compose

### Simple (public)

```yaml
services:
  sap-released-objects:
    build: .
    ports:
      - "3001:3001"
    restart: unless-stopped
```

### With Keycloak (private)

```yaml
services:
  sap-released-objects:
    build: .
    ports:
      - "3001:3001"
    environment:
      TRANSPORT: http
      OAUTH_ISSUER: http://keycloak:8080/realms/myrealm
      OAUTH_AUDIENCE: sap-released-objects
    depends_on:
      keycloak:
        condition: service_healthy

  keycloak:
    image: quay.io/keycloak/keycloak:26
    ports:
      - "8080:8080"
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    command: start-dev
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Security Features

### Non-root User

The container runs as the `node` user (UID 1000), not root. All files are owned by `node:node`.

### Health Check

The Dockerfile includes a `HEALTHCHECK` instruction:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --spider -q http://localhost:3001/health || exit 1
```

Container orchestrators (Docker Compose, Kubernetes, ECS) use this to monitor container health.

### .dockerignore

The `.dockerignore` file excludes unnecessary files from the build context:
- `.git/`, `.github/`
- `node_modules/`, `dist/`, `bundle/`, `bin/`
- `*.exe`
- Documentation and config files

This keeps the build context small and the build fast.

## Multi-Architecture Builds

To build for multiple architectures (e.g., amd64 + arm64):

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t myregistry/sap-released-objects-server:latest \
  --push .
```

## Environment Variables

See [Configuration Reference](./configuration-reference.md) for the full list.

| Variable | Default | Description |
| --- | --- | --- |
| `TRANSPORT` | `stdio` | Set to `http` (already set in Dockerfile) |
| `PORT` | `3001` | HTTP server port |
| `NODE_ENV` | `production` | Already set in Dockerfile |
| `OAUTH_ISSUER` | - | Enables OIDC auth |
| `OAUTH_AUDIENCE` | - | Required with OAUTH_ISSUER |
| `API_KEYS` | - | API key auth (key:profile format) |
| `MCP_RATE_LIMIT` | `600` | /mcp rate limit per minute |
| `API_RATE_LIMIT` | `600` | /api rate limit per minute |
