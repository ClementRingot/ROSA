# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From the next release onward, entries are maintained automatically by
[release-please](./docs/RELEASE.md).

## [Unreleased]

### Added

- **npm package** `@clementringot/rosa` — run via `npx @clementringot/rosa`
  (stdio by default); `--http` / `--port <n>` CLI flags for the HTTP server.
- **GitHub Packages** mirror of the npm package.
- **Multi-arch Docker image** on GHCR (`ghcr.io/clementringot/rosa`,
  `linux/amd64` + `linux/arm64`), tagged `{version}` / `{major}.{minor}` / `latest`.
- **Unified release workflow** — one tag publishes npm (npmjs via Trusted
  Publishing + GitHub Packages), the Docker image, and native executables with
  `SHA256SUMS.txt`, gated by an anti-drift version check.
- **Release train** via release-please, with version sync for `mta.yaml`.
- **npm-based Cloud Foundry / BTP deployment** wrapper (`deploy/btp-npm/`).
- **`scripts/sync-version.js`** wired to the npm `version` hook.
- **Documentation overhaul**: rewritten README with badges and a
  "Choose your deployment" table; new `docs/ARCHITECTURE.md`,
  `docs/DEPLOYMENT.md`, `docs/RELEASE.md`, and `docs/cloud-foundry-classic.md`;
  `CONTRIBUTING.md`.

### Changed

- **Rebrand** from `sap-released-objects-server` to **ROSA** across the runtime,
  infrastructure identifiers (XSUAA `xsappname`, MTA ID/module/resource, CF app
  name), and docs. The MCP server version is now sourced from `package.json`.
- Docker base images `node:20-alpine` → `node:22` (build) / `node:22-slim`
  (runtime) with a pure-node health check; CI runs on Node 22 and executes tests.
- Consolidated the previous per-topic docs into the new structure (no
  duplicates, no orphaned links).

## [1.12.6] - 2026-03-31

Baseline release prior to the changes above (native executables only). See the
[GitHub Releases](https://github.com/ClementRingot/ROSA/releases) for the full
history up to 1.12.6.

[Unreleased]: https://github.com/ClementRingot/ROSA/compare/v1.12.6...HEAD
[1.12.6]: https://github.com/ClementRingot/ROSA/releases/tag/v1.12.6
