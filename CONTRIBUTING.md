# Contributing

Thanks for your interest in improving ROSA! This is a small, single-package
TypeScript project — here's the short version.

## Development setup

**Requirements:** Node.js ≥ 20, npm ≥ 10.

```bash
git clone https://github.com/ClementRingot/ROSA.git
cd ROSA
npm ci
npm run build      # tsc → dist/
npm run dev        # watch mode
```

## Running & testing

```bash
npm start          # stdio transport (MCP clients)
npm run start:http # HTTP transport on :3001
npm test           # vitest (run once)
npm run test:watch # vitest (watch)
```

Tests live next to their sources as `*.test.ts`. Please add or update tests for
any behavior change. Keep `npm run build` and `npm test` green before opening a
PR.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for build/run details and
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for how the pieces fit together.

## Commit convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) —
the release train ([release-please](./docs/RELEASE.md)) derives the next version
and the changelog from them:

- `feat:` → minor release
- `fix:` → patch release
- `feat!:` or a `BREAKING CHANGE:` footer → major release
- `docs:`, `ci:`, `chore:`, `refactor:`, `test:` → no release on their own

Example: `feat: add --port flag to the HTTP transport`

## Pull requests

1. Branch off `main` (e.g. `feat/<short-topic>`).
2. Keep changes focused; update docs and tests alongside code.
3. Ensure `npm run build` and `npm test` pass.
4. Open the PR against `main` with a clear description and a Conventional-Commit
   title. CI must be green to merge.

Maintainers: releases are handled by the [release train](./docs/RELEASE.md) — no
manual publishing needed for the common case.
