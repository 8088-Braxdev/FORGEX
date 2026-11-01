const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-sc-test-'));
after(() => fs.rmSync(work, { recursive: true, force: true }));
const sourcePath = path.join(__dirname, '../src/lib/sourceControl.ts');
const original = fs.readFileSync(fs.existsSync(sourcePath) ? sourcePath : path.join(__dirname, 'sourceControl.ts'), 'utf8');
const output = ts.transpileModule(original, {
  fileName: 'sourceControl.ts',
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
const errors = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, 'sourceControl.ts must transpile');
fs.writeFileSync(path.join(work, 'sourceControl.js'), output.outputText, 'utf8');
const { compareWorkspace } = require(path.join(work, 'sourceControl.js'));
const file = (name, content) => ({path:name, content});

test('empty workspace has no changes', () => {
  const r = compareWorkspace([], []);
  assert.equal(r.changes.length, 0);
  assert.equal(r.unchanged, 0);
});
test('unchanged imported file is excluded', () => {
  const r = compareWorkspace([file('a.js','const a=1;')], [file('a.js','const a=1;')]);
  assert.equal(r.changes.length, 0);
  assert.equal(r.unchanged, 1);
});
test('new file is genuinely added', () => {
  const r = compareWorkspace([], [file('new.js','one\ntwo')]);
  assert.equal(r.added, 1);
  assert.equal(r.changes[0].status, 'added');
  assert.equal(r.changes[0].additions, 2);
  assert.equal(r.changes[0].deletions, 0);
});
test('deleted file preserves old line coordinates', () => {
  const r = compareWorkspace([file('old.js','one\ntwo')], []);
  assert.equal(r.deleted, 1);
  assert.deepEqual(r.changes[0].diff.map(x => x.oldLine), [1,2]);
  assert.equal(r.changes[0].deletions, 2);
});
test('modified file returns exact line changes and positions', () => {
  const r = compareWorkspace([file('a.js','a\nb\nc')],[file('a.js','a\nB\nc')]);
  assert.equal(r.modified, 1);
  assert.equal(r.changes[0].additions, 1);
  assert.equal(r.changes[0].deletions, 1);
  assert.equal(r.changes[0].diff.find(x => x.kind === 'add').newLine, 2);
  assert.equal(r.changes[0].diff.find(x => x.kind === 'remove').oldLine, 2);
});
test('multiple files have stable alphabetical order and do not mutate input', () => {
  const a = [file('z.txt','same'), file('a.txt','old')];
  const b = [file('z.txt','same'), file('a.txt','new'), file('b.txt','added')];
  const r = compareWorkspace(a,b);
  assert.deepEqual(r.changes.map(x => x.path), ['a.txt','b.txt']);
  assert.equal(a[1].content, 'old');
  assert.equal(b[1].content, 'new');
});
test('large files are explicitly limited rather than fabricated', () => {
  const before = Array.from({length:900}, (_,i)=>`before-${i}`).join('\n');
  const after = Array.from({length:900}, (_,i)=>`after-${i}`).join('\n');
  const r=compareWorkspace([file('large.ts',before)], [file('large.ts',after)]);
  assert.equal(r.modified, 1);
  assert.equal(r.limited, 1);
  assert.equal(r.changes[0].additions, null);
});
test('adding empty file reports zero added source lines', () => {
  const r=compareWorkspace([], [file('empty.ts','')]);
  assert.equal(r.added, 1);
  assert.equal(r.changes[0].additions, 0);
});
test('snapshot captured by value not reference can track future edits', () => {
  const current = [file('a.ts','first')];
  const baseline = current.map(f=>({...f}));
  const next = current.map(f=>({...f,content:'second'}));
  assert.equal(compareWorkspace(baseline,next).modified,1);
});

test('line-ending-only edits are described instead of presenting an empty diff', () => {
  const r=compareWorkspace([file('x.ts','a\r\nb')], [file('x.ts','a\nb')]);
  assert.equal(r.modified, 1);
  assert.match(r.changes[0].diff[0].text, /Line endings/);
});
