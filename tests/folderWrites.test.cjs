const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const ts = require('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-folder-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
for (const name of ['paths', 'folderWrites']) fs.writeFileSync(path.join(temp, `${name}.js`), ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
const { prepareFolderWrites, writeFolderChanges } = require(path.join(temp, 'folderWrites.js'));
function mockDirectory(initial) {
  const data = new Map(Object.entries(initial).map(([p,v]) => [p, Buffer.from(v)]));
  const writes = []; let onClose = () => {}; let failed = false; let aborted = false;
  const missing = () => Object.assign(new Error('Missing'), { name: 'NotFoundError' });
  function folder(prefix = '') { return {
    async getDirectoryHandle(name, options) {
      if (!options.create && ![...data.keys()].some(p => p.startsWith(prefix + name + '/'))) throw missing();
      return folder(prefix + name + '/');
    },
    async getFileHandle(name, options) {
      const p = prefix + name;
      if (!options.create && !data.has(p)) throw missing();
      return { async getFile() { const bytes = data.get(p); return { size: bytes.length, async arrayBuffer() { return Uint8Array.from(bytes).buffer; } }; }, async createWritable() {
        let pending;
        return { async write(bytes) { if (failed) throw new Error('Write denied'); pending = Buffer.from(bytes); }, async close() { data.set(p, pending); writes.push(p); onClose(p); }, async abort() { aborted = true; } };
      } };
    }
  }; }
  return { root: folder(), data, writes, setOnClose(fn) { onClose = fn; }, failWrites() { failed = true; }, get aborted() { return aborted; } };
}
const entry = (path, content) => ({ path, bytes: Uint8Array.from(Buffer.from(content)) });
test('folder save writes changed text and binary bytes, preserving unrelated files', async () => {
  const dir = mockDirectory({ 'same.txt': 'same', 'old.txt': 'old', 'untouched.txt': 'keep' });
  const changes = await prepareFolderWrites(dir.root, [entry('same.txt', 'same'), entry('old.txt', 'new'), entry('images/a.png', Buffer.from([0, 255, 1]))]);
  assert.equal(changes.length, 2); assert.equal(await writeFolderChanges(dir.root, changes), 2);
  assert.deepEqual(dir.data.get('images/a.png'), Buffer.from([0,255,1])); assert.equal(dir.data.get('untouched.txt').toString(), 'keep');
});
test('external changes after review block all writes', async () => {
  const dir = mockDirectory({ 'a.txt': 'old' });
  const changes = await prepareFolderWrites(dir.root, [entry('a.txt', 'new'), entry('b.txt', 'new')]);
  dir.data.set('a.txt', Buffer.from('external'));
  await assert.rejects(writeFolderChanges(dir.root, changes), error => error.written === 0 && /External change/.test(error.message));
  assert.deepEqual(dir.writes, []); assert.equal(dir.data.get('a.txt').toString(), 'external');
});
test('changes during a multi-file write stop remaining writes and report partial completion', async () => {
  const dir = mockDirectory({ 'a.txt': 'old', 'b.txt': 'old' });
  const changes = await prepareFolderWrites(dir.root, [entry('a.txt', 'new'), entry('b.txt', 'new')]);
  dir.setOnClose(p => { if (p === 'a.txt') dir.data.set('b.txt', Buffer.from('external')); });
  await assert.rejects(writeFolderChanges(dir.root, changes), error => error.written === 1);
  assert.equal(dir.data.get('b.txt').toString(), 'external');
});
test('unsafe paths are rejected before filesystem access', async () => {
  const root = new Proxy({}, { get() { throw new Error('Filesystem must not be reached'); } });
  await assert.rejects(prepareFolderWrites(root, [entry('../outside.txt', 'x')]), /Invalid folder write path/);
});
test('failed writes abort their writable stream', async () => {
  const dir = mockDirectory({ 'a.txt': 'old' });
  const changes = await prepareFolderWrites(dir.root, [entry('a.txt', 'new')]); dir.failWrites();
  await assert.rejects(writeFolderChanges(dir.root, changes), error => error.written === 0);
  assert.equal(dir.aborted, true); assert.equal(dir.data.get('a.txt').toString(), 'old');
});
