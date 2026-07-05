# ROSA — Released Objects Search Assistant

[![@clementringot/rosa](https://img.shields.io/npm/v/@clementringot/rosa?logo=npm&label=%40clementringot%2Frosa&color=orange)](https://www.npmjs.com/package/@clementringot/rosa)
[![ghcr.io rosa](https://img.shields.io/badge/ghcr.io-rosa-blue?logo=docker&logoColor=white)](https://github.com/ClementRingot/ROSA/pkgs/container/rosa)
[![CI](https://img.shields.io/github/actions/workflow/status/ClementRingot/ROSA/ci.yml?label=CI)](https://github.com/ClementRingot/ROSA/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/actions/workflow/status/ClementRingot/ROSA/release.yml?label=release)](https://github.com/ClementRingot/ROSA/actions/workflows/release.yml)
[![node](https://img.shields.io/node/v/@clementringot/rosa?logo=node.js&logoColor=white)](https://www.npmjs.com/package/@clementringot/rosa)
[![license MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![MCP server](https://img.shields.io/badge/MCP-server-8A2BE2)](https://modelcontextprotocol.io/)

**ROSA gives AI agents real-time knowledge of which SAP objects are released for
ABAP Cloud / Clean Core — and what to use instead when they're not.**

It plugs into the [SAP Cloudification Repository](https://github.com/SAP/abap-atc-cr-cv-s4hc)
(the official source of truth) and exposes it **two ways**, sharing the same
business logic — no feature gap between them:

| Access mode | Protocol | Use case |
| --- | --- | --- |
| **MCP Server** | [Model Context Protocol](https://modelcontextprotocol.io/) on `POST /mcp` | AI agents with native MCP support (Claude Desktop, Claude Code, Cline, Cursor…) |
| **REST API** | `GET` endpoints on `/api/*` returning JSON | LLM skills, scripts, CI pipelines — anything that speaks HTTP |

> Ask *"Is table MARA available in ABAP Cloud?"* and the agent instantly knows:
> **no — use `I_PRODUCT` instead.**

## Choose your deployment

| I want to… | Use | One-liner |
| --- | --- | --- |
| Plug into Claude Desktop / Code / Cursor | **npm** | `npx -y @clementringot/rosa` |
| Run without Node.js installed | **Native executable** | download from [Releases](https://github.com/ClementRingot/ROSA/releases/latest) |
| Run as a server / self-host | **Docker** | `docker run -p 3001:3001 ghcr.io/clementringot/rosa` |
| Deploy on a generic Node host | **Node PaaS** | Railway / Render / Fly.io — set `TRANSPORT=http` |
| Deploy on SAP BTP Cloud Foundry | **MTA** or **npm wrapper** | see [DEPLOYMENT](./docs/DEPLOYMENT.md#sap-btp-cloud-foundry-two-paths) |
| Deploy on classic Cloud Foundry | **`cf push`** | see [cloud-foundry-classic](./docs/cloud-foundry-classic.md) |

Full details for every option: **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**.

## Quick start (MCP client)

No install needed — `npx` runs the server in stdio mode, which is what MCP
clients expect. Add one of these to your client config:

**Claude Desktop** (`claude_desktop_config.json`) / **Claude Code** (`.mcp.json`):

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

**Cursor** (`~/.cursor/mcp.json` or `.cursor/mcp.json`):

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

Prefer a hosted, zero-install setup? Point your client at a running instance's
`/mcp` URL instead:

```json
{
  "mcpServers": {
    "rosa": { "type": "url", "url": "https://<your-instance>/mcp" }
  }
}
```

### REST API (skills, scripts, CI)

All endpoints are `GET`, return JSON, and support CORS:

```bash
curl "https://<your-instance>/api/search?query=purchase+order"
curl "https://<your-instance>/api/object?object_type=TABL&object_name=MARA"
curl "https://<your-instance>/api/compliance?object_names=MARA,BSEG,I_PRODUCT"
```

> On a secured instance (OIDC / XSUAA / API keys) add `Authorization: Bearer <token>`
> — see [Calling the REST API on BTP](./docs/DEPLOYMENT.md#calling-the-rest-api-on-btp-machine-to-machine).

For LLM-skill usage, see [`skills/sap-released-objects/SKILL.md`](./skills/sap-released-objects/SKILL.md)
— the full API reference formatted for LLM consumption.

## Features

- **Search SAP objects** — classes, CDS views, tables, data elements, BDEFs…
- **Filter by Clean Core Level** (A / B / C / D) — the model replacing the 3-tier
  system since August 2025.
- **Find successors** for deprecated or non-released objects.
- **Clean Core compliance check** for a list of objects (with compliance rate).
- **Statistics** — counts by level, type, and application component.
- **Smart search** — multi-token scoring (`"purchase order"` → `I_PURCHASEORDER`).
- **Multi-system** — S/4HANA Cloud Public, BTP ABAP Environment, Private Cloud,
  On-Premise; PCE versions discovered dynamically.

Data is fetched from SAP's public GitHub repository at runtime and cached in
memory for 24h — no SAP system connection required.

### Clean Core Level Concept

| Level | Meaning | Upgrade safety |
| --- | --- | --- |
| **A** | Released APIs (ABAP Cloud) | ✅ Upgrade-safe |
| **B** | Classic APIs | ⚠️ Upgrade-stable |
| **C** | Internal / unclassified | 🟡 Manageable risk |
| **D** | noAPI (not recommended) | 🔴 High risk |

## MCP tools & REST endpoints

Each MCP tool on `POST /mcp` has an identical REST counterpart under `/api`:

| MCP tool | REST endpoint | Purpose |
| --- | --- | --- |
| `sap_search_objects` | `GET /api/search` | Search objects, ranked by relevance, with filters |
| `sap_get_object_details` | `GET /api/object` | Full details + Clean Core assessment for one object |
| `sap_find_successor` | `GET /api/successor` | Successor(s) of a deprecated / non-released object |
| `sap_check_clean_core_compliance` | `GET /api/compliance` | Compliance rate for a list of objects |
| `sap_list_versions` | `GET /api/versions` | Available S/4HANA PCE versions |
| `sap_list_object_types` | `GET /api/types` | TADIR object types with per-level counts |
| `sap_get_statistics` | `GET /api/statistics` | Repository statistics |

Parameters and response shapes are documented in
[`skills/sap-released-objects/SKILL.md`](./skills/sap-released-objects/SKILL.md).

## Server modes & authentication

ROSA runs over **stdio** (default; local MCP clients) or **HTTP** (`--http` /
`TRANSPORT=http`; remote/self-hosted). On HTTP it auto-detects four
authentication modes from the environment — **public**, **OIDC / OAuth 2.1**,
**XSUAA** (SAP BTP), and **API keys** — with no rebuild:

| Mode | Trigger |
| --- | --- |
| Public | no auth env vars |
| OIDC / OAuth 2.1 | `OAUTH_ISSUER` + `OAUTH_AUDIENCE` |
| XSUAA | `VCAP_SERVICES` xsuaa binding (SAP BTP) |
| API keys | `API_KEYS` (alongside any mode) |

How transports, auth auto-detection, the auth × deployment matrix, and the
system diagram work: **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**.

## Usage examples

```
You:   "Is table MARA available in ABAP Cloud?"
Agent: → sap_get_object_details(TABL, MARA) → "deprecated; successor I_PRODUCT"

You:   "My code uses BSEG, MARA, CL_GUI_ALV_GRID. Is it Clean Core?"
Agent: → sap_check_clean_core_compliance(...) → "Compliance rate: 0%"

You:   "What's available for sending emails on BTP?"
Agent: → sap_search_objects(query="send email", system_type="btp")
```

## Documentation

| Doc | For |
| --- | --- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Transports, auth modes, system diagram, MCP tools |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Every deployment option + config reference + troubleshooting |
| [cloud-foundry-classic.md](./docs/cloud-foundry-classic.md) | Classic (non-BTP) Cloud Foundry |
| [RELEASE.md](./docs/RELEASE.md) | Release train & pipeline (maintainers) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Dev setup, tests, commit convention |
| [CHANGELOG.md](./CHANGELOG.md) | Notable changes |

## Contributing & releases

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). This repo uses
[Conventional Commits](https://www.conventionalcommits.org/); releases are cut by
an automated [release train](./docs/RELEASE.md) that publishes the npm package,
the multi-arch Docker image, and native executables from a single tag.

## License

[MIT](./LICENSE)
