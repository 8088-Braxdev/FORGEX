const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'forgex-preview-limits-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));

for (const name of fs.readdirSync('src/lib').filter((name) => name.endsWith('.ts'))) {
  const source = fs.readFileSync(path.join('src/lib', name), 'utf8');
  fs.writeFileSync(
    path.join(temp, name.replace(/\.ts$/, '.js')),
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
  );
}

const { detectPreviewLimits, hasSensitiveEnvironmentReference } = require(
  path.join(temp, 'previewLimits.js'),
);

test('sensitive environment references are detected in dot and bracket access', () => {
  assert.equal(hasSensitiveEnvironmentReference('process.env.GROQ_API_KEY'), true);
  assert.equal(hasSensitiveEnvironmentReference('import.meta.env.VITE_AUTH_TOKEN'), true);
  assert.equal(hasSensitiveEnvironmentReference('process.env["CLIENT_SECRET"]'), true);
  assert.equal(hasSensitiveEnvironmentReference("process.env['API_KEY']"), true);
  assert.equal(hasSensitiveEnvironmentReference('const key = process.env.NODE_ENV'), false);
  assert.equal(hasSensitiveEnvironmentReference('import.meta.env.MODE'), false);
});

test('server files and server frameworks are detected', () => {
  assert.equal(
    detectPreviewLimits([{ path: 'src/app/api/chat/route.ts', content: '' }]).serverCode,
    true,
  );
  assert.equal(
    detectPreviewLimits([{ path: 'pages/api/hello.ts', content: '' }]).serverCode,
    true,
  );
  assert.equal(
    detectPreviewLimits([{ path: 'server.js', content: "const express = require('express');" }]).serverCode,
    true,
  );
  assert.equal(
    detectPreviewLimits([{ path: 'server.js', content: "import fastify from 'fastify';" }]).serverCode,
    true,
  );
  assert.equal(
    detectPreviewLimits([{ path: 'server.js', content: 'server.listen(3000);' }]).serverCode,
    true,
  );
  assert.equal(
    detectPreviewLimits([{ path: 'index.html', content: '<h1>Static</h1>' }]).serverCode,
    false,
  );
});

test('environment and server signals combine without exposing values', () => {
  const signals = detectPreviewLimits([
    { path: 'app.js', content: 'fetch("/api/chat", { headers: { Authorization: process.env.GROQ_API_KEY } });' },
    { path: 'server.js', content: 'server.listen(3000);' },
  ]);

  assert.deepEqual(signals, { environmentSecrets: true, serverCode: true });
});
