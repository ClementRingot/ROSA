# SAP BTP Cloud Foundry Deployment

## Prerequisites

1. **CF CLI** — [Install guide](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html)
2. **MBT Build Tool** — [Install guide](https://sap.github.io/cloud-mta-build-tool/download/)
3. **Cloud Foundry plugin for MTA** — `cf install-plugin multiapps`
4. **SAP BTP subaccount** with Cloud Foundry environment enabled

## Login

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
```

Select your org and space when prompted.

## Build and Deploy

```bash
# Build the MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/sap-released-objects-server_1.12.5.mtar
```

This will:
1. Create an XSUAA service instance (`sap-released-objects-xsuaa`) from `xs-security.json`
2. Deploy the Node.js application (`sap-released-objects-mcp`)
3. Bind the XSUAA service to the application
4. Start the application with HTTP transport and health check

## Post-Deploy Configuration

### DCR Signing Secret (Recommended)

Set a stable signing secret for OAuth Dynamic Client Registration. Without this, a random secret is generated at startup — meaning all OAuth clients must re-register after each app restart.

```bash
cf set-env sap-released-objects-mcp DCR_SIGNING_SECRET "$(openssl rand -base64 48)"
cf restage sap-released-objects-mcp
```

### Optional Environment Variables

```bash
# DCR client lifetime (0 = never expire, default: 30 days)
cf set-env sap-released-objects-mcp OAUTH_DCR_TTL_SECONDS 0

# Rate limits
cf set-env sap-released-objects-mcp MCP_RATE_LIMIT 300
cf set-env sap-released-objects-mcp API_RATE_LIMIT 300

# CORS
cf set-env sap-released-objects-mcp CORS_ALLOWED_ORIGINS "https://claude.ai"

# Apply changes
cf restage sap-released-objects-mcp
```

## Per-Landscape Overrides

For different environments (dev, staging, production), use MTA extension descriptors:

```bash
cp mta-overrides.mtaext.example mta-overrides-dev.mtaext
```

Edit the file to customize:
- Route host
- DCR signing secret
- Rate limits
- XSUAA xsappname (if it conflicts with another app in the same subaccount)

Deploy with:

```bash
cf deploy mta_archives/*.mtar -e mta-overrides-dev.mtaext
```

## MTA Structure

```yaml
modules:
  - name: sap-released-objects-mcp     # Node.js application
    requires:
      - name: sap-released-objects-xsuaa  # XSUAA service binding

resources:
  - name: sap-released-objects-xsuaa   # XSUAA service instance
    parameters:
      service: xsuaa
      service-plan: application
      path: ./xs-security.json         # Auth config (no scopes, auth only)
```

## xs-security.json

The XSUAA configuration provides **authentication only** — no scopes or role-templates. The server serves public read-only data and does not require authorization gating.

```json
{
  "xsappname": "sap-released-objects",
  "tenant-mode": "dedicated",
  "oauth2-configuration": {
    "redirect-uris": [
      "http://localhost:*/**",
      "https://*.hana.ondemand.com/**",
      "https://claude.ai/api/mcp/auth_callback",
      "cursor://anysphere.cursor-retrieval/**",
      "vscode://vscode.microsoft-authentication/**"
    ]
  }
}
```

## Simple Deployment (without XSUAA)

For deployments that don't need authentication, use `manifest.yml` with `cf push`:

```bash
npm run build
cf push
```

This deploys without XSUAA — public access, no OAuth. Useful for internal/demo use.

## Verification

```bash
# Check app status
cf app sap-released-objects-mcp

# Check logs
cf logs sap-released-objects-mcp --recent

# Test health endpoint
curl https://sap-released-objects-mcp.cfapps.<region>.hana.ondemand.com/health

# Test API (will return 401 if XSUAA is configured)
curl https://sap-released-objects-mcp.cfapps.<region>.hana.ondemand.com/api
```

## Client Configuration

### MCP Client (Claude Desktop, Claude Code)

```json
{
  "mcpServers": {
    "sap-released-objects": {
      "type": "url",
      "url": "https://sap-released-objects-mcp.cfapps.<region>.hana.ondemand.com/mcp"
    }
  }
}
```

The MCP client handles the XSUAA OAuth flow automatically on first connection.

## Troubleshooting

See [Troubleshooting](./troubleshooting.md) for common deployment issues.

### Quick Checks

```bash
# XSUAA service bound?
cf env sap-released-objects-mcp | grep xsuaa

# App crashed?
cf events sap-released-objects-mcp

# Memory usage
cf app sap-released-objects-mcp
```
