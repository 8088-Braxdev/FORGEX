const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/lib/previewProviders.ts"),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", code)(mod, mod.exports);
const { isApprovedProvider, makeProviderKey, validateCoordinates, APPROVED_PROVIDER_KEYS } = mod.exports;

assert.equal(isApprovedProvider("weather.current"), true);
assert.equal(isApprovedProvider("forgex.health"), true);
assert.equal(isApprovedProvider("evil.proxy"), false);
assert.equal(makeProviderKey("weather", "current"), "weather.current");
assert.deepEqual(validateCoordinates(10, 20), { ok: true });
assert.equal(validateCoordinates(999, 0).ok, false);
assert.equal(validateCoordinates(0, 999).ok, false);
assert.ok(APPROVED_PROVIDER_KEYS.includes("weather.current"));
console.log("previewProviders passed");