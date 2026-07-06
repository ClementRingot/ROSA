# Classic Cloud Foundry (non-SAP BTP)

This guide covers deploying ROSA to a **standard, upstream Cloud Foundry
foundation** — e.g. a self-managed CF, a Tanzu Application Service, or any
provider that is *not* SAP BTP. The difference that matters: **there is no
managed `xsuaa` service** and **no MultiApps (MTA) deploy-service**, so the
XSUAA path does not apply. ROSA still runs unchanged, because its authentication
is config-driven.

> On SAP BTP Cloud Foundry, use the MTA / npm paths in
> [DEPLOYMENT.md](./DEPLOYMENT.md#sap-btp-cloud-foundry-two-paths) instead.

> ⚠️ **SAP Neo is not Cloud Foundry.** Neo uses a different runtime and
> buildpacks and is end-of-life; none of this applies there.

## What does *not* work outside SAP BTP

| Feature | Why it's unavailable |
| --- | --- |
| `mta.yaml` + `cf deploy` | The MultiApps Controller / deploy-service is an SAP BTP add-on. |
| Managed `xsuaa` service | XSUAA is an SAP BTP service; a generic CF marketplace doesn't offer it. |
| `xs-security.json` binding | Only meaningful with the `xsuaa` service. |

→ Deploy with plain **`cf push -f manifest.yml`**.

## What works with no code changes

The Node/Express app, `/health`, `/mcp` and `/api` all run as-is. Because auth is
config-driven, `loadXsuaaCredentials()` simply finds no `xsuaa` binding in
`VCAP_SERVICES` and the server falls back to **OIDC** or **public** automatically
— no rebuild, no flags.

## Deploy

The repo already ships a plain [`manifest.yml`](../manifest.yml). From the repo
root:

```bash
cf login -a https://api.<your-cf-foundation>
npm ci && npm run build     # or rely on the buildpack to build (npm run build)
cf push
```

`manifest.yml` sets `TRANSPORT=http`, the Node.js buildpack, 256M memory, and a
`/health` HTTP health check. CF injects `PORT` (usually 8080); the server reads
it automatically.

Verify:

```bash
cf app rosa
curl https://rosa.<your-cf-domain>/health   # → {"status":"ok","server":"rosa"}
```

## Authentication options on classic CF

### Public (default)

No auth env vars. Appropriate here because the data is public, read-only SAP
metadata — no credentials involved.

### OIDC / OAuth 2.1

Point ROSA at the platform's UAA or any external IdP (Entra ID, Auth0, Okta,
Keycloak, Google):

```bash
cf set-env rosa OAUTH_ISSUER  https://login.<your-idp>/oauth
cf set-env rosa OAUTH_AUDIENCE https://rosa.<your-cf-domain>
cf restage rosa
```

MCP clients with OAuth 2.1 support run the flow automatically. See
[ARCHITECTURE.md → OIDC](./ARCHITECTURE.md#oidc--oauth-21).

### API keys

Standalone, or alongside OIDC, for scripts / CI:

```bash
cf set-env rosa API_KEYS "ci-key:viewer,admin-key:admin"
cf restage rosa
curl -H "Authorization: Bearer ci-key" https://rosa.<your-cf-domain>/api/search?query=mara
```

## Alternative: push the Docker image

If the foundation runs Diego with Docker support enabled, skip the buildpack and
run the pre-built multi-arch GHCR image directly — a direct payoff of the image
published on every release:

```bash
cf push rosa --docker-image ghcr.io/clementringot/rosa:1.12.6
```

Set the same auth env vars (`OAUTH_ISSUER`/`OAUTH_AUDIENCE`, `API_KEYS`) with
`cf set-env` as above. For a private image, add
`--docker-username <user>` and set `CF_DOCKER_PASSWORD`.

## Troubleshooting

- **App won't start** — `cf logs rosa --recent`. The buildpack must run
  `npm run build`; ensure `dist/` is produced (or pre-build and push it).
- **Health check fails** — CF uses `PORT` (usually 8080), not 3001; test via
  `cf ssh rosa -c "curl -s http://localhost:8080/health"`.
- **Auth not taking effect** — env changes require `cf restage` (not just
  `cf restart`).
- **Expecting XSUAA** — you can't get XSUAA here; use OIDC against the platform
  UAA instead. XSUAA is BTP-only.
