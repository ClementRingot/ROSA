---
"@rosa-mcp/server": patch
---

Upgrade @arc-mcp/xsuaa-auth to 1.2.0 for browser-bound OAuth client approval (GHSA-6935-r3wv-f646). Upgrade all instances together and restart in-flight sign-ins. Existing tokens are not revoked.

Node.js 22 or newer is required, including deployment and standalone executable builds.
