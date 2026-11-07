const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');

test('middleware guards iframe document requests', () => {
  const source = fs.readFileSync('middleware.ts', 'utf8');
  assert.match(source, /sec-fetch-dest/i);
  assert.match(source, /iframe/);
  assert.match(source, /This page can't be shown inside the preview/);
  assert.match(source, /NextResponse/);
});