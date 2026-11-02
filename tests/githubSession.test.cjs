const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const crypto = require('node:crypto');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key]; Object.assign(process.env, originalEnv); });
const code = ts.transpileModule(fs.readFileSync('src/app/api/github/[action]/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', code)(name => name.startsWith('@/lib/') ? {} : require(name), mod, mod.exports);
const { GET, POST } = mod.exports;
const origin = 'https://forgex-gamma.vercel.app';
function configure() {
  process.env.GITHUB_CLIENT_ID = 'fixture-client';
  process.env.GITHUB_CLIENT_SECRET = 'fixture-secret';
  process.env.GITHUB_COOKIE_KEY = Buffer.alloc(32, 7).toString('base64url');
  process.env.FORGEX_APP_ORIGIN = origin;
}
function sessionCookie() {
  const iv = Buffer.alloc(12, 3);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ token: 'fixture-token-never-valid', login: 'example-user', expiresAt: Date.now() + 60000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
const params = action => ({ params: Promise.resolve({ action }) });
function request(action, options = {}) { return new NextRequest(`${origin}/api/github/${action}`, options); }
function authenticated() { return request('session', { headers: { cookie: `forgex_gh_session=${sessionCookie()}` } }); }

test('guest status is explicit and never cached', async () => {
  configure();
  const response = await GET(request('session'), params('session'));
  assert.deepEqual(await response.json(), { connected: false, configured: true });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('invalid cookie configuration is reported unavailable', async () => {
  configure(); process.env.GITHUB_COOKIE_KEY = 'invalid';
  const response = await GET(request('session'), params('session'));
  assert.equal((await response.json()).configured, false);
});
test('connected status returns real profile fields without exposing the token', async () => {
  configure(); global.fetch = async () => Response.json({ login: 'example-user', name: 'Example User', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' });
  const response = await GET(authenticated(), params('session'));
  const data = await response.json();
  assert.equal(data.connected, true); assert.equal(data.name, 'Example User');
  assert.equal(data.profileUrl, 'https://github.com/example-user');
  assert.equal(data.avatarUrl, 'https://avatars.githubusercontent.com/u/1?v=4');
  assert.ok(!JSON.stringify(data).includes('fixture-token'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('untrusted avatar hosts are excluded', async () => {
  configure(); global.fetch = async () => Response.json({ login: 'example-user', avatar_url: 'https://example.invalid/track.png' });
  const data = await (await GET(authenticated(), params('session'))).json();
  assert.equal(data.avatarUrl, undefined);
});
test('expired provider session clears cookie and connected state', async () => {
  configure(); global.fetch = async () => new Response('', { status: 401 });
  const response = await GET(authenticated(), params('session'));
  assert.equal((await response.json()).connected, false);
  assert.match(response.headers.get('set-cookie'), /forgex_gh_session=;/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('provider failure does not invent a connected profile', async () => {
  configure(); global.fetch = async () => { throw new Error('offline'); };
  const response = await GET(authenticated(), params('session'));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).connected, undefined);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('logout rejects cross-origin requests', async () => {
  configure();
  const response = await POST(request('session', { method: 'POST', headers: { origin: 'https://untrusted.invalid' } }), params('session'));
  assert.equal(response.status, 403); assert.equal(response.headers.get('set-cookie'), null);
});
test('invalid OAuth state returns to studio without exchanging credentials', async () => {
  configure(); global.fetch = async () => { throw new Error('must not fetch'); };
  const response = await GET(request('callback'), params('callback'));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${origin}/studio?github=failed`);
});
