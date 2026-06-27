# Local Development

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
git clone https://github.com/ClementRingot/sap-released-objects-server.git
cd sap-released-objects-server
npm install
```

## Build

```bash
npm run build          # Compile TypeScript → dist/
npm run dev            # Watch mode (recompiles on change)
```

## Run

### Stdio Mode (MCP client)

```bash
npm start
```

The server reads from stdin and writes to stdout. Connect it to an MCP client:

```json
{
  "mcpServers": {
    "sap-released-objects": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/sap-released-objects-server/dist/index.js"]
    }
  }
}
```

### HTTP Mode

```bash
npm run start:http
```

Or on Windows (where `TRANSPORT=http` syntax doesn't work):

```bash
set TRANSPORT=http && node dist/index.js
```

Server starts on `http://localhost:3001` with endpoints:
- `POST /mcp` — MCP protocol
- `GET /api/*` — REST API
- `GET /health` — Health check

### With OIDC Auth (testing)

Create a `.env` file (not committed):

```env
TRANSPORT=http
OAUTH_ISSUER=https://your-keycloak.example.com/realms/test
OAUTH_AUDIENCE=sap-released-objects
```

Then:

```bash
npm run build
node -e "require('dotenv').config()" dist/index.js
```

Or install `dotenv-cli`:

```bash
npx dotenv-cli -- node dist/index.js
```

## Tests

```bash
npm test               # Run all tests once
npm run test:watch     # Watch mode (re-runs on change)
```

Test files follow the `*.test.ts` convention next to the source files:

| Test file | Coverage |
| --- | --- |
| `src/constants.test.ts` | URL generation, state-to-level mapping |
| `src/services/data-loader.test.ts` | GitHub data fetching, caching, normalization |
| `src/services/search.test.ts` | Tokenization, scoring, relevance ranking |
| `src/services/abbreviation-dictionary.test.ts` | SAP abbreviation expansion |
| `src/tools/register-tools.test.ts` | MCP tool registration |
| `src/middleware/oauth.test.ts` | Auth mode detection, config wiring |

## Project Structure

```
src/
├── index.ts                    # Entry point
├── types.ts                    # Type definitions
├── constants.ts                # URLs, mappings
├── middleware/
│   ├── oauth.ts                # Auth middleware
│   └── oauth.test.ts
├── handlers/
│   └── api-handlers.ts         # Shared business logic
├── routes/
│   └── api-routes.ts           # REST endpoints
├── services/
│   ├── data-loader.ts          # GitHub fetch + cache
│   ├── search.ts               # Search + scoring
│   └── abbreviation-dictionary.ts
├── tools/
│   └── register-tools.ts       # MCP tools
└── schemas/
    └── common.ts               # Zod schemas
```

## Building Executables

For standalone executables (no Node.js required):

```bash
npm run pkg:win        # Windows .exe
npm run pkg:linux      # Linux binary
npm run pkg:macos      # macOS binary
npm run pkg:all        # All platforms
```

Pipeline: `TypeScript → tsc → ESM → esbuild (CJS bundle) → pkg (native binary)`

## Useful Commands

```bash
# Check which SAP object types exist
curl http://localhost:3001/api/types

# Search for purchase order objects
curl "http://localhost:3001/api/search?query=purchase+order"

# Check MARA compliance
curl "http://localhost:3001/api/compliance?object_names=MARA,BSEG,I_PRODUCT"

# API auto-documentation
curl http://localhost:3001/api
```
