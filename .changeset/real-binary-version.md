---
"@rosa-mcp/server": patch
---

Report the real version from the native executables and the esbuild bundle. The
version is now injected at build time (esbuild `define`) instead of falling back
to a stale hard-coded literal, so `node bundle/index.cjs` and the published
binaries no longer report an outdated version.
