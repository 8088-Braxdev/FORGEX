# FORGEX Studio v0.2
**Developer Intelligence by BraxCode Digitals Foundation**

FORGEX is a self-hostable, free static diagnostic workbench. It now includes six working modules, not just links labeled “soon”. The dark/lime visual language continues from v0.1.

## Setup (Windows PowerShell)
1. Extract this ZIP once, and open the folder **containing** `package.json` in VS Code. Do not run npm in the parent ZIP folder.
2. Install Node.js 20.9+ (current Node LTS recommended). Python and Docker are **not** required for this version.
3. Run:

```powershell
npm install
npm run dev
```

4. Open `http://localhost:3000`.

If port 3000 is already in use by your old FORGEX, press `Ctrl+C` in the old terminal first. Don't run both servers on the same port.

## What works
- **Code Workbench:** edit multiple source files, import a selection or folder, run private on-device analysis with Ctrl+Enter; example project included.
- **Security Center:** evidence, potential impact, rule confidence, and fix guidance.
- **Project Health:** transparent weighted risk score and per-file summary; local baseline comparison.
- **Release Gate:** six evidence-based checks, distinguishing detection from actual test execution.
- **Rulebook:** toggle any of 30 visible rules; browser remembers preferences.
- **Local History:** saves recent scan summaries (not source code).
- **Fix Lab:** some selected rules show suggested per-line replacements; user explicitly reviews and applies, then can undo. These are not guaranteed behavior-preserving changes.
- **Reports:** export Markdown, JSON, or SARIF 2.1.0.
- Supports JavaScript, TypeScript, JSX/TSX, Python, HTML, CSS and basic JSON heuristics. No arbitrary source execution.

## Important boundaries
The engine uses text-pattern heuristics, not an AST, runtime debugger, AI model, penetration test, dependency CVE database, or live GitHub crawler. Findings are leads for a human to review. A clean report does NOT mean code is secure. The score is a convenience indicator, not a certification. Folder import is browser-based. **The web UI analyzes code directly in your browser and does not upload it.** Scan histories store metrics only. An optional `/api/analyze` endpoint exists for developer integrations; if you deliberately call that API, you are sending code to the server. Do not send secrets to a server you do not trust.

Limits: 120 files, 400,000 characters per file, 2 million characters per scan. Folder picker excludes node_modules, .git, .next, dist/build when paths are provided. It's not a substitute for a real CLI filesystem scanner.

## Security and quality checks

```powershell
npm run test:engine
npm run typecheck
npm run build
npm audit
```

The package pins Next.js `15.5.28` (October 2026 patched 15.x security release). React and other package updates still require review. If `npm audit` flags issues, inspect the full advisory; do not blindly run `npm audit fix --force`, which can introduce incompatible major releases.

## Roadmap (not yet shipped)
- Local repository agent / true cross-file code graph
- GitHub OAuth, branches, pull requests and CI integration
- Optional AI analysis with explicit cost controls
- First-class AST parsing, actual test runs, secret redaction and trusted sandboxing
- Authenticated multi-user cloud operations

All UI modules in v0.2 are genuinely interactive; these roadmap items are not represented as completed work.
