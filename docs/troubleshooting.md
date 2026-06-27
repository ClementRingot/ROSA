# Troubleshooting

## Authentication Issues

### 401 Unauthorized on every request

**Cause:** Auth is enabled but the client is not sending a Bearer token.

**Fix:**
- Verify the MCP client supports OAuth 2.1 (Claude Desktop, Claude Code do)
- Check that `/.well-known/oauth-protected-resource` returns valid metadata:
  ```bash
  curl https://your-server/.well-known/oauth-protected-resource
  ```
- For REST API access, use an API key instead:
  ```bash
  curl -H "Authorization: Bearer my-api-key" https://your-server/api/search?query=mara
  ```

### "OAUTH_AUDIENCE is required when OAUTH_ISSUER is set"

**Cause:** `OAUTH_ISSUER` is set but `OAUTH_AUDIENCE` is missing.

**Fix:** Set both variables:
```bash
-e OAUTH_ISSUER=https://auth.example.com \
-e OAUTH_AUDIENCE=https://mcp.example.com
```

### Token validation fails (OIDC mode)

**Check:**
1. Is the `issuer` in the JWT matching `OAUTH_ISSUER` exactly? (trailing slashes matter)
2. Is the `aud` claim matching `OAUTH_AUDIENCE`?
3. Is the token expired?
4. Can the server reach the JWKS endpoint? (check DNS, proxy, firewall)

### XSUAA: "clients must re-register after restart"

**Cause:** No stable `DCR_SIGNING_SECRET` set. A random one is generated at startup.

**Fix:**
```bash
cf set-env sap-released-objects-mcp DCR_SIGNING_SECRET "$(openssl rand -base64 48)"
cf restage sap-released-objects-mcp
```

### XSUAA: redirect_uri mismatch

**Cause:** The MCP client's callback URL doesn't match any pattern in `xs-security.json`.

**Fix:** Add the client's redirect URI pattern to `xs-security.json` and redeploy:
```json
{
  "oauth2-configuration": {
    "redirect-uris": [
      "https://your-new-client.example.com/**"
    ]
  }
}
```

## Cloud Foundry Issues

### App crashes on startup

**Check logs:**
```bash
cf logs sap-released-objects-mcp --recent
```

**Common causes:**
- Missing XSUAA binding → check `cf services`
- Out of memory → increase memory in `mta.yaml` (default: 256M)
- TypeScript not compiled → ensure `mbt build` ran successfully

### XSUAA service creation fails

**Cause:** `xsappname` conflicts with another app in the same subaccount.

**Fix:** Override the xsappname in your MTA extension:
```yaml
resources:
  - name: sap-released-objects-xsuaa
    parameters:
      config:
        xsappname: sap-released-objects-dev
```

### "No XSUAA binding found" in logs

**Check:**
```bash
cf env sap-released-objects-mcp | grep -A5 xsuaa
```

If empty, the service is not bound. Redeploy with `cf deploy` (not `cf push`).

### Health check fails

**Cause:** App not responding on `/health` within the timeout.

**Check:**
```bash
cf ssh sap-released-objects-mcp -c "curl -s http://localhost:8080/health"
```

Note: CF assigns the port via `PORT` env var (usually 8080), not the default 3001.

## Docker Issues

### Build fails: "COPY failed: file not found"

**Cause:** Required files missing. The Dockerfile expects:
- `package.json` and `package-lock.json`
- `tsconfig.json`
- `src/` directory
- `sap_abbreviation_dictionary.json`

**Fix:** Run from the project root directory.

### Container exits immediately

**Check logs:**
```bash
docker logs <container-id>
```

**Common causes:**
- Port conflict → change the port with `-e PORT=3002 -p 3002:3002`
- Missing env var → check error message

### HEALTHCHECK failing

**Check inside the container:**
```bash
docker exec <container-id> wget --spider -q http://localhost:3001/health
```

## Rate Limiting

### 429 Too Many Requests

**Cause:** Rate limit exceeded.

**Fix:** Increase the limits:
```bash
-e MCP_RATE_LIMIT=1200 -e API_RATE_LIMIT=1200
```

Or wait 1 minute for the window to reset.

## CORS Errors

### "Access-Control-Allow-Origin" missing

**Cause:** Browser-based client blocked by CORS.

**Fix:** Set allowed origins:
```bash
-e CORS_ALLOWED_ORIGINS=https://claude.ai,https://your-app.example.com
```

## Data Issues

### Search returns no results

**Possible causes:**
1. First request → data is being loaded from GitHub (wait a few seconds)
2. GitHub rate limit → the server logs a warning; data will be retried at next cache expiry
3. Wrong `system_type` → BTP has a smaller catalogue than public_cloud

### Stale data

Data is cached for 24 hours. To force a refresh, restart the server:
```bash
docker restart <container-id>
# or
cf restart sap-released-objects-mcp
```
