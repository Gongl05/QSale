import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';

const origin = 'https://qsale.test';
function setup() {
  const upstream = vi.fn<typeof fetch>();
  const app = createApp({
    apiURL: 'https://backend.test/api/v1',
    origin,
    production: true,
    upstream,
  });
  return { upstream, app };
}
it('keeps the refresh token in a secure, HttpOnly cookie and never returns it to JavaScript', async () => {
  const { app, upstream } = setup();
  upstream.mockResolvedValue(
    new Response(JSON.stringify({ token: 'access-only', refreshToken: 'secret-refresh' }), {
      status: 200,
    }),
  );
  const result = await request(app)
    .post('/session/signin')
    .set('Origin', origin)
    .send({ email: 'one@example.test', password: 'secret' });
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ token: 'access-only' });
  const cookie = result.headers['set-cookie'][0];
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).toContain('Path=/session');
  expect(result.headers['cache-control']).toBe('no-store');
});
it('rejects cross-origin writes, including logout, before contacting the API', async () => {
  const { app, upstream } = setup();
  for (const endpoint of ['/session/signin', '/session/logout', '/backend/api/v1/plans']) {
    const result = await request(app).post(endpoint).set('Origin', 'https://evil.test').send({});
    expect(result.status).toBe(403);
  }
  expect(upstream).not.toHaveBeenCalled();
});
it('renews from the cookie and clears rejected sessions', async () => {
  const { app, upstream } = setup();
  upstream.mockResolvedValue(new Response('{}', { status: 401 }));
  const result = await request(app)
    .post('/session/refresh')
    .set('Origin', origin)
    .set('Cookie', 'qsale_refresh=old')
    .send({ refreshToken: 'ignored' });
  expect(result.status).toBe(401);
  expect(upstream.mock.calls[0]![1]?.body).toBe(JSON.stringify({ refreshToken: 'old' }));
  expect(result.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});
it('does not expose raw auth endpoints through the API proxy', async () => {
  const { app, upstream } = setup();
  for (const endpoint of ['/backend/api/v1/auth/signin', '/backend/api/v1/%2e/auth/signin']) {
    const result = await request(app).post(endpoint).set('Origin', origin).send({});
    expect(result.status).toBe(404);
  }
  expect(upstream).not.toHaveBeenCalled();
});
it('forwards JWT and query parameters to the fixed API, without forwarding cookies', async () => {
  const { app, upstream } = setup();
  upstream.mockResolvedValue(new Response(JSON.stringify({ content: [] })));
  const result = await request(app)
    .get('/backend/api/v1/plans?page=1&size=25')
    .set('Authorization', 'Bearer user-token')
    .set('Cookie', 'qsale_refresh=hidden');
  expect(result.status).toBe(200);
  expect(String(upstream.mock.calls[0]![0])).toBe(
    'https://backend.test/api/v1/plans?page=1&size=25',
  );
  expect(upstream.mock.calls[0]![1]?.headers).toEqual({
    'Content-Type': 'application/json',
    Authorization: 'Bearer user-token',
  });
});

it('revokes the server session before deleting its refresh cookie', async () => {
  const { app, upstream } = setup();
  upstream.mockResolvedValue(new Response(null, { status: 204 }));
  const result = await request(app).post('/session/logout').set('Origin', origin)
    .set('Cookie', 'qsale_refresh=current-session').send({});
  expect(result.status).toBe(204);
  expect(upstream.mock.calls[0]![0]).toBe('https://backend.test/api/v1/auth/logout');
  expect(upstream.mock.calls[0]![1]?.body).toBe(JSON.stringify({refreshToken:'current-session'}));
  expect(result.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});

it('keeps the cookie when logout cannot reach the API so revocation can be retried', async () => {
  const { app, upstream } = setup();
  upstream.mockRejectedValue(new Error('Network unavailable'));
  const result = await request(app).post('/session/logout').set('Origin', origin)
    .set('Cookie', 'qsale_refresh=current-session').send({});
  expect(result.status).toBe(502);
  expect(result.headers['set-cookie']).toBeUndefined();
});

it('can finish logout when there is no remaining refresh cookie', async () => {
  const { app, upstream } = setup();
  const result = await request(app).post('/session/logout').set('Origin', origin).send({});
  expect(result.status).toBe(204);
  expect(upstream).not.toHaveBeenCalled();
});

it('proxies password recovery without creating a session and clears the old cookie after reset', async () => {
  const { app, upstream } = setup();
  upstream.mockResolvedValueOnce(new Response(null, { status: 202 }));
  const requested = await request(app).post('/session/password-reset-request').set('Origin', origin)
    .send({ email: 'ana@example.test' });
  expect(requested.status).toBe(202);
  expect(requested.headers['set-cookie']).toBeUndefined();
  expect(upstream.mock.calls[0]![0]).toBe('https://backend.test/api/v1/auth/password-reset/request');
  upstream.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const confirmed = await request(app).post('/session/password-reset-confirm').set('Origin', origin)
    .send({ token: 'a'.repeat(43), password: 'NewPassword2026' });
  expect(confirmed.status).toBe(204);
  expect(confirmed.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
  expect(upstream.mock.calls[1]![0]).toBe('https://backend.test/api/v1/auth/password-reset/confirm');
});

it('rejects cross-origin password recovery before forwarding it', async () => {
  const { app, upstream } = setup();
  const result = await request(app).post('/session/password-reset-request')
    .set('Origin', 'https://other.test').send({ email: 'ana@example.test' });
  expect(result.status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});
