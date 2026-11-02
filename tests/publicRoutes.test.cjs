const assert = require('node:assert/strict');
const { test } = require('node:test');
const origin = process.env.FORGEX_TEST_ORIGIN;

test('built public routes, SEO, support, legacy OAuth and PWA assets', { skip: !origin }, async () => {
  const read = async path => { const response = await fetch(`${origin}${path}`); assert.equal(response.status, 200, path); return response.text(); };
  const headers = await fetch(`${origin}/`);
  assert.equal(headers.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.headers.get('x-frame-options'), 'SAMEORIGIN');
  const home = await read('/');
  assert.match(home, /Understand your code/); assert.ok(!home.includes('id="forgex-mini-ide"'));
  assert.match(home, /href="\/studio"/);
  for (const path of ['/', '/privacy', '/terms', '/help']) {
    const html = path === '/' ? home : await read(path);
    assert.match(html, /mailto:braxtonbruzzzy@gmail.com/);
    assert.match(html, /https:\/\/wa.me\/255618811359/);
    assert.match(html, /href="https:\/\/braxcode.com"/);
    assert.match(html, /rel="canonical"/); assert.match(html, /property="og:image"/);
  }
  const legacy = await fetch(`${origin}/welcome`, { redirect: 'manual' });
  assert.equal(legacy.status, 308); assert.equal(legacy.headers.get('location'), '/');
  const oauth = await fetch(`${origin}/?github=connected`, { redirect: 'manual' });
  assert.equal(oauth.status, 307); assert.equal(oauth.headers.get('location'), '/studio?github=connected');
  const studio = await read('/studio'); assert.match(studio, /id="forgex-mini-ide"/); assert.match(studio, /noindex/);
  assert.equal(studio.match(/<title>([^<]+)<\/title>/)?.[1], 'Studio | FORGEX DevStudio');
  assert.ok(!studio.includes('LOCAL RULE ENGINE'));
  const robots = await read('/robots.txt'); assert.match(robots, /Disallow: \/studio/);
  const sitemap = await read('/sitemap.xml'); assert.ok(!sitemap.includes('/studio')); assert.ok(!sitemap.includes('/api/'));
  const manifest = JSON.parse(await read('/manifest.webmanifest')); assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const response = await fetch(`${origin}${icon.src}`); assert.equal(response.status, 200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 8)], [137,80,78,71,13,10,26,10]);
  }
  const missing = await fetch(`${origin}/does-not-exist`); assert.equal(missing.status, 404);
  const missingHtml = await missing.text(); assert.match(missingHtml, /Page not found/); assert.match(missingHtml, /href="\/studio"/);
  const social = await fetch(`${origin}/brand/social.png`); assert.equal(social.status, 200);
});
