import { expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';

const origin = 'https://qsale.test';
it('refuses production startup without a strong CSRF key or HTTPS upstream', () => {
  expect(()=>createApp({apiURL:'https://backend.test/api/v1',origin,production:true})).toThrow('CSRF_SECRET');
  expect(()=>createApp({apiURL:'http://backend.test/api/v1',origin,production:true,
    csrfSecret:'test-only-csrf-key-with-at-least-32-characters'})).toThrow('HTTPS API_URL');
});
function setup() {
  const upstream = vi.fn<typeof fetch>();
  const app = createApp({apiURL:'https://backend.test/api/v1', origin,
    production:true, csrfSecret:'test-only-csrf-key-with-at-least-32-characters', upstream});
  return {app, upstream};
}
async function write(app: ReturnType<typeof createApp>, url: string, data = {}, refresh = '', access = '') {
  const bootstrap = request(app).get('/session/csrf').set('X-Forwarded-Proto','https');
  if (refresh) bootstrap.set('Cookie', 'qsale_refresh='+refresh);
  const csrf = await bootstrap;
  const csrfCookie = csrf.headers['set-cookie'][0].split(';')[0];
  const action = request(app).post(url).set('X-Forwarded-Proto','https').set('Origin',origin)
    .set('Cookie',csrfCookie+(refresh ? '; qsale_refresh='+refresh : ''))
    .set('X-CSRF-Token',csrf.body.token);
  if (access) action.set('Authorization','Bearer '+access);
  return action.send(data);
}

it('keeps refresh tokens in secure HttpOnly cookies, outside JavaScript responses', async () => {
  const {app,upstream}=setup();
  upstream.mockResolvedValue(new Response(JSON.stringify({token:'access-only',refreshToken:'secret-refresh'})));
  const result=await write(app,'/session/signin',{email:'one@example.test',password:'secret'});
  expect(result.status).toBe(200); expect(result.body).toEqual({token:'access-only'});
  const cookie=result.headers['set-cookie'][0];
  for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/session']) expect(cookie).toContain(flag);
  expect(result.headers['cache-control']).toBe('no-store');
});
it('rejects cross-origin writes before contacting the API', async () => {
  const {app,upstream}=setup();
  for(const url of ['/session/signin','/session/logout','/backend/api/v1/plans']) {
    expect((await request(app).post(url).set('X-Forwarded-Proto','https').set('Origin','https://evil.test').send({})).status).toBe(403);
  }
  expect(upstream).not.toHaveBeenCalled();
});
it('renews from the refresh cookie and clears rejected sessions', async () => {
  const {app,upstream}=setup(); upstream.mockResolvedValue(new Response('{}',{status:401}));
  const result=await write(app,'/session/refresh',{refreshToken:'ignored'},'old');
  expect(result.status).toBe(401);
  expect(upstream.mock.calls[0]![1]?.body).toBe(JSON.stringify({refreshToken:'old'}));
  expect(result.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});
it('does not expose raw authentication endpoints through the proxy', async () => {
  const {app,upstream}=setup();
  for(const url of ['/backend/api/v1/auth/signin','/backend/api/v1/%2e/auth/signin'])
    expect((await write(app,url)).status).toBe(404);
  expect(upstream).not.toHaveBeenCalled();
});
it('forwards JWT and query parameters without forwarding cookies', async () => {
  const {app,upstream}=setup(); upstream.mockResolvedValue(new Response('{"content":[]}'));
  const result=await request(app).get('/backend/api/v1/plans?page=1&size=25').set('X-Forwarded-Proto','https')
    .set('Authorization','Bearer user-token').set('Cookie','qsale_refresh=hidden');
  expect(result.status).toBe(200);
  expect(String(upstream.mock.calls[0]![0])).toBe('https://backend.test/api/v1/plans?page=1&size=25');
  expect(upstream.mock.calls[0]![1]?.headers).toEqual({'Content-Type':'application/json',Authorization:'Bearer user-token'});
});
it('revokes the server session before clearing the refresh cookie', async () => {
  const {app,upstream}=setup(); upstream.mockResolvedValue(new Response(null,{status:204}));
  const result=await write(app,'/session/logout',{},'current-session');
  expect(result.status).toBe(204);
  expect(upstream.mock.calls[0]![0]).toBe('https://backend.test/api/v1/auth/logout');
  expect(upstream.mock.calls[0]![1]?.body).toBe(JSON.stringify({refreshToken:'current-session'}));
  expect(result.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
});
it('preserves the refresh cookie when revocation cannot reach the API', async () => {
  const {app,upstream}=setup(); upstream.mockRejectedValue(new Error('Network unavailable'));
  const result=await write(app,'/session/logout',{},'current-session');
  expect(result.status).toBe(502); expect(result.headers['set-cookie']).toBeUndefined();
});
it('finishes logout with no refresh cookie', async () => {
  const {app,upstream}=setup();
  expect((await write(app,'/session/logout')).status).toBe(204); expect(upstream).not.toHaveBeenCalled();
});
it('requires a signed CSRF token on session and proxy writes, even with a correct Origin', async () => {
  const {app,upstream}=setup();
  for(const url of ['/session/signin','/backend/api/v1/plans']) {
    const response=await request(app).post(url).set('X-Forwarded-Proto','https').set('Origin',origin).send({});
    expect(response.status).toBe(403); expect(response.body.code).toBe('CSRF_INVALID');
  }
  expect(upstream).not.toHaveBeenCalled();
});
it('binds proxy CSRF to the access session without widening the refresh cookie path', async () => {
  const {app,upstream}=setup();
  const token=(sid: string,type: string) => 'e30.'+Buffer.from(JSON.stringify({sid,type})).toString('base64url')+'.signature';
  upstream.mockResolvedValue(new Response('{"id":1}',{status:201}));
  const response=await write(app,'/backend/api/v1/plans',{name:'Plan'},token('same','refresh'),token('same','access'));
  expect(response.status).toBe(201);
  const blocked=await write(app,'/backend/api/v1/plans',{name:'Plan'},token('same','refresh'),token('other','access'));
  expect(blocked.status).toBe(403);
  expect(upstream).toHaveBeenCalledTimes(1);
});
it('rejects forged CSRF cookies and tokens from a different refresh session', async () => {
  const {app,upstream}=setup();
  const csrf=await request(app).get('/session/csrf').set('X-Forwarded-Proto','https').set('Cookie','qsale_refresh=first');
  const response=await request(app).post('/session/logout').set('X-Forwarded-Proto','https').set('Origin',origin)
    .set('Cookie',csrf.headers['set-cookie'][0].split(';')[0]+'; qsale_refresh=second')
    .set('X-CSRF-Token',csrf.body.token).send({});
  expect(response.status).toBe(403);
  const forged='a'.repeat(64)+'.'+'b'.repeat(64);
  expect((await request(app).post('/session/logout').set('X-Forwarded-Proto','https').set('Origin',origin)
    .set('Cookie','__Host-qsale_csrf='+forged).set('X-CSRF-Token',forged).send({})).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
});
it('rejects insecure production traffic and untrusted forwarded protocol headers', async () => {
  const app=createApp({apiURL:'https://backend.test/api/v1',origin,production:true,
    csrfSecret:'test-only-csrf-key-with-at-least-32-characters',trustedProxy:false});
  expect((await request(app).get('/session/csrf').set('X-Forwarded-Proto','https')).status).toBe(426);
  expect((await request(app).get('/health')).status).toBe(200);
});
it('does not expose environment files, repository metadata, backups or source maps', async () => {
  const {app}=setup();
  for(const url of ['/.env','/.git/config','/backup.sql','/assets/app.js.map','/%2eenv'])
    expect((await request(app).get(url).set('X-Forwarded-Proto','https')).status).toBe(404);
});
it('returns generic payload-limit errors and production security headers', async () => {
  const {app}=setup();
  const response=await write(app,'/session/signin',{password:'x'.repeat(70000)});
  expect(response.status).toBe(413); expect(response.body).toEqual({message:'No se pudo procesar la solicitud.'});
  expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
});
