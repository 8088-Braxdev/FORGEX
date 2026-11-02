const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const ts = require('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-assets-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
for (const name of fs.readdirSync('src/lib').filter(name => name.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join('src/lib', name), 'utf8');
  fs.writeFileSync(path.join(temp, name.replace(/\.ts$/, '.js')), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText);
}
const { validatePreviewAssets, svgPreviewUrl } = require(path.join(temp, 'previewAssets.js'));
const { verifyDraft } = require(path.join(temp, 'workspaceDraft.js'));
const { exportWorkspaceBackup, parseWorkspaceBackup } = require(path.join(temp, 'workspaceBackup.js'));
const { exportBackup, buildPreview } = require(path.join(temp, 'ideCore.js'));
const { importGitHubRepository } = require(path.join(temp, 'githubImport.js'));
const png = fs.readFileSync('public/brand/icon-192.png');
const asset = { path: 'images/mark.png', dataUrl: `data:image/png;base64,${png.toString('base64')}` };
const file = { path: 'index.html', content: '\ufeff<h1>Project</h1><img src="./images/mark.png">' };
const repo = { fullName: 'owner/repo', branch: 'main', commitSha: 'a'.repeat(40), partial: false, importedPaths: ['index.html', 'deleted.js'] };
const snapshot = { savedAt: 123, files: [file], assets: [asset], baselineFiles: [file, { path: 'deleted.js', content: 'original' }], githubBaselineFiles: [file, { path: 'deleted.js', content: 'original' }], selectedPath: asset.path, repoUrl: 'https://github.com/owner/repo', repoIdentity: repo };

test('asset registry preserves binary bytes separately from source', () => {
  const result = validatePreviewAssets([asset], [file.path]);
  assert.deepEqual(Buffer.from(result[0].dataUrl.split(',')[1], 'base64'), png);
  assert.equal(result[0].content, undefined);
});
test('invalid image signature, traversal, collisions and counts are rejected', () => {
  for (const bad of [{ ...asset, path: '../mark.png' }, { ...asset, dataUrl: 'data:image/png;base64,PGgxPm5vPC9oMT4=' }]) assert.throws(() => validatePreviewAssets([bad]));
  assert.throws(() => validatePreviewAssets([asset], ['IMAGES/MARK.PNG']));
  assert.throws(() => validatePreviewAssets([asset, asset]));
  assert.throws(() => validatePreviewAssets(Array.from({ length: 33 }, (_, n) => ({ ...asset, path: `${n}.png` }))));
});
test('active SVG is preserved as source but excluded from image preview', () => {
  assert.equal(svgPreviewUrl('<svg onload="alert(1)"></svg>'), null);
  assert.equal(svgPreviewUrl('<svg><script>alert(1)</script></svg>'), null);
  assert.equal(svgPreviewUrl('<svg><image href="https://untrusted.invalid/x" /></svg>'), null);
  assert.match(svgPreviewUrl('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>'), /^data:image\/svg\+xml/);
});
test('backup round trip retains assets, original baselines and deleted imported paths', () => {
  const restored = parseWorkspaceBackup(exportWorkspaceBackup(snapshot));
  assert.deepEqual(restored, verifyDraft(snapshot));
  assert.equal(restored.selectedPath, asset.path);
  assert.ok(restored.repoIdentity.importedPaths.includes('deleted.js'));
  assert.equal(restored.githubBaselineFiles[1].content, 'original');
});
test('image-only workspace and deletion of every source file preserve identity', () => {
  const restored = parseWorkspaceBackup(exportWorkspaceBackup({ ...snapshot, files: [] }));
  assert.equal(restored.files.length, 0); assert.equal(restored.assets.length, 1);
  assert.deepEqual(restored.repoIdentity.importedPaths, repo.importedPaths);
});
test('legacy text backups remain readable', () => {
  const restored = parseWorkspaceBackup(exportBackup([file]));
  assert.deepEqual(restored.files, [file]); assert.deepEqual(restored.assets, []);
});
test('nested preview references receive safe asset URLs and local CSS URLs', () => {
  const preview = buildPreview([{ path: 'pages/index.html', content: '<link rel="stylesheet" href="../styles/main.css"><img src="../images/mark.png">' }, { path: 'styles/main.css', content: 'body{background:url(../images/mark.png)}' }], 'fixture', 'pages/index.html', [asset]);
  assert.equal(preview.entry, 'pages/index.html');
  assert.equal(preview.html.split(asset.dataUrl).length - 1, 2);
});

test('GitHub import pins commit identity, preserves nested images and keeps tokens server-side', async () => {
  const originalFetch = global.fetch; const requests = [];
  const contentSha = 'c'.repeat(40), imageSha = 'd'.repeat(40), treeSha = 'b'.repeat(40), commitSha = 'a'.repeat(40);
  global.fetch = async (input, init) => {
    const url = String(input); requests.push({ url, init });
    const base = 'https://api.github.com/repos/owner/repo';
    if (url === base) return Response.json({ default_branch: 'main' });
    if (url.endsWith('/branches/main')) return Response.json({ commit: { sha: commitSha, commit: { tree: { sha: treeSha } } } });
    if (url.endsWith(`/git/trees/${treeSha}?recursive=1`)) return Response.json({ tree: [
      { type: 'blob', mode: '100644', path: file.path, sha: contentSha, size: Buffer.byteLength(file.content) },
      { type: 'blob', mode: '100644', path: asset.path, sha: imageSha, size: png.length },
      { type: 'blob', mode: '120000', path: 'link.js', sha: 'e'.repeat(40), size: 10 },
    ] });
    if (url.endsWith(`/git/blobs/${contentSha}`)) return Response.json({ encoding: 'base64', content: Buffer.from(file.content).toString('base64') });
    if (url.endsWith(`/git/blobs/${imageSha}`)) return Response.json({ encoding: 'base64', content: png.toString('base64') });
    throw new Error('Unexpected GitHub request');
  };
  try {
    const result = await importGitHubRepository('https://github.com/owner/repo', 'fixture-token');
    assert.equal(result.commitSha, commitSha); assert.deepEqual(result.files, [file]);
    assert.deepEqual(result.assets, [asset]); assert.equal(result.partial, true); assert.equal(result.skipped, 1);
    assert.equal(result.files[0].content.charCodeAt(0), 65279, 'UTF-8 BOM must remain in the original GitHub baseline');
    assert.ok(!JSON.stringify(result).includes('fixture-token'));
    assert.ok(requests.every(request => request.url.startsWith('https://api.github.com/repos/owner/repo') && request.init.redirect === 'error'));
  } finally { global.fetch = originalFetch; }
});

test('real PNG, JPEG, WebP, animated GIF and ICO bytes survive validation', () => {
  const definitions = [['png','image/png'], ['jpg','image/jpeg'], ['webp','image/webp'], ['gif','image/gif']];
  for (const [extension, mime] of definitions) {
    const bytes = fs.readFileSync(`tests/fixtures/images/pixel.${extension}`);
    const image = { path: `nested/pixel.${extension}`, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` };
    assert.deepEqual(validatePreviewAssets([image]), [image]);
  }
  const bytes = fs.readFileSync('public/favicon.ico');
  assert.equal(validatePreviewAssets([{ path: 'favicon.ico', dataUrl: `data:image/x-icon;base64,${bytes.toString('base64')}` }]).length, 1);
});
test('responsive image and favicon references are embedded without losing descriptors', () => {
  const preview = buildPreview([{ path: 'index.html', content: '<link rel="icon" href="./images/mark.png"><picture><source srcset="./images/mark.png 1x, ./images/mark.png 2x"><img src="./images/mark.png"></picture>' }], 'fixture', '', [asset]);
  assert.equal(preview.html.split(asset.dataUrl).length - 1, 4);
  assert.ok(preview.html.includes(' 1x, ')); assert.ok(preview.html.includes(' 2x'));
});
test('GitHub URL parsing rejects credentials and off-host targets before requests', async () => {
  await assert.rejects(importGitHubRepository('https://github.com.evil.invalid/owner/repo'), /Use https/);
  await assert.rejects(importGitHubRepository('https://secret@github.com/owner/repo'), /Use https/);
});
const { readSmallJson } = require(path.join(temp, 'requestBody.js'));
test('JSON request limits apply to streamed bytes and content type', async () => {
  const request = body => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.deepEqual(await readSmallJson(request('{"url":"ok"}')), { url: 'ok' });
  await assert.rejects(readSmallJson(request('invalid')), error => error.status === 400);
  await assert.rejects(readSmallJson(new Request('https://example.test', { method: 'POST', body: 'text' })), error => error.status === 415);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(1025))); controller.close(); } });
  await assert.rejects(readSmallJson(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' })), error => error.status === 413);
});
test('dependency impact follows the agreed changed/direct/indirect chain', () => {
  const { buildDependencyImpact } = require(path.join(temp, 'dependencyImpact.js'));
  const baseline = [ { path: 'utils.js', content: 'export const value = 1;' }, { path: 'app.js', content: 'import { value } from "./utils.js";' }, { path: 'index.html', content: '<script src="./app.js"></script>' } ];
  const current = baseline.map(file => file.path === 'utils.js' ? { ...file, content: 'export const value = 2;' } : file);
  const report = buildDependencyImpact(baseline, current);
  assert.equal(report.changedFiles.length, 1); assert.equal(report.direct.length, 1); assert.equal(report.indirect.length, 1); assert.equal(report.unresolved, 0);
});

test('failed blob downloads cannot expand the GitHub request budget beyond selected files', async () => {
  const previousFetch = global.fetch; let blobCalls = 0;
  global.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/owner/repo')) return Response.json({ default_branch: 'main' });
    if (url.endsWith('/branches/main')) return Response.json({ commit: { sha: 'a'.repeat(40), commit: { tree: { sha: 'b'.repeat(40) } } } });
    if (url.includes('/git/trees/')) return Response.json({ tree: Array.from({ length: 150 }, (_, index) => ({ type: 'blob', mode: '100644', path: `file-${index}.js`, size: 1, sha: 'c'.repeat(40) })) });
    blobCalls++; throw new Error('Provider unavailable');
  };
  try { await assert.rejects(importGitHubRepository('https://github.com/owner/repo'), /No supported files/); assert.equal(blobCalls, 60); }
  finally { global.fetch = previousFetch; }
});
test('generated Preview instrumentation and chatbot fixture compile as classic scripts', () => {
  const vm = require('node:vm');
  const preview = buildPreview([{ path: 'index.html', content: fs.readFileSync('examples/preview-chatbot/index.html', 'utf8') }, { path: 'app.js', content: fs.readFileSync('examples/preview-chatbot/app.js', 'utf8') }, { path: 'style.css', content: fs.readFileSync('examples/preview-chatbot/style.css', 'utf8') }], 'fixture', '', [], '/api/chat');
  const scripts = [...preview.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length >= 2);
  for (const [, script] of scripts) new vm.Script(script);
});
test('GitHub access failures retain their HTTP status for safe public fallback', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('', { status: 403 });
  try { await assert.rejects(importGitHubRepository('https://github.com/owner/repo', 'fixture-token'), error => error.status === 403); }
  finally { global.fetch = originalFetch; }
});
test('recovery migrates once, isolates new assets from old tabs and does not resurrect cleared drafts', async () => {
  const original = global.indexedDB;
  const stores = new Map([['forgex-local-workspace-v2', new Map([['active', structuredClone(snapshot)]])]]);
  global.indexedDB = { open(name) {
    const fresh = !stores.has(name); if (fresh) stores.set(name, new Map());
    const store = stores.get(name); let created = !fresh;
    const database = {
      objectStoreNames: { contains() { return created; } }, createObjectStore() { created = true; }, close() {},
      transaction() {
        const transaction = { objectStore() { return {
          get(key) { const request = {}; queueMicrotask(() => { request.result = structuredClone(store.get(key)); request.onsuccess?.(); transaction.oncomplete?.(); }); return request; },
          put(value, key) { store.set(key, structuredClone(value)); queueMicrotask(() => transaction.oncomplete?.()); },
        }; } }; return transaction;
      },
    };
    const request = { result: database };
    queueMicrotask(() => { if (fresh) request.onupgradeneeded?.(); request.onsuccess?.(); });
    return request;
  } };
  try {
    const recovery = require(path.join(temp, 'workspaceDraft.js'));
    const migrated = await recovery.readWorkspaceDraft(); assert.equal(migrated.assets[0].dataUrl, asset.dataUrl);
    stores.get('forgex-local-workspace-v2').set('active', { ...snapshot, files: [{ path: 'old.txt', content: 'old tab' }], assets: [] });
    const reread = await recovery.readWorkspaceDraft(); assert.equal(reread.assets.length, 1); assert.equal(reread.files[0].path, file.path);
    await recovery.clearWorkspaceDraft(); assert.equal(await recovery.readWorkspaceDraft(), null);
    assert.equal(stores.get('forgex-local-workspace-v2').get('active').files[0].path, 'old.txt');
  } finally { global.indexedDB = original; }
});
test('GitHub JSON budget accounts for escaping and reports omitted files as partial', async () => {
  const previousFetch = global.fetch;
  const content = '"'.repeat(125000);
  global.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/owner/repo')) return Response.json({ default_branch: 'main' });
    if (url.endsWith('/branches/main')) return Response.json({ commit: { sha: 'a'.repeat(40), commit: { tree: { sha: 'b'.repeat(40) } } } });
    if (url.includes('/git/trees/')) return Response.json({ tree: Array.from({ length: 20 }, (_, index) => ({ type: 'blob', mode: '100644', path: `file-${index}.js`, size: content.length, sha: 'c'.repeat(40) })) });
    return Response.json({ encoding: 'base64', content: Buffer.from(content).toString('base64') });
  };
  try {
    const result = await importGitHubRepository('https://github.com/owner/repo');
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 4_000_000);
    assert.equal(result.partial, true); assert.ok(result.skipped > 0);
  } finally { global.fetch = previousFetch; }
});
