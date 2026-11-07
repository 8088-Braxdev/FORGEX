const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-hashlinks-'));
for (const name of fs.readdirSync('src/lib').filter((name) => name.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join('src/lib', name), 'utf8');
  fs.writeFileSync(path.join(temp, name.replace(/\.ts$/, '.js')), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { buildPreview } = require(path.join(temp, 'ideCore.js'));

test('preview click handler handles in-page hash links', () => {
  const preview = buildPreview([{ path: 'index.html', content: '<a href="#gallery">Gallery</a>' }], 'fixture', '', []);
  assert.match(preview.html, /scrollIntoView/);
  assert.match(preview.html, /hashchange/);
});

test('preview navigation message includes hash for section links', () => {
  const preview = buildPreview([{ path: 'index.html', content: '<a href="about.html#team">Team</a>' }], 'fixture', '', []);
  assert.match(preview.html, /forgex-preview-navigation/);
});