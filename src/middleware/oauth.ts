// ============================================================================
// Authentication middleware — config-driven, supports 3 auth modes:
//
// 1. XSUAA (BTP Cloud Foundry) — auto-detected from VCAP_SERVICES
// 2. Generic OIDC (Docker private) — activated by OAUTH_ISSUER env var
// 3. No auth (public) — when neither is configured
//
// Uses @arc-mcp/xsuaa-auth for all auth wiring (XSUAA OAuth proxy, OIDC
// verifier, chained token verification, MCP auth router).
// ============================================================================

import type { Express, RequestHandler } from "express";
import {
  type AuthOptions,
  loadXsuaaCredentials,
  resolveAppUrl,
  setupHttpAuth,
} from "@arc-mcp/xsuaa-auth";

// ---------------------------------------------------------------------------
// Logger adapter (stderr, matches @arc-mcp/xsuaa-auth Logger interface)
// ---------------------------------------------------------------------------

const logger = {
  debug: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[auth:debug] ${msg}`, data ?? ""),
  info: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[auth:info] ${msg}`, data ?? ""),
  warn: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[auth:warn] ${msg}`, data ?? ""),
  error: (msg: string, data?: Record<string, unknown>) =>
    console.error(`[auth:error] ${msg}`, data ?? ""),
};

// ---------------------------------------------------------------------------
// Detect auth mode from environment
// ---------------------------------------------------------------------------

type AuthMode =
  | { kind: "xsuaa" }
  | { kind: "oidc"; issuer: string; audience: string }
  | { kind: "none" };

function detectAuthMode(): AuthMode {
  // 1. XSUAA — auto-detected from VCAP_SERVICES (Cloud Foundry)
  try {
    loadXsuaaCredentials();
    return { kind: "xsuaa" };
  } catch {
    // No XSUAA binding — continue
  }

  // 2. Generic OIDC — activated by OAUTH_ISSUER
  const issuer = process.env.OAUTH_ISSUER;
  if (issuer) {
    const audience = process.env.OAUTH_AUDIENCE;
    if (!audience) {
      throw new Error(
        "OAUTH_AUDIENCE is required when OAUTH_ISSUER is set"
      );
    }
    return { kind: "oidc", issuer, audience };
  }

  // 3. No auth — public mode
  return { kind: "none" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wire authentication onto the Express app and return bearer middleware.
 *
 * - XSUAA mode: mounts OAuth proxy routes (/authorize, /oauth/callback,
 *   /.well-known/*), returns bearer middleware for /mcp and /api.
 * - OIDC mode: returns bearer middleware that validates JWTs.
 * - No auth: returns undefined (public access).
 */
export function configureAuth(
  app: Express,
  port: number
): { middleware: RequestHandler | undefined; mode: string } {
  const authMode = detectAuthMode();

  if (authMode.kind === "none") {
    console.error(
      "[ROSA] No auth configured — public access"
    );
    return { middleware: undefined, mode: "public" };
  }

  const options: AuthOptions = {};

  if (authMode.kind === "xsuaa") {
    const credentials = loadXsuaaCredentials();
    const appUrl = resolveAppUrl(process.env, { port });

    options.xsuaa = {
      credentials,
      appUrl,
      clientIdPrefix: "rosa-",
      resourceName: "ROSA — Released Objects Search Assistant",
      scopesSupported: [],
      dcrSigningSecret: process.env.DCR_SIGNING_SECRET,
      dcrTtlSeconds: process.env.OAUTH_DCR_TTL_SECONDS
        ? Number(process.env.OAUTH_DCR_TTL_SECONDS)
        : undefined,
    };

    console.error("[ROSA] XSUAA auth enabled");
    console.error(`  App URL:   ${appUrl}`);
    console.error(`  XSUAA:     ${credentials.url}`);
    console.error(`  xsappname: ${credentials.xsappname}`);
  }

  if (authMode.kind === "oidc") {
    options.oidc = {
      issuer: authMode.issuer,
      audience: authMode.audience,
    };

    console.error("[ROSA] OIDC auth enabled");
    console.error(`  Issuer:   ${authMode.issuer}`);
    console.error(`  Audience: ${authMode.audience}`);
  }

  // API keys (works alongside XSUAA or OIDC)
  const apiKeys = process.env.API_KEYS;
  if (apiKeys) {
    options.apiKeys = apiKeys;
    console.error("[ROSA] API key auth enabled");
  }

  // CORS origins (for browser-based MCP clients)
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (corsOrigins) {
    options.allowedOrigins = corsOrigins.split(",").map((s) => s.trim());
  }

  const middleware = setupHttpAuth(app, options, logger);

  return {
    middleware,
    mode: authMode.kind,
  };
}
