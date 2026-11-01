const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../src/components/ImageViewer.tsx"),
  "utf8",
);

// Extract the estimateImageBytes function by transpiling the whole module.
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;

const mod = { exports: {} };
// Stub React to avoid runtime requirements for the pure helper.
new Function("module", "exports", "require", code)(mod, mod.exports, (name) => {
  if (name === "react") return { useEffect: () => {}, useState: () => [null, () => {}] };
  if (name === "lucide-react") return {};
  return {};
});

const { estimateImageBytes } = mod.exports;
assert.equal(typeof estimateImageBytes, "function");
assert.equal(estimateImageBytes(""), 0);
assert.equal(estimateImageBytes("data:image/png;base64,AAAA"), 3);
// 4 base64 chars -> 3 bytes
assert.equal(estimateImageBytes("data:image/png;base64,AAAA"), 3);
console.log("ImageViewer helper passed");