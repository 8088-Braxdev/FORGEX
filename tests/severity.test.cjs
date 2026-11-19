const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");

const sourceDir = path.join(__dirname, "../src/lib");
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "forgex-severity-"));
after(() => fs.rmSync(buildDir, { recursive: true, force: true }));

for (const name of ["severity", "analyzer", "changeSimulation"]) {
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

const { SEVERITY_PENALTY } = require(path.join(buildDir, "severity.js"));
const { analyzeProject } = require(path.join(buildDir, "analyzer.js"));
const { rawPenalty } = require(path.join(buildDir, "changeSimulation.js"));

test("severity table is shared by analyzer and change simulation", () => {
  assert.deepEqual(SEVERITY_PENALTY, { critical: 22, high: 12, medium: 4, low: 1.5 });
  const files = [{ path: "app.js", content: "eval(input);" }];
  const result = analyzeProject(files);
  const finding = result.findings[0];
  assert.equal(rawPenalty([finding]), SEVERITY_PENALTY[finding.severity]);
  assert.equal(result.score, 100 - SEVERITY_PENALTY.high);
});