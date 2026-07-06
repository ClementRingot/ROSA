# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From the next release onward, entries are maintained automatically by
[release-please](./docs/RELEASE.md).

## [1.14.0](https://github.com/ClementRingot/ROSA/compare/v1.13.2...v1.14.0) (2026-07-06)


### Features

* publish as @rosa-mcp/server on npmjs ([b8c5bf4](https://github.com/ClementRingot/ROSA/commit/b8c5bf4cdadebbf40d93efdd21ed6c97459c39e6))

## [1.13.2](https://github.com/ClementRingot/ROSA/compare/v1.13.1...v1.13.2) (2026-07-06)


### Bug Fixes

* **ci:** use explicit --output in pkg:all to produce rosa-* filenames ([45f9261](https://github.com/ClementRingot/ROSA/commit/45f92617c6deb8563ededf8d0ae8bfa4d436a9b2))

## [1.13.1](https://github.com/ClementRingot/ROSA/compare/v1.13.0...v1.13.1) (2026-07-06)


### Bug Fixes

* rename npm package to @rosa-mcp/server ([54a2bb5](https://github.com/ClementRingot/ROSA/commit/54a2bb576535c3ab9a1a2b49cefd71f958a4507d))
* rename npm package to @rosa-mcp/server ([a85fd26](https://github.com/ClementRingot/ROSA/commit/a85fd26eb711d0d65082d1b97f793774083b1f04))
* resolve merge conflict - keep @rosa-mcp/server name with v1.13.0 ([0d91c7f](https://github.com/ClementRingot/ROSA/commit/0d91c7ff672869bf1a26f427d4edb8d359793835))

## [1.13.0](https://github.com/ClementRingot/ROSA/compare/v1.12.6...v1.13.0) (2026-07-06)


### Features

* add Docker, BTP/MTA deployment, OAuth 2.1 auth, and documentation ([#4](https://github.com/ClementRingot/ROSA/issues/4)) ([da9a577](https://github.com/ClementRingot/ROSA/commit/da9a5778707369bc46d50c9e815e566c93a48fdc))
* add npm-based Cloud Foundry / BTP deployment wrapper ([b5fae0d](https://github.com/ClementRingot/ROSA/commit/b5fae0d21d92346e4d77a65f7497a72d348cf98f))
* rebrand to ROSA and ship as scoped npm package @clementringot/rosa ([51d4beb](https://github.com/ClementRingot/ROSA/commit/51d4bebb60000ab462bf1ce9eb37a61a33747d5e))
* ROSA rebrand, npm package, unified release pipeline & docs overhaul ([2ff6ca4](https://github.com/ClementRingot/ROSA/commit/2ff6ca49a838e06bb47af9b6f8c3855684e0a8b8))

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
- **Self-hosted REST skill template** (`skills/rosa-global/`) with a
  configurable `ROSA_BASE_URL`, alongside the turnkey public skill
  (`skills/sap-released-objects/`) that targets the hosted instance.
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
