#!/usr/bin/env node

// ============================================================================
// ROSA — Released Objects Search Assistant
// Main entry point — supports both stdio and HTTP transports
// Exposes MCP protocol on /mcp and REST API on /api
//
// Transport selection (stdio is the default, expected by MCP clients):
//   - stdio  — default; used by Claude Desktop, Claude Code, Cursor...
//   - http   — enabled by `--http` flag or TRANSPORT=http env var
//              port from `--port <n>` flag or PORT env var (default 3001)
//
// Authentication modes (config-driven, HTTP transport only):
//   - XSUAA (BTP Cloud Foundry) — auto-detected from VCAP_SERVICES
//   - OIDC (self-hosted private) — activated by OAUTH_ISSUER env var
//   - API keys                   — activated by API_KEYS (alongside any mode)
//   - Public (no auth)           — when none of the above is configured
// ============================================================================

import { createRequire } from "node:module";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { registerTools } from "./tools/register-tools.js";
import { createApiRouter } from "./routes/api-routes.js";
import { configureAuth } from "./middleware/oauth.js";

// ---------------------------------------------------------------------------
// Resolve the package version (single source of truth = package.json).
// Falls back to a compiled-in default in bundled / pkg contexts where the
// package.json may not be resolvable from the module location.
// ---------------------------------------------------------------------------

let version = "1.12.6";
try {
  const require = createRequire(import.meta.url);
  version = (require("../package.json") as { version: string }).version;
} catch {
  // Keep the fallback version.
}

// ---------------------------------------------------------------------------
// CLI flags — `--http`, `--port <n>` (env vars TRANSPORT / PORT still work)
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  const inline = argv.find((a) => a.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

const useHttp = argv.includes("--http") || process.env.TRANSPORT === "http";
const port = parseInt(flagValue("--port") || process.env.PORT || "3001", 10);

// ---------------------------------------------------------------------------
// Create and configure the MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "rosa",
  version,
});

// Register all tools
registerTools(server);

// ---------------------------------------------------------------------------
// Transport: stdio (default)
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  console.error("[ROSA] Starting in stdio mode...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[ROSA] Server connected via stdio");
}

// ---------------------------------------------------------------------------
// Transport: Streamable HTTP
// ---------------------------------------------------------------------------

async function runHTTP(httpPort: number): Promise<void> {
  const app = express();

  // Security headers (no restrictive COOP — popup OAuth requires it unset)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: false,
    })
  );
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(express.json());

  // Health check endpoint (always public, before auth)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "rosa" });
  });

  // Rate limiters
  const mcpLimiter = rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.MCP_RATE_LIMIT || "600"),
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: parseInt(process.env.API_RATE_LIMIT || "600"),
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Authentication (auto-detects XSUAA / OIDC / public)
  const { middleware: authMiddleware, mode: authMode } = configureAuth(
    app,
    httpPort
  );

  // Apply auth middleware to protected routes (when auth is configured)
  if (authMiddleware) {
    app.use("/api", authMiddleware);
    app.use("/mcp", authMiddleware);
  }

  // REST API endpoints
  app.use("/api", apiLimiter, createApiRouter());

  // MCP endpoint
  app.post("/mcp", mcpLimiter, async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(httpPort, () => {
    console.error(`[ROSA] HTTP server running on http://localhost:${httpPort}`);
    console.error(`  MCP endpoint: http://localhost:${httpPort}/mcp`);
    console.error(`  REST API:     http://localhost:${httpPort}/api`);
    console.error(`  Health:       http://localhost:${httpPort}/health`);
    console.error(`  Auth mode:    ${authMode}`);
  });
}

// ---------------------------------------------------------------------------
// Choose transport
// ---------------------------------------------------------------------------

if (useHttp) {
  runHTTP(port).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
