# Architecture

## Overview

```
                    ┌──────────────────────────────────────────────┐
                    │         sap-released-objects-server          │
                    │                                              │
   MCP Client ─────┤  POST /mcp    ──► StreamableHTTPTransport   │
  (Claude, etc.)    │                       │                      │
                    │                       ▼                      │
                    │                  McpServer                   │
                    │                       │                      │
                    │               registerTools()                │
                    │           ┌─────┬─────┴──────┬───────┐      │
                    │           │     │            │       │      │
                    │        search  details  successor  ...     │
                    │           │     │            │       │      │
                    │           └─────┴─────┬──────┴───────┘      │
                    │                       │                      │
   REST Client ─────┤  GET /api/*   ──► api-handlers.ts           │
  (curl, scripts)   │                       │                      │
                    │                       ▼                      │
                    │              data-loader.ts                  │
                    │           (GitHub fetch + 24h cache)         │
                    │                       │                      │
                    │                       ▼                      │
                    │          SAP Cloudification Repository       │
                    │       (github.com/SAP/abap-atc-cr-cv-s4hc)  │
                    └──────────────────────────────────────────────┘
```

## Transport Modes

### Stdio (default)

Used by MCP clients that connect directly (Claude Desktop, Claude Code local config).

```
MCP Client ←── stdin/stdout ──→ Node.js process
```

No HTTP server started. No auth, no rate limiting.

### HTTP

Used for remote deployments (Docker, Railway, BTP).

```
MCP Client ──── HTTPS ───→ Express ──→ McpServer
REST Client ─── HTTPS ───→ Express ──→ api-handlers
```

Express middleware stack:
1. Helmet (security headers)
2. JSON body parser
3. Health check (`/health` — always public)
4. Auth middleware (when configured)
5. Rate limiting
6. Route handlers

## Authentication Flow

```
                    No auth env vars
                    ┌─────────────┐
                    │   Public    │  ← All routes open
                    └─────────────┘

                    OAUTH_ISSUER set
                    ┌─────────────┐
                    │    OIDC     │  ← JWT validation on /mcp, /api
                    └─────────────┘

                    VCAP_SERVICES has xsuaa
                    ┌─────────────┐
                    │   XSUAA     │  ← OAuth proxy + JWT validation
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    /.well-known/    /authorize      /oauth/callback
    oauth-protected- (OAuth proxy)   (callback proxy)
    resource
```

## Data Flow

```
1. Client request (search "purchase order")
        │
2. api-handlers.ts validates input (Zod schemas)
        │
3. data-loader.ts checks in-memory cache
        │
        ├── Cache hit (< 24h) → use cached data
        │
        └── Cache miss → fetch from GitHub
                │
                ├── objectReleaseInfoLatest.json (Level A, public_cloud)
                ├── objectReleaseInfo_BTPLatest.json (Level A, btp)
                ├── objectReleaseInfo_PCE*.json (Level A, private_cloud/on_premise)
                ├── objectClassifications_SAP.json (Level B)
                └── objectClassifications.json (Level B)
                        │
4. search.ts tokenizes query + scores all objects
        │
5. Results sorted by relevance, paginated, returned
```

## Project Structure

```
sap-released-objects-server/
├── src/
│   ├── index.ts                    # Entry point (transport selection)
│   ├── types.ts                    # TypeScript type definitions
│   ├── constants.ts                # URLs, mappings, cache TTL
│   ├── middleware/
│   │   ├── oauth.ts                # Auth config detection + wiring
│   │   └── oauth.test.ts           # Auth mode detection tests
│   ├── handlers/
│   │   └── api-handlers.ts         # Shared business logic (MCP + REST)
│   ├── routes/
│   │   └── api-routes.ts           # Express REST endpoints
│   ├── services/
│   │   ├── data-loader.ts          # GitHub data fetching + caching
│   │   ├── search.ts               # Token-based search + scoring
│   │   └── abbreviation-dictionary.ts  # SAP abbreviation expansion
│   ├── tools/
│   │   └── register-tools.ts       # MCP tool registration
│   └── schemas/
│       └── common.ts               # Zod validation schemas
├── docs/                           # Documentation
├── skills/                         # LLM skill configuration
├── Dockerfile                      # Multi-stage Docker build
├── manifest.yml                    # CF simple deployment
├── mta.yaml                        # MTA deployment (with XSUAA)
├── xs-security.json                # XSUAA service config
├── sap_abbreviation_dictionary.json # SAP term abbreviations
├── package.json
└── tsconfig.json
```

## Key Design Decisions

### Shared Business Logic

MCP tools and REST API endpoints share the same handler functions (`api-handlers.ts`). No feature gap between protocols.

### In-Memory Cache

Data is cached in a `Map<string, CacheEntry>` with a 24-hour TTL. No external cache (Redis) needed — the data is small (~2-5 MB per system type) and read-only.

### Config-Driven Auth

Authentication mode is detected from environment variables at startup. No separate builds, no feature flags, no config files. Same Docker image works for public and private deployments.

### No App Router

Unlike typical BTP apps, there is no `@sap/approuter`. The server handles OAuth proxy routes directly via `@arc-mcp/xsuaa-auth`, keeping the deployment simple (single module in MTA).

### Stateless DCR

OAuth Dynamic Client Registration uses signed tokens as client IDs (no database). This allows horizontal scaling without shared state.
