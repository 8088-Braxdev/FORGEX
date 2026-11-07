const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-toaststack-'));
const source = fs.readFileSync(path.join('src/lib', 'toastStack.ts'), 'utf8');
fs.writeFileSync(path.join(temp, 'toastStack.js'), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { registerToast, getToastStackIndex, subscribeToastStack } = require(path.join(temp, 'toastStack.js'));

test('toasts stack in registration order', () => {
  const unregisterA = registerToast('a');
  const unregisterB = registerToast('b');
  assert.equal(getToastStackIndex('a'), 0);
  assert.equal(getToastStackIndex('b'), 1);
  unregisterA();
  assert.equal(getToastStackIndex('b'), 0);
  unregisterB();
});

test('subscribe receives updates', () => {
  let calls = 0;
  const unsubscribe = subscribeToastStack(() => { calls++; });
  const unregister = registerToast('x');
  assert.ok(calls > 0);
  unregister();
  unsubscribe();
});