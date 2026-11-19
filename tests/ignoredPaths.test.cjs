const assert = require("node:assert/strict");
const { test } = require("node:test");
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/lib/ignoredPaths.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", output)(mod, mod.exports);
const { IGNORED_PATHS } = mod.exports;

test("shared ignore filter skips configured paths and lockfiles", () => {
  assert.ok(IGNORED_PATHS.test("node_modules/foo.js"));
  assert.ok(IGNORED_PATHS.test("src/.git/config"));
  assert.ok(IGNORED_PATHS.test("dist/app.js"));
  assert.ok(IGNORED_PATHS.test("package-lock.json"));
  assert.ok(!IGNORED_PATHS.test("src/app.js"));
});