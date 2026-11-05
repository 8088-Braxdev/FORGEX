const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = path.join(root, "node_modules", "monaco-editor", "min", "vs");
const destination = path.join(root, "public", "monaco", "vs");

if (!fs.existsSync(source)) {
  console.error(`Monaco source not found: ${source}`);
  process.exit(1);
}

fs.rmSync(path.join(root, "public", "monaco"), {
  recursive: true,
  force: true,
});
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.cpSync(source, destination, { recursive: true });

console.log(`Copied Monaco to ${destination}`);
