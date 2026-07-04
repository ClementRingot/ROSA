import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Tests for the OAuth middleware config detection layer.
// We test the exported `configureAuth` function's mode selection logic
// WITHOUT actually starting Express or making HTTP requests (those are
// integration tests). Token validation is handled by @arc-mcp/xsuaa-auth
// and tested upstream.
// ---------------------------------------------------------------------------

// We need to control environment variables and mock the xsuaa-auth module
// because `loadXsuaaCredentials` reads VCAP_SERVICES and throws if absent.

const mockSetupHttpAuth = vi.fn().mockReturnValue(vi.fn());
const mockLoadXsuaaCredentials = vi.fn();
const mockResolveAppUrl = vi.fn().mockReturnValue("http://localhost:3001");

vi.mock("@arc-mcp/xsuaa-auth", () => ({
  setupHttpAuth: mockSetupHttpAuth,
  loadXsuaaCredentials: mockLoadXsuaaCredentials,
  resolveAppUrl: mockResolveAppUrl,
}));

// Dynamic import so the mock is in place before the module loads
const { configureAuth } = await import("./oauth.js");

// Minimal Express app mock
function createMockApp(): any {
  return {
    use: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    disable: vi.fn(),
  };
}

describe("configureAuth", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: loadXsuaaCredentials throws (no VCAP_SERVICES)
    mockLoadXsuaaCredentials.mockImplementation(() => {
      throw new Error("VCAP_SERVICES not set");
    });
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  // -----------------------------------------------------------------------
  // Mode detection
  // -----------------------------------------------------------------------

  it("returns public mode when no auth env vars are set", () => {
    delete process.env.OAUTH_ISSUER;
    delete process.env.OAUTH_AUDIENCE;
    delete process.env.VCAP_SERVICES;

    const app = createMockApp();
    const { middleware, mode } = configureAuth(app, 3001);

    expect(mode).toBe("public");
    expect(middleware).toBeUndefined();
    expect(mockSetupHttpAuth).not.toHaveBeenCalled();
  });

  it("returns oidc mode when OAUTH_ISSUER and OAUTH_AUDIENCE are set", () => {
    process.env.OAUTH_ISSUER = "https://auth.example.com";
    process.env.OAUTH_AUDIENCE = "https://mcp.example.com";

    const app = createMockApp();
    const { middleware, mode } = configureAuth(app, 3001);

    expect(mode).toBe("oidc");
    expect(middleware).toBeDefined();
    expect(mockSetupHttpAuth).toHaveBeenCalledOnce();

    const options = mockSetupHttpAuth.mock.calls[0][1];
    expect(options.oidc).toBeDefined();
    expect(options.oidc.issuer).toBe("https://auth.example.com");
    expect(options.oidc.audience).toBe("https://mcp.example.com");
    expect(options.xsuaa).toBeUndefined();
  });

  it("throws when OAUTH_ISSUER is set but OAUTH_AUDIENCE is missing", () => {
    process.env.OAUTH_ISSUER = "https://auth.example.com";
    delete process.env.OAUTH_AUDIENCE;

    const app = createMockApp();
    expect(() => configureAuth(app, 3001)).toThrow(
      "OAUTH_AUDIENCE is required when OAUTH_ISSUER is set"
    );
  });

  it("returns xsuaa mode when VCAP_SERVICES has xsuaa binding", () => {
    const creds = {
      url: "https://tenant.authentication.eu10.hana.ondemand.com",
      clientid: "sb-rosa",
      clientsecret: "secret",
      xsappname: "rosa",
      uaadomain: "authentication.eu10.hana.ondemand.com",
    };
    mockLoadXsuaaCredentials.mockReturnValue(creds);

    const app = createMockApp();
    const { middleware, mode } = configureAuth(app, 3001);

    expect(mode).toBe("xsuaa");
    expect(middleware).toBeDefined();
    expect(mockSetupHttpAuth).toHaveBeenCalledOnce();

    const options = mockSetupHttpAuth.mock.calls[0][1];
    expect(options.xsuaa).toBeDefined();
    expect(options.xsuaa.credentials).toEqual(creds);
    expect(options.xsuaa.clientIdPrefix).toBe("rosa-");
    expect(options.xsuaa.resourceName).toBe("ROSA — Released Objects Search Assistant");
    expect(options.oidc).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // XSUAA takes priority over OIDC
  // -----------------------------------------------------------------------

  it("prefers xsuaa over oidc when both are available", () => {
    const creds = {
      url: "https://tenant.authentication.eu10.hana.ondemand.com",
      clientid: "sb-test",
      clientsecret: "secret",
      xsappname: "test",
      uaadomain: "authentication.eu10.hana.ondemand.com",
    };
    mockLoadXsuaaCredentials.mockReturnValue(creds);
    process.env.OAUTH_ISSUER = "https://auth.example.com";
    process.env.OAUTH_AUDIENCE = "https://mcp.example.com";

    const app = createMockApp();
    const { mode } = configureAuth(app, 3001);

    expect(mode).toBe("xsuaa");
  });

  // -----------------------------------------------------------------------
  // API keys
  // -----------------------------------------------------------------------

  it("passes API_KEYS to setupHttpAuth when set", () => {
    process.env.OAUTH_ISSUER = "https://auth.example.com";
    process.env.OAUTH_AUDIENCE = "https://mcp.example.com";
    process.env.API_KEYS = "mykey:admin,otherkey:viewer";

    const app = createMockApp();
    configureAuth(app, 3001);

    const options = mockSetupHttpAuth.mock.calls[0][1];
    expect(options.apiKeys).toBe("mykey:admin,otherkey:viewer");
  });

  // -----------------------------------------------------------------------
  // CORS
  // -----------------------------------------------------------------------

  it("passes CORS_ALLOWED_ORIGINS to setupHttpAuth when set", () => {
    process.env.OAUTH_ISSUER = "https://auth.example.com";
    process.env.OAUTH_AUDIENCE = "https://mcp.example.com";
    process.env.CORS_ALLOWED_ORIGINS = "https://claude.ai, https://cursor.sh";

    const app = createMockApp();
    configureAuth(app, 3001);

    const options = mockSetupHttpAuth.mock.calls[0][1];
    expect(options.allowedOrigins).toEqual([
      "https://claude.ai",
      "https://cursor.sh",
    ]);
  });

  // -----------------------------------------------------------------------
  // XSUAA optional config
  // -----------------------------------------------------------------------

  it("passes DCR_SIGNING_SECRET and OAUTH_DCR_TTL_SECONDS to xsuaa options", () => {
    const creds = {
      url: "https://tenant.authentication.eu10.hana.ondemand.com",
      clientid: "sb-test",
      clientsecret: "secret",
      xsappname: "test",
      uaadomain: "authentication.eu10.hana.ondemand.com",
    };
    mockLoadXsuaaCredentials.mockReturnValue(creds);
    process.env.DCR_SIGNING_SECRET = "my-secret-base64";
    process.env.OAUTH_DCR_TTL_SECONDS = "86400";

    const app = createMockApp();
    configureAuth(app, 8080);

    const options = mockSetupHttpAuth.mock.calls[0][1];
    expect(options.xsuaa.dcrSigningSecret).toBe("my-secret-base64");
    expect(options.xsuaa.dcrTtlSeconds).toBe(86400);
  });

  it("calls resolveAppUrl with correct port", () => {
    const creds = {
      url: "https://tenant.authentication.eu10.hana.ondemand.com",
      clientid: "sb-test",
      clientsecret: "secret",
      xsappname: "test",
      uaadomain: "authentication.eu10.hana.ondemand.com",
    };
    mockLoadXsuaaCredentials.mockReturnValue(creds);

    const app = createMockApp();
    configureAuth(app, 9090);

    expect(mockResolveAppUrl).toHaveBeenCalledWith(process.env, { port: 9090 });
  });
});
