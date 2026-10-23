import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import { configureAuth } from './oauth.js';
const makeApp = (_origin: string, port: number) => {
 vi.stubEnv('VCAP_SERVICES', JSON.stringify({ xsuaa: [{ credentials }] })); vi.stubEnv('VCAP_APPLICATION', '');
 const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false })); configureAuth(app, port); return app;
};
afterEach(() => vi.unstubAllEnvs());

const credentials = {
  url: 'https://identity.example', clientid: 'upgrade-test-client',
  clientsecret: 'local-upgrade-test-secret', xsappname: 'upgrade-test', uaadomain: 'identity.example',
};

// Exercises only local HTTP routes. The identity provider and client are never contacted.
it('requires approval, preserves client state and returns a browser-bound code', async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://localhost:${port}`;
  const local = `http://127.0.0.1:${port}`;
  try {
    server.on('request', makeApp(origin, port));
    const registration = await fetch(`${local}/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Local upgrade test', redirect_uris: ['https://client.example/callback'], token_endpoint_auth_method: 'none' }),
    });
    expect(registration.status).toBe(201);
    const client = await registration.json() as { client_id: string };
    const params = new URLSearchParams({ client_id: client.client_id, response_type: 'code',
      redirect_uri: 'https://client.example/callback', code_challenge: 'A'.repeat(43),
      code_challenge_method: 'S256', state: 'client+state/with=encoding' });
    const begin = () => fetch(`${local}/authorize?${params}`, { redirect: 'manual' });
    const page = await begin();
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Approve and continue');
    const fields = (html: string) => new URLSearchParams(Object.fromEntries(
      [...html.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1] ?? '', (m[2] ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')]),
    ));
    const cookies = (response: Response) => response.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    const submit = (form: URLSearchParams, cookie: string) => fetch(`${local}/authorize`, {
      method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin, Cookie: cookie }, body: form,
    });
    const form = fields(html);
    form.set('consent_action', 'approve');
    const approved = await submit(form, cookies(page));
    expect(approved.status).toBe(302);
    const upstream = new URL(approved.headers.get('location')!);
    expect(upstream.origin).toBe(credentials.url);
    expect(upstream.searchParams.get('redirect_uri')).toBe(`${origin}/oauth/callback`);
    const callbackQuery = new URLSearchParams({ state: upstream.searchParams.get('state')!, code: 'local-fixture-code' });
    const missingBrowser = await fetch(`${local}/oauth/callback?${callbackQuery}`, { redirect: 'manual' });
    expect(missingBrowser.status).toBe(400);
    expect(missingBrowser.headers.get('location')).toBeNull();
    const callback = await fetch(`${local}/oauth/callback?${callbackQuery}`, { redirect: 'manual', headers: { Cookie: cookies(approved) } });
    expect(callback.status).toBe(302);
    const returned = new URL(callback.headers.get('location')!);
    expect(returned.origin).toBe('https://client.example');
    expect(returned.searchParams.get('state')).toBe('client+state/with=encoding');
    expect(returned.searchParams.get('code')).toBeTruthy();
    expect(returned.searchParams.get('code')).not.toBe('local-fixture-code');
    const denialPage = await begin();
    const denial = fields(await denialPage.text());
    denial.set('consent_action', 'deny');
    const denied = await submit(denial, cookies(denialPage));
    expect(denied.status).toBe(303);
    const deniedTarget = new URL(denied.headers.get('location')!);
    expect(deniedTarget.searchParams.get('error')).toBe('access_denied');
    expect(deniedTarget.searchParams.has('code')).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
