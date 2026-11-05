const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-siteinfo-'));
const source = fs.readFileSync('src/lib/siteInfo.ts', 'utf8');
fs.writeFileSync(
  path.join(temp, 'siteInfo.js'),
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
);

function loadSiteInfo() {
  const modulePath = path.join(temp, 'siteInfo.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('SITE_ORIGIN defaults to the new production origin', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(loadSiteInfo().SITE_ORIGIN, 'https://forgexdevstudio.braxcode.com');
});

test('SITE_ORIGIN uses a valid https override and strips a trailing slash', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.example.com/';
  assert.equal(loadSiteInfo().SITE_ORIGIN, 'https://preview.example.com');
});

test('SITE_ORIGIN falls back for invalid or non-https overrides', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'http://preview.example.com';
  assert.equal(loadSiteInfo().SITE_ORIGIN, 'https://forgexdevstudio.braxcode.com');
});
