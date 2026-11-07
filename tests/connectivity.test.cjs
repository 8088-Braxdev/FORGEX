const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-connectivity-'));
const source = fs.readFileSync(path.join('src/lib', 'connectivity.ts'), 'utf8');
fs.writeFileSync(path.join(temp, 'connectivity.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { INITIAL_CONNECTIVITY, connectivityTransition } = require(path.join(temp, 'connectivity.js'));

test('two failures declare offline and show toast once', () => {
  let state = INITIAL_CONNECTIVITY;
  let r = connectivityTransition(state, 'failure');
  state = r.state; assert.equal(r.transition, 'none'); assert.equal(state.online, true);
  r = connectivityTransition(state, 'failure');
  state = r.state; assert.equal(r.transition, 'toOffline'); assert.equal(state.online, false);
  // still offline heartbeats do not re-trigger
  r = connectivityTransition(state, 'failure');
  assert.equal(r.transition, 'none');
});

test('success while offline returns online', () => {
  let state = { online: false, failures: 2 };
  const r = connectivityTransition(state, 'success');
  assert.equal(r.transition, 'toOnline'); assert.equal(r.state.online, true); assert.equal(r.state.failures, 0);
});

test('navigator online clears offline immediately', () => {
  let state = { online: false, failures: 2 };
  const r = connectivityTransition(state, 'navigator-online');
  assert.equal(r.transition, 'toOnline'); assert.equal(r.state.online, true);
});

test('single navigator offline does not declare offline', () => {
  let state = INITIAL_CONNECTIVITY;
  const r = connectivityTransition(state, 'navigator-offline');
  assert.equal(r.transition, 'none'); assert.equal(r.state.online, true);
});