const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");

const sourceDir = path.join(__dirname, "../src/lib");
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "forgex-coverage-"));
after(() => fs.rmSync(buildDir, { recursive: true, force: true }));

for (const name of ["severity", "analyzer", "intelligence"]) {
  const filename = path.join(sourceDir, `${name}.ts`);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${name}.ts has transpilation errors`);
  fs.writeFileSync(path.join(buildDir, `${name}.js`), output.outputText, "utf8");
}

const analyzer = require(path.join(buildDir, "analyzer.js"));
const { buildIntelligenceV2, activeCoverage } = require(path.join(buildDir, "intelligence.js"));
const scan = (files, disabled = []) => analyzer.analyzeProject(files, disabled);

test("unsupported-only workspace is not scored", () => {
  const files = [{ path: "main.go", content: "package main" }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.score, null);
  assert.equal(report.coverage.genericOnlyFiles, 1);
  assert.equal(report.coverage.targetedFiles, 0);
});

test("mixed workspace reports exact uncovered count", () => {
  const files = [
    { path: "app.js", content: "const x = 1;" },
    { path: "one.go", content: "package main" },
    { path: "two.go", content: "package main" },
  ];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.coverage.genericOnlyFiles, 2);
  assert.equal(report.coverage.importedFiles, 3);
  assert.equal(report.coverage.targetedFiles, 1);
});

test("supported-only workspace behaves as before", () => {
  const files = [{ path: "main.js", content: "const result = 42;" }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.score, 100);
  assert.equal(report.coverage.withoutActiveRules, 0);
});

test("activeCoverage marks PHP as targeted after rules are added", () => {
  assert.equal(activeCoverage("index.php", new Set()), "targeted");
});