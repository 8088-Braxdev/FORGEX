const assert = require("node:assert/strict");
const { test, after } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");

const sourceDir = path.join(__dirname, "../src/lib");
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "forgex-php-scss-"));
after(() => fs.rmSync(buildDir, { recursive: true, force: true }));

for (const name of ["severity", "analyzer"]) {
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

const { analyze, inferLanguage, activeCoverage } = require(path.join(buildDir, "analyzer.js"));

function hasRule(code, ruleId) {
  return analyze(code, "php", "test.php").some((finding) => finding.ruleId === ruleId);
}

test("PHP rules match dangerous patterns", () => {
  assert.ok(hasRule("eval($input);", "PHP001"));
  assert.ok(hasRule("system($_GET['cmd']);", "PHP002"));
  assert.ok(hasRule("exec($_POST['cmd']);", "PHP002"));
  assert.ok(hasRule("shell_exec($_REQUEST['cmd']);", "PHP002"));
  assert.ok(hasRule("passthru($_GET['cmd']);", "PHP002"));
  assert.ok(hasRule("popen($_GET['cmd'], 'r');", "PHP002"));
  assert.ok(hasRule("proc_open($_GET['cmd'], [], $pipes);", "PHP002"));
  assert.ok(hasRule("unserialize($_GET['data']);", "PHP003"));
  assert.ok(hasRule('query("SELECT * FROM users WHERE id = " . $_GET["id"]);', "PHP004"));
  assert.ok(hasRule("include $_GET['page'];", "PHP005"));
  assert.ok(hasRule("require($_REQUEST['file']);", "PHP005"));
  assert.ok(hasRule('$password = "secret123456";', "PHP006"));
});

test("PHP rules ignore lookalikes", () => {
  assert.ok(!hasRule("evaluation($input);", "PHP001"));
  assert.ok(!hasRule("systematic($_GET['cmd']);", "PHP002"));
  assert.ok(!hasRule("json_decode($_GET['data']);", "PHP003"));
  assert.ok(!hasRule('query("SELECT * FROM users WHERE id = 1");', "PHP004"));
  assert.ok(!hasRule("include 'header.php';", "PHP005"));
  assert.ok(!hasRule("$password = getenv('DB_PASSWORD');", "PHP006"));
});

test("SCSS is supported through CSS rules without false positives", () => {
  assert.equal(inferLanguage("styles.scss"), "css");
  const scss = "$color: red;\n@mixin box { display: flex; }\n.card { color: $color; @include box; }";
  assert.deepEqual(analyze(scss, "css", "styles.scss"), []);
});