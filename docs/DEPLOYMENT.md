# Deployment guide

Every way to run ROSA, grouped by **how you get the code onto the target**.
Pick the row that matches you in the [deployment matrix](#deployment-matrix),
then jump to the section.

- [Deployment matrix](#deployment-matrix)
- [Build with npm](#build-with-npm) — `npx`, global install, project dependency
- [Build without npm](#build-without-npm) — native executables, pre-built Docker image
- [Build from source](#build-from-source) — clone, `npm ci`, Docker, `mbt build`
- [SAP BTP Cloud Foundry: two paths](#sap-btp-cloud-foundry-two-paths)
- [Node.js PaaS hosts](#nodejs-paas-hosts) (Railway, Render, Heroku, Fly.io…)
- [Configuration reference](#configuration-reference)
- [Verifying a running instance](#verifying-a-running-instance)
- [Troubleshooting](#troubleshooting)

> Transports and auth modes are explained in [ARCHITECTURE.md](./ARCHITECTURE.md).
> For a classic (non-BTP) Cloud Foundry foundation, see
> [cloud-foundry-classic.md](./cloud-foundry-classic.md).

## Deployment matrix

| I want to… | Use | Auth options | Section |
| --- | --- | --- | --- |
| Plug into Claude Desktop/Code/Cursor | npm (`npx`) | public (stdio) | [Build with npm](#build-with-npm) |
| Run without Node.js installed | Native executable | public (stdio) | [Build without npm](#build-without-npm) |
| Run as a server / self-host | Docker (GHCR image) | public · OIDC · API keys | [Build without npm](#build-without-npm) |
| Deploy on a generic Node host | Node PaaS | public · OIDC · API keys | [Node.js PaaS hosts](#nodejs-paas-hosts) |
| Deploy on SAP BTP Cloud Foundry | MTA (from source) or npm wrapper | public · OIDC · XSUAA · API keys | [Two paths](#sap-btp-cloud-foundry-two-paths) |
| Deploy on classic Cloud Foundry | `cf push` | public · OIDC · API keys | [cloud-foundry-classic.md](./cloud-foundry-classic.md) |
| Modify the code | Build from source | all | [Build from source](#build-from-source) |

---

## Build with npm

The package [`@clementringot/rosa`](https://www.npmjs.com/package/@clementringot/rosa)
starts in **stdio** mode by default — exactly what MCP clients expect.

**Prerequisites:** Node.js ≥ 20.

### npx (no install)

```bash
npx -y @clementringot/rosa
```

MCP client config (Claude Desktop / Claude Code / Cursor):

```json
{
  "mcpServers": {
    "rosa": {
      "command": "npx",
      "args": ["-y", "@clementringot/rosa"]
    }
  }
}
```

### Global install

```bash
npm install -g @clementringot/rosa
rosa            # stdio
rosa --http --port 3000   # HTTP server
```

### As a project dependency

```bash
npm install @clementringot/rosa
```

```jsonc
// package.json → "bin" is exposed as `rosa`; import path is the package root
```

> **GitHub Packages mirror.** The same version is published to
> `npm.pkg.github.com`. Installing from there requires authentication **even for
> a public package** — add a `.npmrc` with `@clementringot:registry=https://npm.pkg.github.com`
> and a `//npm.pkg.github.com/:_authToken=<token>`. **npmjs is the recommended
> channel** for end users; the GitHub mirror exists for org-internal consumers.

---

## Build without npm

No Node.js toolchain required on the target.

### Native executables

Download the executable for your platform from the
[Releases](https://github.com/ClementRingot/ROSA/releases/latest) page and verify
it against `SHA256SUMS.txt`:

| Platform | Asset |
| --- | --- |
| Windows | `rosa-win.exe` |
| Linux | `rosa-linux` |
| macOS | `rosa-macos` |

```json
{
  "mcpServers": {
    "rosa": {
      "command": "/path/to/rosa-linux"
    }
  }
}
```

The executable bundles Node.js and the abbreviation dictionary — nothing else to
install. It runs stdio by default; pass `--http` for the HTTP server.

### Pre-built Docker image (GHCR)

A multi-arch (`linux/amd64`, `linux/arm64`) image is published to GHCR on every
release. Docker = server usage, so the image runs the **HTTP** transport.

```bash
docker run --rm -p 3001:3001 ghcr.io/clementringot/rosa:latest
```

```bash
# Pin a version, custom port, OIDC auth
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e OAUTH_ISSUER=https://login.company.com/oauth \
  -e OAUTH_AUDIENCE=https://mcp.internal.company.com \
  ghcr.io/clementringot/rosa:1.12.6
```

Tags: `{version}` (e.g. `1.12.6`), `{major}.{minor}` (e.g. `1.12`), and `latest`.
The image runs as the non-root `node` user and ships a `HEALTHCHECK`.

---

## Build from source

For contributors and anyone who wants to modify the code. **Prerequisites:**
Node.js ≥ 20, npm ≥ 10.

```bash
git clone https://github.com/ClementRingot/ROSA.git
cd ROSA
npm ci
npm run build          # tsc → dist/
npm test               # vitest
```

Run it:

```bash
npm start              # stdio
npm run start:http     # HTTP (node dist/index.js --http)
# Windows equivalent:
set TRANSPORT=http && node dist/index.js
```

Useful checks against a running HTTP instance:

```bash
curl http://localhost:3001/api                       # auto-documentation
curl "http://localhost:3001/api/search?query=purchase+order"
curl "http://localhost:3001/api/compliance?object_names=MARA,BSEG,I_PRODUCT"
```

### Build the Docker image yourself

```bash
docker build -t rosa .
docker run --rm -p 3001:3001 rosa
```

Multi-arch build (as CI does):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t myregistry/rosa:latest --push .
```

### Build native executables

```bash
npm run pkg:all        # → bin/rosa-win.exe, bin/rosa-linux, bin/rosa-macos
```

Pipeline: `TypeScript → tsc → ESM → esbuild (single CJS bundle) → @yao-pkg/pkg → native binary`.

### docker-compose with Keycloak (OIDC test)

```yaml
services:
  rosa:
    build: .            # or image: ghcr.io/clementringot/rosa:latest
    ports:
      - "3001:3001"
    environment:
      TRANSPORT: http
      OAUTH_ISSUER: http://keycloak:8080/realms/myrealm
      OAUTH_AUDIENCE: rosa
    depends_on:
      keycloak:
        condition: service_healthy
  keycloak:
    image: quay.io/keycloak/keycloak:26
    command: start-dev
    ports: ["8080:8080"]
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080"]
      interval: 10s
      timeout: 5s
      retries: 5
```

---

## SAP BTP Cloud Foundry: two paths

ROSA offers two ways onto SAP BTP Cloud Foundry. Both end up running the same
server with auto-detected XSUAA auth; they differ in what you push.

| | **npm wrapper** ([`deploy/btp-npm/`](../deploy/btp-npm/)) | **MTA from source** |
| --- | --- | --- |
| What you push | manifest + tiny `package.json` | the full repo (or built MTA archive) |
| Staging | buildpack runs `npm install @clementringot/rosa` | buildpack build + `mbt build` |
| Push size / speed | tiny / fast | large / slower |
| Patch the code | ✖ (consumes published npm) | ✅ |
| Managed XSUAA service | manual `cf create-service` + bind | ✅ automatic (MTA resource) |
| Best for | fast, reproducible deploys of a released version | development, XSUAA out of the box |

### Path A — npm wrapper (lightweight)

```bash
cd deploy/btp-npm
cf push
```

The Node.js buildpack installs `@clementringot/rosa` from npm and starts it in
HTTP mode. Bump the pinned version in `deploy/btp-npm/package.json` and
`cf push` again to upgrade. For XSUAA, pre-create the service and bind it (see
the commented block in `deploy/btp-npm/manifest.yml`). Full notes:
[`deploy/btp-npm/README.md`](../deploy/btp-npm/README.md).

### Path B — MTA from source (XSUAA managed)

**Prerequisites:** [CF CLI](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html),
[MBT](https://sap.github.io/cloud-mta-build-tool/), the multiapps plugin
(`cf install-plugin multiapps`), and a BTP subaccount with CF enabled.

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
mbt build
cf deploy mta_archives/*.mtar
```

This creates the XSUAA service instance (`rosa-xsuaa`) from `xs-security.json`,
deploys the Node.js module (`rosa`), binds the service, and starts the app with
HTTP transport + `/health` check. Authentication is then auto-detected from
`VCAP_SERVICES`.

**Recommended post-deploy** — a stable DCR secret so OAuth clients survive
restarts:

```bash
cf set-env rosa DCR_SIGNING_SECRET "$(openssl rand -base64 48)"
cf restage rosa
```

**Per-landscape overrides** (host, secret, rate limits, xsappname):

```bash
cp mta-overrides.mtaext.example mta-overrides-dev.mtaext
# edit, then:
cf deploy mta_archives/*.mtar -e mta-overrides-dev.mtaext
```

MCP client config (the client runs the XSUAA OAuth flow automatically):

```json
{
  "mcpServers": {
    "rosa": {
      "type": "url",
      "url": "https://rosa.cfapps.<region>.hana.ondemand.com/mcp"
    }
  }
}
```

### Calling the REST API on BTP (machine-to-machine)

With XSUAA, **`/api` is protected exactly like `/mcp`** — a plain `curl` without
credentials returns `401`. The interactive OAuth 2.1 flow (Protected Resource
Metadata → DCR → `/authorize` → `/oauth/callback`) is meant for **MCP clients**,
which run it automatically. A **script or CI job** calling the REST API directly
can't do that flow, so use one of these non-interactive options instead
(`/health` stays public in all cases).

**Option 1 — API key (simplest).** API keys work alongside XSUAA:

```bash
cf set-env rosa API_KEYS "ci-key:viewer,admin-key:admin"
cf restage rosa

curl -H "Authorization: Bearer ci-key" \
  https://rosa.cfapps.<region>.hana.ondemand.com/api/search?query=mara
```

**Option 2 — XSUAA client-credentials token (technical user).** Mint a token from
the bound XSUAA instance and send it as a bearer token:

```bash
# 1. Get the technical credentials of the bound XSUAA instance
cf create-service-key rosa-xsuaa rosa-key
cf service-key rosa-xsuaa rosa-key      # → clientid, clientsecret, url

# 2. Exchange them for an access token (client-credentials grant)
TOKEN=$(curl -s -X POST "$XSUAA_URL/oauth/token" \
  -u "$CLIENTID:$CLIENTSECRET" \
  -d grant_type=client_credentials | jq -r .access_token)

# 3. Call the API
curl -H "Authorization: Bearer $TOKEN" \
  https://rosa.cfapps.<region>.hana.ondemand.com/api/search?query=mara
```

ROSA's `xs-security.json` declares **no scopes or role-templates** (it is
authentication-only), so a client-credentials token from the **bound** XSUAA
instance validates directly — no role collection to assign. The token must be
issued by *that* instance; a token from a different XSUAA instance will fail the
audience check.

> **From another BTP app?** Front ROSA with an SAP BTP **Destination**
> (`OAuth2ClientCredentials`): the Destination service injects the token, so the
> consuming app — or an LLM skill running on BTP — calls the destination-resolved
> URL and performs no authentication itself.

---

## Node.js PaaS hosts

Any platform that runs `npm run build` + `npm start` works out of the box. The
one required setting is `TRANSPORT=http`; `PORT` is injected by the platform.

| Platform | Setup |
| --- | --- |
| **Railway** | Connect repo → set `TRANSPORT=http` → auto-detects Node.js |
| **Render** | New Web Service → build `npm run build`, start `npm start` → `TRANSPORT=http` |
| **Heroku** | `heroku create` → `heroku config:set TRANSPORT=http NODE_ENV=production` → `git push heroku main` |
| **Fly.io** | `fly launch` → `TRANSPORT=http` in `fly.toml [env]`, `internal_port = 3001`, health check `/health` → `fly deploy` |
| **DigitalOcean / Coolify** | Connect repo → `TRANSPORT=http`, health check `/health` |

Add `OAUTH_ISSUER` + `OAUTH_AUDIENCE` to switch any of them to OIDC — no rebuild.
Resource footprint is small: ~100–150 MB RAM, minimal CPU, no disk at runtime
(all data fetched from GitHub and cached 24h).

For a fully hosted, zero-setup option, point your client at an existing public
instance's `/mcp` URL (public, read-only).

---

## Configuration reference

All configuration is via environment variables (plus `xs-security.json` for BTP).
CLI equivalents exist for the two core settings: `--http` (⇔ `TRANSPORT=http`)
and `--port <n>` (⇔ `PORT`).

### Core

| Variable | Default | Description |
| --- | --- | --- |
| `TRANSPORT` | `stdio` | `stdio` (MCP client) or `http` (HTTP server). Also `--http`. |
| `PORT` | `3001` | HTTP port (HTTP transport only). Also `--port`. |
| `NODE_ENV` | – | Set to `production` in Docker / CF. |

### Authentication

| Variable | Mode | Description |
| --- | --- | --- |
| `OAUTH_ISSUER` | OIDC | Authorization Server issuer URL. Setting it activates OIDC. |
| `OAUTH_AUDIENCE` | OIDC | Expected `aud` claim. **Required** when `OAUTH_ISSUER` is set. |
| `API_KEYS` | Any | `key:profile,key2:profile2`. Works alongside OIDC/XSUAA. |
| `VCAP_SERVICES` | XSUAA | Auto-injected by CF; an `xsuaa` binding activates XSUAA. |
| `DCR_SIGNING_SECRET` | XSUAA | Stable DCR + state-codec secret (`openssl rand -base64 48`). Without it, clients must re-register after each restart. |
| `OAUTH_DCR_TTL_SECONDS` | XSUAA | DCR client lifetime in seconds. `0` = never expire. Default 2592000 (30d). |
| `CORS_ALLOWED_ORIGINS` | Any | Comma-separated origins for browser clients. Unset → `Access-Control-Allow-Origin: *` for GETs. |

### Rate limiting

| Variable | Default | Description |
| --- | --- | --- |
| `MCP_RATE_LIMIT` | `600` | `/mcp` requests per minute |
| `API_RATE_LIMIT` | `600` | `/api/*` requests per minute |

OAuth endpoints are fixed at 20 req/min by `@arc-mcp/xsuaa-auth`.

---

## Verifying a running instance

```bash
# Health (always public)
curl https://<host>/health           # → {"status":"ok","server":"rosa"}

# REST API smoke test
curl "https://<host>/api/search?query=mara"

# MCP handshake (stdio)
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}' \
  | rosa
# → serverInfo {"name":"rosa","version":"…"}
```

On Cloud Foundry, CF assigns the port via `PORT` (usually 8080), not 3001:

```bash
cf app rosa
cf logs rosa --recent
cf ssh rosa -c "curl -s http://localhost:8080/health"
```

## Troubleshooting

### Auth

- **401 on every request** — auth is on but no Bearer token is sent. Confirm the
  MCP client supports OAuth 2.1 (Claude Desktop/Code do) and that
  `GET /.well-known/oauth-protected-resource` returns metadata. For REST, use an
  API key: `curl -H "Authorization: Bearer <key>" …`.
- **`OAUTH_AUDIENCE is required when OAUTH_ISSUER is set`** — set both variables.
- **OIDC token rejected** — check issuer matches `OAUTH_ISSUER` exactly (trailing
  slashes matter), `aud` matches `OAUTH_AUDIENCE`, token not expired, and the
  server can reach the JWKS endpoint (DNS/proxy/firewall).
- **XSUAA "clients must re-register after restart"** — set a stable
  `DCR_SIGNING_SECRET` and `cf restage rosa`.
- **XSUAA `redirect_uri` mismatch** — add the client's callback pattern to
  `xs-security.json` and redeploy.

### Cloud Foundry

- **App crashes on startup** — `cf logs rosa --recent`. Common causes: missing
  XSUAA binding (`cf services`), out of memory (raise `memory` in `mta.yaml`),
  TypeScript not compiled (ensure `mbt build` succeeded).
- **XSUAA service creation fails** — `xsappname` conflicts with another app in
  the subaccount; override it in an MTA extension (`config.xsappname`).
- **"No XSUAA binding found"** — `cf env rosa | grep -A5 xsuaa`; if empty,
  redeploy with `cf deploy` (not `cf push`).
- **Health check fails** — CF uses `PORT` (usually 8080), not 3001; test with
  `cf ssh rosa -c "curl -s http://localhost:8080/health"`.

### Docker

- **`COPY failed: file not found`** — build from the repo root; the Dockerfile
  needs `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, and
  `sap_abbreviation_dictionary.json`.
- **Container exits immediately** — `docker logs <id>`. Usually a port conflict
  (`-e PORT=3002 -p 3002:3002`) or a missing env var.

### Rate limiting / CORS / data

- **429 Too Many Requests** — raise `MCP_RATE_LIMIT` / `API_RATE_LIMIT`, or wait
  for the 1-minute window to reset.
- **CORS blocked** — set `CORS_ALLOWED_ORIGINS=https://claude.ai,…`.
- **Search returns nothing** — first request loads data from GitHub (wait a few
  seconds); check `system_type` (BTP has a smaller catalogue than public_cloud).
- **Stale data** — data is cached 24h; restart to force a refresh
  (`docker restart <id>` / `cf restart rosa`).
