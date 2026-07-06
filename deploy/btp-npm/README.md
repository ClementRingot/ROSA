# npm-based Cloud Foundry / SAP BTP deployment

Deploy ROSA to Cloud Foundry **without cloning the repo or building anything
locally**. This folder is a thin wrapper: it declares a pinned dependency on
[`@clementringot/rosa`](https://www.npmjs.com/package/@clementringot/rosa) and
lets the Node.js buildpack install it at staging.

## Deploy

```bash
cd deploy/btp-npm
cf push
```

The buildpack runs `npm install` (pulling `@clementringot/rosa` from npm), then
`npm start`, which launches the server in HTTP mode on the port CF injects.
Verify with `curl https://<app-route>/health` → `{"status":"ok","server":"rosa"}`.

## Update to a new version

Edit the pinned version in [`package.json`](./package.json) and push again:

```json
"@clementringot/rosa": "1.13.0"
```

```bash
cf push
```

## Authentication

- **Public** (default): no auth env vars — fine for public, read-only data.
- **OIDC**: set `OAUTH_ISSUER` + `OAUTH_AUDIENCE` (see `manifest.yml`).
- **XSUAA** (SAP BTP): pre-create the service from the repo's `xs-security.json`
  and bind it (see the commented `services:` block in `manifest.yml`).

## When to use this vs. the MTA / from-source path

| | npm wrapper (this folder) | MTA from source |
| --- | --- | --- |
| Push size | tiny (manifest + package.json) | full repo |
| Staging time | buildpack `npm install` | buildpack build + `mbt build` |
| Patch the code | no (consumes published npm) | yes |
| Managed XSUAA service | manual `cf create-service` + bind | automatic (MTA resource) |

See [`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) for the full comparison and
the from-source instructions.
