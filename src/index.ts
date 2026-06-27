#!/usr/bin/env node

// ============================================================================
// SAP Released Objects Server
// Main entry point — supports both stdio and HTTP transports
// Exposes MCP protocol on /mcp and REST API on /api
//
// Authentication modes (config-driven):
//   - XSUAA (BTP Cloud Foundry) — auto-detected from VCAP_SERVICES
//   - OIDC (Docker private)     — activated by OAUTH_ISSUER env var
//   - Public (no auth)          — when neither is configured
// ============================================================================

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
// Create and configure the MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "sap-released-objects-server",
  version: "1.0.0",
});

// Register all tools
registerTools(server);

// ---------------------------------------------------------------------------
// Transport: stdio (default)
// ---------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  console.error("[SAP Released Objects MCP] Starting in stdio mode...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[SAP Released Objects MCP] Server connected via stdio");
}

// ---------------------------------------------------------------------------
// Transport: Streamable HTTP
// ---------------------------------------------------------------------------

async function runHTTP(): Promise<void> {
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
    res.json({ status: "ok", server: "sap-released-objects-server" });
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
  const port = parseInt(process.env.PORT || "3001");
  const { middleware: authMiddleware, mode: authMode } = configureAuth(
    app,
    port
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

  app.listen(port, () => {
    console.error(
      `[SAP Released Objects MCP] HTTP server running on http://localhost:${port}`
    );
    console.error(`  MCP endpoint: http://localhost:${port}/mcp`);
    console.error(`  REST API:     http://localhost:${port}/api`);
    console.error(`  Health:       http://localhost:${port}/health`);
    console.error(`  Auth mode:    ${authMode}`);
  });
}

// ---------------------------------------------------------------------------
// Choose transport based on environment
// ---------------------------------------------------------------------------

const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
