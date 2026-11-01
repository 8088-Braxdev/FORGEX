
const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");

const sourceDir = path.join(__dirname, "../src/lib");

const buildDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "forgex-intelligence-v2-")
);

after(() => {
  fs.rmSync(buildDir, {
    recursive: true,
    force: true
  });
});

for (const name of ["analyzer", "intelligence"]) {
  const filename = path.join(sourceDir, `${name}.ts`);
  const source = fs.readFileSync(filename, "utf8");

  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    },
    reportDiagnostics: true
  });

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  );

  assert.equal(
    errors.length,
    0,
    `${name}.ts has transpilation errors`
  );

  fs.writeFileSync(
    path.join(buildDir, `${name}.js`),
    output.outputText,
    "utf8"
  );
}

const analyzer = require(
  path.join(buildDir, "analyzer.js")
);

const { buildIntelligenceV2 } = require(
  path.join(buildDir, "intelligence.js")
);

const scan = (files, disabled) =>
  analyzer.analyzeProject(files, disabled);


test('empty workspace does not claim a score', () => {
  const report = buildIntelligenceV2([], null);
  assert.equal(report.score, null);
  assert.equal(report.status, 'empty');
});
test('clean JS gets targeted coverage, with no findings', () => {
  const files = [{ path: 'main.js', content: 'const result = 42;' }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.score, 100);
  assert.equal(report.coverage.targetedFiles, 1);
});
test('many low findings do not force score to 0', () => {
  const files = [{ path: 'app.js', content: Array.from({length:150}, (_,i)=>`console.log(${i});`).join('\n') }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.ok(report.score > 0 && report.score < 100);
});
test('identical rule/line hits count as one unique issue', () => {
  const files = [{ path:'app.js', content:'console.log(1); console.log(2);' }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.summary.findings, 2);
  assert.equal(report.summary.uniqueIssues, 1);
});
test('markdown-only repository is generic coverage, no meaningful score', () => {
  const files = [{ path:'README.md', content:'# Readme' }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.equal(report.coverage.genericOnlyFiles, 1);
  assert.equal(report.score, null);
});
test('security and quality signals remain separate', () => {
  const files = [{ path:'app.js',content: 'ev' + 'al(input);\nconsole.log(1);'  }];
  const report = buildIntelligenceV2(files, scan(files));
  assert.ok(report.securityScore < 100);
  assert.ok(report.qualityScore < 100);
  assert.equal(report.priorities[0].ruleId, 'JS001');
});
test('partial analyzer scan and omitted imported files flagged', () => {
  const files = [{path:'safe.js',content:'const a=1;'}, {path:'huge.js',content:'x'.repeat(400001)}];
  assert.equal(buildIntelligenceV2(files,scan(files)).status, 'partial');
  const single = [files[0]];
  assert.equal(buildIntelligenceV2(single,scan(single),[],true).status, 'partial');
});
