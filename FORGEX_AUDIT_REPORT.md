# FORGEX DevStudio — Read-Only Audit Report

- **Repository:** `8088-Braxdev/FORGEX`
- **Audited commit (main):** `52261c1` (branch created from this SHA for the report only)
- **Audit date:** 2026-11-17
- **Method:** Static source review via the GitHub API — all files under `src/lib`, `src/components`, `src/app/api`, `middleware.ts`, `public/`, `extension/`, `tests/`, root docs and the homepage/help pages were read in full. The two very large files — `src/components/MiniIDE.tsx` (~146 KB) and `src/app/studio/Workbench.tsx` (~83 KB) — were reviewed through raw-source reads and compacted extraction; findings citing them are marked **Likely** where full line-level verification was not possible.
- **No code was modified.** The only artifact of this audit is this file. Nothing was committed to `main`.

**Legend**

| Tag | Meaning |
|---|---|
| Critical / High / Medium / Low | Severity of the issue |
| Verified | Read directly in source at this commit |
| Likely | Strong evidence, but the exact line path was not fully traced (large-file compaction) |
| Unverified | Could not be confirmed with available tooling; noted with what would be needed |

Line numbers are cited only where a short file was read end-to-end; otherwise evidence cites the exact function name and file, with short verbatim identifiers. No line numbers are invented.

---

## 1. Executive summary

1. **Critical (Verified):** The scanner silently under-covers most languages. `src/lib/analyzer.ts` maps only `js, mjs, cjs, ts, jsx, tsx, py, html, htm, css, json` (function `inferLanguage`); every other extension becomes `"other"` and only the `GEN001` TODO-marker rule applies. A project made mostly of PHP/Java/Go/Rust/SCSS/etc. scans to **score 100, risk "Low", label "Healthy"** with zero meaningful checks — a confirmed false-sense-of-safety.
2. **High (Verified):** Import and editor support are far wider than scanner support. `src/lib/githubImport.ts` imports `php|go|rs|java|c|h|cpp|hpp|cs|sql|sh|md|txt|yml|yaml|xml|scss` text files, and `src/lib/ideCore.ts` maps ~25 extensions for Monaco highlighting — users can import and edit files the scanner cannot meaningfully analyze, with no per-file warning.
3. **High (Likely):** The beta tester's "editor partially works, no bug specified" is explainable by three **documented but unapplied defects**: health score shows "Not scanned" until a manual Analyze (`PATCH_LIVE_HEALTH_SCORE.md`), preview CSP blocks `api.fontshare.com` stylesheets (silent style loss), and XHR/axios projects never get proxy fallback so API responses silently never display (`PATCH_PREVIEW_API_FIXES.md`).
4. **Medium (Verified):** Removing the VS Code extension folder is **not clean as-is**: `extension/src/extension.ts` imports `../../src/lib/analyzer` and `extension/tsconfig.json` compiles `../src/lib/analyzer.ts`. The web studio does **not** depend on the extension, so removal is safe for the app once the extension's `tsconfig` references and the `@types/vscode` / `@vscode/vsce` devDependencies are removed in the same change.
5. **Medium (Verified):** Marketing claims are mostly measured ("advisory", "not a certification" appear throughout the UI), but the "Healthy" score on un-analyzable projects is the main honesty gap. Three inconsistent severity-weight tables coexist (`analyzer.ts` 22/12/4/1.5, `intelligence.ts` 18/9/3/1, `changeSimulation.ts` 22/12/4/1.5), so different panels can show different numbers for the same findings.

---

## 2. Architecture map

**Stack:** Next.js 15.5.28 (App Router), React 19, TypeScript strict, Monaco editor self-hosted at `/monaco/vs` via `scripts/copy-monaco.cjs` (copied from `node_modules` at `postinstall`/`prebuild`; `public/monaco/` is gitignored). Vercel deployment implied by `VERCEL_ENV` / `VERCEL_URL` usage (`src/lib/siteInfo.ts`, `src/app/api/preview/proxy/route.ts`). **No database, no ORM, no Supabase** (verified: no `supabase` occurrence in any read file; `.env.example` lists only `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_COOKIE_KEY`, `FORGEX_APP_ORIGIN`, `GEMINI_API_KEY`).

**Routes:** Public pages `/`, `/help`, `/privacy`, `/terms`, `/welcome`; the studio at `/studio` renders `src/app/studio/Workbench.tsx`. API: `/api/analyze`, `/api/github-import`, `/api/github/[action]` (connect / callback / session / repositories / import / publish / release-gate), `/api/preview/{ai,gateway,health,proxy}`. `middleware.ts` blocks iframe navigation of non-static pages (preview frame guard).

**Core libraries (`src/lib/`):**

| Module | Role |
|---|---|
| `analyzer.ts` | The scanner: 30 regex rules keyed by language; `analyze()` + `analyzeProject()`; exports `RULE_CATALOG` |
| `intelligence.ts` | "Intelligence 2.0" advisory scores + coverage stats |
| `sourceControl.ts` | Bounded LCS line diff (`compareWorkspace`) |
| `changeIntelligence.ts` | Baseline-vs-current review (introduced/resolved findings, dependency impact) |
| `dependencyImpact.ts` / `impact.ts` | Two regex import-graph builders (overlapping; see J) |
| `changeSimulation.ts` | One-line replacement re-scan simulation |
| `ideCore.ts` | Preview builder (`buildPreview`), language map, workspace validation |
| `githubImport.ts`, `githubPublishRetry.ts`, `prReview.ts` | GitHub import/publish/review logic |
| `workspaceDraft.ts`, `workspaceBackup.ts` | IndexedDB persistence + 18 MB JSON backup |
| `previewAssets.ts`, `previewLimits.ts`, `folderWrites.ts`, `paths.ts`, `requestBody.ts`, `connectivity.ts` | Image validation, preview-limit detection, folder writes, path safety, request limits, offline detection |

**State:** All client state lives in React hooks in `Workbench.tsx`; the workspace draft (files, baseline, github baseline, repo identity, assets) persists to IndexedDB DB `forgex-local-workspace-v3`, store `drafts`, key `active` (`src/lib/workspaceDraft.ts`). PR numbers persist to `localStorage`. The only server-side session is the GitHub OAuth token in an AES-256-GCM-encrypted cookie.

**External services:** GitHub REST API (import/publish/release-gate), Gemini API (dev-only), Open-Meteo (dev-only), and the preview proxy (arbitrary public HTTPS targets, SSRF-guarded).

**Scanner connectivity:** `src/lib/analyzer.ts` is imported directly by `MiniIDE.tsx`, `Workbench.tsx`, `ChangeIntelligencePanel`, `intelligence.ts`, `changeSimulation.ts`, the API route `/api/analyze`, the tests, **and the VS Code extension**. It is a single shared module — one change affects all consumers.

```text
FORGEX/
├── extension/            # VS Code extension (imports src/lib/analyzer)
├── middleware.ts         # iframe frame guard
├── next.config.ts        # headers (nosniff, X-Frame-Options, Permissions-Policy)
├── public/               # sw.js, offline.html, brand/, __qa/ (QA harness)
├── scripts/              # copy-monaco.cjs, test-http.cjs
├── src/
│   ├── app/
│   │   ├── (public)/     # home, help, privacy, terms, welcome
│   │   ├── api/           # analyze, github-import, github/[action], preview/*
│   │   ├── manifest.ts    # PWA manifest
│   │   └── studio/        # page.tsx -> Workbench.tsx
│   ├── components/        # MiniIDE, panels, GitHub components, ApiRequestTester...
│   └── lib/               # analyzer + all logic modules (see table above)
├── tests/                # 14 node --test files
└── PATCH_*.md, SECURITY_LEGAL_AUDIT.md, RUNTIME_PLAN.md  # internal notes (public repo)
```

---

## 3. Findings A–J

### A. Architecture

Covered in section 2. Additional observations:

| Finding | Evidence | Severity | Confidence |
|---|---|---|---|
| Internal patch/design notes (`PATCH_INSIGHTS_AND_FIRST_RUN.md`, `PATCH_LIVE_HEALTH_SCORE.md`, `PATCH_PREVIEW_API_FIXES.md`, `PATCH_STUDIO_TOUR.md`, `PR_DESCRIPTION.md`, `RUNTIME_PLAN.md`) are committed to a public repo; two of them describe real, **unfixed** bugs | Root directory listing | Medium | Verified |
| `public/__qa/` QA harness served publicly; flagged previously by `SECURITY_LEGAL_AUDIT.md` item 15 | Root + `public/` listing; prior audit | Medium | Verified |
| The prior audit (`SECURITY_LEGAL_AUDIT.md`, commit `6dafa49`) independently confirmed: no secrets in git history, `.env` gitignored, no client-side secret references | `SECURITY_LEGAL_AUDIT.md` | — | Verified |

### B. Scanner (highest priority)

**How files are selected.** There is no file discovery in the scanner itself — files arrive from the UI/import paths. `analyzeProject(files, disabled)` filters to entries with string `path`/`content`, **drops** files over 400,000 chars, and caps at **120 files** (`MAX_FILES`, `MAX_CHARS` in `src/lib/analyzer.ts`). The server route `/api/analyze` (`src/app/api/analyze/route.ts`) enforces the same caps plus a 2,000,000-char total (HTTP 413).

**Exact language filter (the core issue).** `src/lib/analyzer.ts`:

- `EXT` map (in `inferLanguage()`): **exactly** `js, mjs, cjs, ts, jsx, tsx, py, html, htm, css, json`.
- Everything else → `"other"`.
- Rule language sets: `JS = [javascript, typescript, jsx, tsx]`, `PY = [python]`, HTML/CSS rules, JSON rules, and `ANY = [..., 'other']` for `GEN001` only.

**What happens to unsupported files: neither skipped, warned, nor crashed — silently under-scanned (Verified).** In `analyze()`, each rule is skipped when `!rule.languages.includes(language)`. For language `"other"`, only `GEN001` (TODO/FIXME/HACK) can match. The file is still counted in `scannedFiles`, and `skippedFiles` only counts files dropped for size/count — **not** language non-coverage. So a `.php` file containing SQL-injection-style string concatenation is counted as "scanned", gets zero security rules, and nothing tells the user.

**Does the UI show which files were not covered?** Partially, in one place: `IntelligencePanel.tsx` shows `processedFiles / importedFiles`, `targetedFiles`, `genericOnlyFiles`, `withoutActiveRules`, `skippedDuringAnalysis`, and `targetedPercent`. However:
- `activeCoverage()` in `intelligence.ts` classifies files by *rule applicability*, so an imported `.php` file counts as `withoutActiveRules` — visible in the "Intelligence" panel only, not in Project Health or the Explorer.
- `Project Health` (`Workbench.tsx`) shows the raw `analyzer` score and `scoreLabel()` (`>=85 Healthy`, `>=65 Needs attention`, `>=40 At risk`, else `High exposure`) with **no coverage context**.
- The Explorer (`MiniIDE.tsx`) shows no per-file "not analyzed" indicator.

**Proof that an unsupported project can read "Healthy":** take 20 PHP files. `inferLanguage('x.php')` → `'other'`. In `analyze()`, JS001–JS016, PY001–PY008, HTML001–002, CSS001, CFG001–002 all skip (`languages` excludes `'other'`). Only `GEN001` runs. With no TODO markers → 0 findings → `score = max(0, round(100 - 0)) = 100`, `risk = 'Low'` (no medium/critical), `scoreLabel(100) = "Healthy"`. **Verified by code path; no test covers this case** (`tests/engine.test.cjs` only tests supported languages).

**Mitigation that exists:** `buildIntelligenceV2` sets `canScore = hasScanned && hasActiveChecks && targetedFiles > 0`; with zero targeted files the Intelligence score is `null` ("Not scored") and status is `"partial"`. So the Intelligence panel is honest; the Health panel is not.

**Parsing method.** Pure per-line regex. `analyze()` splits content into lines and applies each rule's regex per line; a 3000-finding global cap; `replacement` suggestions are string splices. No AST, no tokenizer, no tree-sitter, no comment stripping.

**Adding languages — the honest assessment:**

- **TypeScript / TSX / JSX: mostly there already.** `ts/tsx/jsx` map to their languages and get JS001–JS012/JS015/JS016; JS013 (`: any`) and JS014 (`@ts-ignore`) are TS/TSX-specific. Remaining gap: regex scanning inside JSX/TSX can false-positive/negative (e.g., `JS015` loose-equality matches `==` in strings/comments). **Effort S** (add comment/string stripping preprocessing + tests).
- **Python: rules exist** (PY001–PY008). Same regex caveats. **Effort S** to harden.
- **PHP, Java, Go, C/C++/C#, Ruby, SQL, SCSS:** **no rewrite needed.** The engine is a rule table keyed by language name — adding a language = add `EXT` entries + `create(...)` rules. **Effort S–M per language** for a basic high-signal rule set (eval/exec family, command execution, hardcoded secrets, SQL string concatenation, deserialization).
- **Tree-sitter (WASM), honestly:** grammar WASM is roughly ~0.5–2 MB per language plus the core; parsing 120 files / 2 MB in-browser takes seconds and will jank the main thread unless moved to a Web Worker. Critically, the current rules are regexes keyed per *line* — an AST switch means **rewriting `analyze()` entirely** (rules, `Finding` semantics, `intelligence.ts` dedup keyed on file/line/ruleId, and `changeSimulation.ts` line-evidence matching all assume line-level regex hits). **Effort L.** A cheaper path exists: keep regex, add per-language rule sets + a comment-stripping preprocessor + a per-file "not covered" badge. Reserve tree-sitter for a later, worker-based engine if regexes prove insufficient (e.g., for real taint tracking).

| Finding | Evidence | Severity | Confidence |
|---|---|---|---|
| Unsupported languages silently under-scanned; "Healthy" reachable with zero applicable rules | `src/lib/analyzer.ts` (`EXT`, `analyze()`, `analyzeProject()`); `Workbench.tsx` `scoreLabel()` | **Critical** | Verified |
| `skippedFiles` does not mean "unanalyzed languages" | `analyzeProject()`: `skippedFiles = files.length - valid.length` | High | Verified |
| Server `/api/analyze` caps 120 files / 400 KB / 2 M chars | `src/app/api/analyze/route.ts` | Low (informational) | Verified |

### C. Feature-by-feature reality check

**Code Editor** (Monaco, in `MiniIDE.tsx`)
1. Edits loaded files in Monaco with 25 mapped language modes (`ideCore.ts` `LANGUAGES`), tabs, save-to-folder/export/backup, keyboard shortcut handling (`KeyboardEvent` imports in `MiniIDE.tsx`).
2. User sees a full IDE; underneath, editing is real, but the workspace is capped at **120 files / 400 KB per file / 2 M chars total** (`validateWorkspace`), Monaco assets live in gitignored `public/monaco` populated at build time, and the health score shows "Not scanned" until a manual Analyze (`PATCH_LIVE_HEALTH_SCORE.md`).
3. **Real** logic.
4. Inputs: workspace files. Missing/unsupported: unknown extensions open as plaintext (safe); over-cap workspaces are rejected with explicit errors.

**Project Explorer** (`MiniIDE.tsx` side views: `files`, `search`, `languages`, `insights`, `changes`)
1. Flat paths folded into a folder tree (`FolderNode`), file search, language totals (`languageTotals()`), image viewer, delete via trash handler.
2. Real tree; no rename, no move; binary images (5 types) kept separate from text.
3. **Real**.
4. Depends on the loaded workspace; empty workspace shows the starter project/empty state.

**Project Scanner**
1. Client-side `analyzeProject()` over loaded files on demand ("Analyze"); a server route `/api/analyze` also exists with identical caps.
2. User sees findings, score, risk; underneath it is 30 regex rules over ~10 languages — see B for the coverage gap.
3. **Real but limited** (regex heuristics; no AST; no test execution — UI says so).
4. Inputs: loaded files + disabled-rule list. Unsupported languages produce no findings without any warning.

**Security Center** (Workbench section `security`)
1. Lists findings by severity with jump-to-source links, category/severity metadata, SARIF + Markdown report export (`reportMarkdown`, `sarifReport` in `Workbench.tsx`).
2. Same 31-rule catalog as everything else; disabling rules in the "Rulebook" section removes them from all panels.
3. **Real** (heuristic).
4. Depends on scanner coverage — for unsupported languages it will show "clean" regardless of content.

**Project Health** (Workbench section `health`)
1. Score 0–100 from `100 - (critical×22 + high×12 + medium×4 + low×1.5)`, risk label, history snapshots (`Snapshot` type) recorded on scans.
2. Thresholds `85/65/40` are arbitrary constants, not benchmarked against anything; the score ignores language coverage (see B).
3. **Real but misleading for unsupported languages.**
4. Missing baseline/unsupported languages silently produce optimistic numbers.

**Release Gate** (Workbench section `release` + `GitHubReleaseGate.tsx` + `/api/github/release-gate`)
- *In simple terms:* after FORGEX creates a PR for you, the Release Gate answers "what does GitHub say about **that PR right now**?" It lists CI check runs, commit statuses, approvals and change requests from the GitHub API, and shows a verdict: `blocked / in-progress / not-verified / checks-passing / merged / closed`.
- *Scores/decisions:* there is no FORGEX-computed score; the gate reports evidence. `checks-passing` is explicitly labeled **"Reported checks passing — not a merge approval"**. Head-commit mismatch (`sameHeadCommit` from `prReview.ts`) downgrades to "Not verified". Truncated/unavailable GitHub data is surfaced, not hidden. Thresholds (any failed check ⇒ `blocked`) are sensible and conservative.
3. **Real** evidence aggregation — but only works for a PR that exists; it cannot merge anything.
4. Inputs: repo full name, PR number, expected head SHA; GitHub API errors show as error text with a Refresh button.

**Baseline** — three distinct things share this name (all verified):
1. `sourceBaseline` / `baselineFiles`: a **local comparison snapshot** you capture via "Capture local snapshot" (`SourceControlPanel.tsx` → `onCaptureBaseline`, with a confirmation dialog). It clears local change markers; `compareWorkspace()` diffs current files against it.
2. `githubBaselineFiles`: the snapshot of files **as imported from the GitHub commit**; `GitHubPublish` computes the publishable diff against it and requires explicit per-file approval for *new* files.
3. `baselineFiles` persisted in the IndexedDB draft (`workspaceDraft.ts`).
- *In simple terms:* a baseline is "a saved copy of your files at a moment in time". Local Changes = current files vs the local snapshot. Publishing = current files vs the GitHub-import snapshot. The UI honestly states "Snapshot ≠ Save ≠ Git commit".
3. **Real**. Capture is manual; nothing is auto-synced.
4. Missing baseline: Local Changes panel compares against an empty snapshot (everything looks "added"); publish is blocked for partial imports (`identity.partial`).

**Preview** (`buildPreview` in `ideCore.ts`, sandboxed iframe)
1. Assembles an `srcDoc` preview with CSP allow-list (`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `fonts.googleapis.com`/`gstatic` — per `PATCH_PREVIEW_API_FIXES.md`), instrumented console/network capture, images inlined as data URLs.
2. User sees a browser preview; underneath only **static HTML/CSS/JS runs**. Node, API routes, `.env`, and build steps cannot run — an explanatory message is shown for `/api/...` calls (`PREVIEW_LIMITS_MESSAGE` in `MiniIDE.tsx`).
3. **Real** (with documented, unapplied defects: fontshare CSP block and XHR/axios proxy fallback missing — see D).
4. Inputs: workspace files + assets. Unsupported: SVGs are conservatively sanitized (`svgPreviewUrl` blocks scripts/entities/external refs) or opened as text.

**API Tester** (`ApiRequestTester.tsx`)
1. In-app HTTP client: **GET/POST only**, JSON headers (max 16), direct browser fetch with automatic server-proxy retry for CORS-blocked targets, 120 KB response cap, timing, "via proxy" indicator.
2. Real requests; the proxy (`/api/preview/proxy`) is SSRF-hardened (https-only, private-IP blocked, redirect revalidated, 120 req/min/IP) and forwards only `content-type/accept/authorization` family headers from the tester.
3. **Real**. PUT/PATCH/DELETE exist in the proxy but are not exposed in the tester UI.
4. Offline: explicit "You are offline" error; same-origin relative URLs hit the FORGEX origin directly.

**GitHub Integration** (`GitHubConnect`, `GitHubPublish`, `GitHubPRStatus`, `GitHubReleaseGate`, `/api/github/[action]`)
1. OAuth with PKCE (state + S256 challenge), token stored only in an AES-256-GCM-encrypted httpOnly cookie; repository list from installations; import; publish creates branch `forgex/<hmac-sha256-of-identity+title>` and a PR via `createOrReusePullRequest` (idempotent, recovery-safe); max 20 changed files per PR; new files require explicit checkbox approval; partial imports block publishing; PR status + release gate tracking.
2. User sees "Connect GitHub → import → edit → Review & Create PR"; underneath FORGEX never pushes to the default branch and never merges — all writes are a new branch + PR, with duplicated-response recovery logic (`githubPublishRetry.ts`).
3. **Real** and unusually defensive (SHA verification of every ref/commit, conflict errors instead of silent retries).
4. Missing config (`GitHub unavailable` button state), expired session (401 messages), rate limits (403/429 messages) all handled with clear text.

**Project Import** — see F for details. Methods: multi-file picker, Open Folder (File System Access API), GitHub URL, paste-from-clipboard (`forgex.paste-from-clipboard` command in `MiniIDE.tsx`), starter project, workspace backup JSON. **No zip import.**

### D. Code editor "Partially working" — likely causes

| # | Candidate cause | Evidence | Confidence |
|---|---|---|---|
| 1 | Health score shows "Not scanned" on first load — the analyzer works but appears dead until the user presses Analyze | `PATCH_LIVE_HEALTH_SCORE.md` documents root cause (`healthScore={result?.score ?? null}` with `result` null until manual scan) and an exact unapplied fix | Likely (high) |
| 2 | Preview styles silently fail for projects using Fontshare: CSP `style-src` allow-list lacks `api.fontshare.com` | `PATCH_PREVIEW_API_FIXES.md` Patch A (unapplied) | Likely |
| 3 | XHR/axios projects: direct call fails (sandboxed `Origin: null`), XHR wrapper only warns, response never displays while Network tab shows 200 | `PATCH_PREVIEW_API_FIXES.md` Patch B (unapplied) | Likely |
| 4 | Monaco assets missing if the copy step didn't run: `public/monaco/` is gitignored and populated by `scripts/copy-monaco.cjs` at `postinstall`/`prebuild`; a broken install → editor never loads | `.gitignore` (`public/monaco/`), `package.json` scripts, `scripts/copy-monaco.cjs` | Likely |
| 5 | Large real projects cannot fully load: 120-file / 400 KB / 2 M char caps (IndexedDB draft also validated with the same caps) — users with bigger repos see partial workspaces | `ideCore.ts` `validateWorkspace`, `analyzer.ts` caps, `/api/analyze` 413 | Verified (caps) / Likely (as cause of the report) |
| 6 | Mobile: dedicated `MobileView` type and `responsive-polish.css` exist; touch-UX quality | `MiniIDE.tsx` types, `src/app/responsive-polish.css` | Unverified (needs device testing) |
| 7 | Save/sync: "Save folder" is manual, fingerprint-checked, and reports partial failures (`FolderWriteError`); no background sync — may read as "save doesn't work" if the user expects sync | `src/lib/folderWrites.ts`, help page wording | Likely |
| 8 | Silent catch blocks: many errors resolve to `null`/no-op (e.g., `ServiceWorkerRegistration` ignores failures, `previewAssets` resolves `null`, `readDraft` rejections) — graceful, but failures can be invisible | listed files | Verified (pattern) |
| 9 | Keyboard shortcuts: handlers exist (Ctrl+S save path in `MiniIDE.tsx`); conflicts with OS/browser shortcuts | `MiniIDE.tsx` imports/handlers | Unverified |

### E. Honesty of claims

| Claim | Where | Verdict | Evidence |
|---|---|---|---|
| "Understand your code" | Homepage hero | **Partially delivered** | 30 regex rules over js/ts/jsx/tsx/py/html/css/json only; other languages get TODO-marker scanning only |
| "Predict the impact" | Homepage hero | **Partially delivered** | `dependencyImpact.ts`/`impact.ts` are regex import graphs; notes say "Static references only… runtime behavior … not verified"; Change Intelligence compares two local snapshots |
| "Ship with confidence" | Homepage hero | **Partially delivered** | Release Gate reports GitHub evidence but explicitly "not a merge approval"; FORGEX never merges |
| "Integrated Code Editor" | Homepage features | **Delivered** | Monaco, 25 language modes, tabs, folder save, backups |
| "Code Intelligence" | Homepage features | **Partially delivered** | Real advisory findings; language coverage gap (section B) |
| "Dependency Impact" | Homepage features | **Partially delivered** | JS/TS imports + CSS/HTML references; no Python/PHP/etc. import semantics (notes admit this) |
| "Web Preview & Diagnostics" | Homepage features | **Partially delivered** | Static HTML/CSS/JS only; console/network capture real; documented CSP/XHR defects unapplied |
| "GitHub Workflow" | Homepage features | **Delivered** | OAuth, import, defensive PR creation, PR status, release gate |
| "Flexible Project Import" | Homepage features | **Partially delivered** | files/folder/GitHub/paste/backup — but **no zip** import anywhere (no zip dependency in `package.json`, no zip code found) |
| Offline claim ("home, Help, Studio open offline; GitHub/AI need internet") | Help page | **Delivered** | `public/sw.js` precaches `/`, `/help`, `/studio`, `/offline.html`; `manifest.ts` present |
| "AI and weather connections … only when enabled" | Help page | **Delivered (accurate wording)** | `/api/preview/{ai,gateway,health}` return 404 outside development |

**Overall:** the marketing copy is unusually restrained — the UI repeatedly says heuristic / advisory / not a certification. The main honesty gap is **language coverage** (a PHP project reading "Healthy"), not overclaiming of what does run.

### F. Project import

| Method | How | Caps / filters | Failure behavior |
|---|---|---|---|
| GitHub URL (public, no login; private needs connection) | `githubImport.ts` via `/api/github-import` or authenticated `/api/github/[action]` | `GITHUB_TEXT_PATH` text extensions incl. `ts,tsx,py,php,go,rs,java,c,h,cpp,hpp,cs,sql,sh,md,txt,svg,yml,yaml,xml,scss`; `IGNORE` blocks `node_modules/.git/.next/dist/build/coverage/vendor`, lockfiles, `.min.*`, `.snap`; any path segment starting `.env` excluded; **60 files**, 125 KB/file, 2 M chars; images ≤32, ≤1.5 MB each, ≤8 MB total; 4 MB response; 40 s deadline | Explicit errors per GitHub status; `partial: true` + `skipped` count when limits hit |
| Open Folder | File System Access API (browser) | `validateWorkspace`: 1–120 files, 400 KB/file, 2 M chars | Explicit error messages |
| File picker (multi-file) | browser input | same `validateWorkspace` | explicit errors |
| Paste from clipboard | `forgex.paste-from-clipboard` command (`MiniIDE.tsx`) | creates a new file | — |
| Starter project | `starterProject()` in `ideCore.ts` | 3 files | — |
| Backup JSON | `workspaceBackup.ts` | 18 MB cap; strict `verifyDraft` validation | explicit errors |

- **Zip import: NOT supported** (Verified — no zip library in `package.json`, no zip-handling code found).
- **node_modules:** excluded on the GitHub import path only; folder/file import relies on user selection (whether MiniIDE additionally filters such dirs on folder import: **Unverified** — needs MiniIDE line-level check).
- **Binaries:** only 5 image types accepted, with magic-byte signature validation (`previewAssets.ts`).
- **Huge repos:** hard caps with clear messages and a `partial` flag; the budget behavior is test-covered (`tests/workspaceAssets.test.cjs`).

### G. Offline / PWA readiness

- **Manifest:** `src/app/manifest.ts` (standalone, 192/512 + maskable icons) → installable. **Verified.**
- **Service worker:** `public/sw.js` — precaches `/`, `/help`, `/studio`, `/offline.html` + Monaco loader trio; network-first for navigations with cache fallback; cache-first for static assets; skips `/api/*`, non-GET, cross-origin, RSC requests; registered **production-only** (`ServiceWorkerRegistration.tsx`). `OfflineBanner` + `connectivity.ts` (2-failure threshold) drive offline UI.
- **Works offline:** shell pages, editor, local files, client-side analysis, local diffs, backups.
- **Cannot work offline:** GitHub import/publish/release-gate, AI/weather (dev-only anyway), external API calls (proxy needs the server), previews that load CDN scripts.
- **Gaps:** only pages actually visited get cached beyond the precache set; no HSTS/global CSP (see H).

### H. Security and data handling

| Area | Finding | Evidence | Severity | Confidence |
|---|---|---|---|---|
| GitHub tokens | Server-side only; AES-256-GCM httpOnly cookie; key must decode to exactly 32 bytes; PKCE + state | `/api/github/[action]/route.ts` (`cryptoKey`, `encrypt`, `decrypt`, `connect`) | — (good) | Verified |
| Token exposure on import | Only `api.github.com` receives credentials; import results verified not to contain the token (test asserts) | `githubImport.ts`; `tests/workspaceAssets.test.cjs` | — (good) | Verified |
| Gemini key | Server env only, dev-only route, 5 s cooldown | `/api/preview/ai/route.ts` | — (good) | Verified |
| Supabase | **None** — no Supabase code, keys, or policies anywhere | full file reads + `.env.example` | — | Verified |
| Secrets committed | None found; `.env*` gitignored; prior audit verified git history clean | `.env.example`, `.gitignore`, `SECURITY_LEGAL_AUDIT.md` | — | Verified |
| XSS from user content | Preview = sandboxed iframe `srcDoc` with CSP; `svgPreviewUrl` blocks scripts/entities/external refs; images are data URLs with signature checks; analyzer flags `innerHTML`/`dangerouslySetInnerHTML` in user code (JS003/JS004) | `ideCore.ts`, `previewAssets.ts`, `analyzer.ts` | — (good) | Verified |
| App-side `dangerouslySetInnerHTML` | One use: `JSON.stringify(jsonLd)` on the homepage — safe | `src/app/(public)/page.tsx` | Low | Verified |
| Rate limiting | Missing on `/api/analyze` and `/api/github/*`; only the proxy (120/min/IP) and the AI cooldown exist | prior audit item 8 (still matches code read) | **High** | Verified |
| Security headers | No CSP / HSTS globally; `next.config.ts` sets only nosniff, referrer, X-Frame-Options, Permissions-Policy | `next.config.ts` | High | Verified |
| Dependencies | Prior audit: 8 vulns (1 critical via `minimatch`/`@vscode/vsce`; `next` via `postcss`; `dompurify` via monaco); also outdated majors. Re-run `npm audit` to confirm the current state | `SECURITY_LEGAL_AUDIT.md` item 13/19; `package.json` (`dompurify` override 3.4.17 present) | Medium | Verified (prior) / Unverified (current) |
| Proxy SSRF | Solid: https-only, private IPv4/IPv6 blocked, credentials-in-URL rejected, origin-null enforcement, redirect revalidation, size/time caps | `/api/preview/proxy/route.ts` | — (good) | Verified |
| QA/internal artifacts public | `public/__qa/`, root `PATCH_*.md` docs | directory listings | Medium | Verified |

### I. VS Code extension (limited scope, as instructed)

- **The studio does not import or build against the extension.** No file under `src/` references `extension/`. **Verified.**
- **The extension imports the studio's scanner:** `extension/src/extension.ts` — `import { analyze, inferLanguage, type Finding } from "../../src/lib/analyzer";` — and `extension/tsconfig.json` includes `"../src/lib/analyzer.ts"`. **Verified.**
- **What breaks if `extension/` is deleted:** nothing in the web studio. The extension build is gone (intended), but `package.json` keeps two now-unused devDependencies (`@types/vscode`, `@vscode/vsce`). **Removing the folder is safe for the studio if the devDeps and any extension build references are removed in the same change.** Extension quality was not evaluated, per instructions.

### J. Quality signals

| Signal | Evidence | Severity | Confidence |
|---|---|---|---|
| Tests exist and are meaningful: 14 `node --test` files covering the rule engine, intelligence, LCS diff, publish retry, GitHub import budget, preview limits, connectivity, middleware, routes | `tests/` listing; `tests/engine.test.cjs`, `tests/workspaceAssets.test.cjs` | — (positive) | Verified |
| No CI workflow found in the repo listing (no `.github/` dir at root) — are the tests actually run anywhere? | root listing | Medium | Unverified (GitHub Actions may exist outside listing) |
| **Two overlapping import-graph implementations**: `impact.ts` (JS/TS, `@/` alias support, used by ImpactPanel/ChangeSimulation) and `dependencyImpact.ts` (adds CSS/HTML refs, baseline+current edges, used by ChangeIntelligencePanel) | both files | Medium | Verified |
| **Three inconsistent severity-weight tables**: `analyzer.ts` 22/12/4/1.5 (linear penalty); `intelligence.ts` SEVERITY_WEIGHT 18/9/3/1 with a different, density-based formula; `changeSimulation.ts` rawPenalty 22/12/4/1.5 — Health and Intelligence panels can disagree for the same findings | the three files | Medium | Verified |
| Dead code: unused rail index codes `"01".."06"` in the Workbench menu tuples (documented) | `PATCH_LIVE_HEALTH_SCORE.md` §2 | Low | Likely |
| Monolithic components: `MiniIDE.tsx` ~146 KB, `Workbench.tsx` ~83 KB — high review/merge burden (the patch notes themselves cite file size as the reason fixes were "documented, not applied") | file sizes; `PATCH_LIVE_HEALTH_SCORE.md` preamble | Medium | Verified |
| LCS diff allocates `(n+1)×(m+1)` `Uint32Array` with a 500,000-cell cap; above it the diff degrades to "File changed; exact line diff exceeds preview limit" | `sourceControl.ts` (`MAX_CELLS`, `compareLines`) | Low (handled, but slow near the cap) | Verified |
| `@monaco-editor/react` pinned to a release candidate (`^4.8.0-rc.3`) in production dependencies | `package.json` | Medium | Verified |
| Monaco copied into `public/` adds several MB of static assets; offline precache only grabs the loader trio | `copy-monaco.cjs`, `sw.js` | Low | Verified |
| Accessibility: `aria-label`/`role` used broadly (IntelligencePanel, ApiRequestTester, SourceControlPanel, GitHubConnect, dialogs with `<dialog>`); no formal contrast/keyboard audit (prior audit item) | component reads; `SECURITY_LEGAL_AUDIT.md` | Medium | Verified (labels) / Unverified (audit) |
| Mobile: dedicated mobile view switching and responsive CSS exist; not audited end-to-end on devices | `MiniIDE.tsx` MobileView, `responsive-polish.css` | Unverified | Unverified |
| Prior audit also flagged outdated majors (`next`, `lucide-react`, `typescript`, `@types/*`) — re-verify | `SECURITY_LEGAL_AUDIT.md` item 13 | Low | Unverified (current) |

---

## 4. Feature truth table

| Feature | Claimed | Actual | Real / Partial / Fake |
|---|---|---|---|
| Code Editor | Browser IDE with syntax highlighting & navigation | Monaco editor, 25 language modes, tabs, save/export; 120-file workspace cap; health score inert until manual scan | **Real** |
| Project Explorer | File tree & navigation | Real tree, search, language totals, image viewer; no rename/move | **Real** |
| Project Scanner | Analyze code for risks | 30 regex rules; only ~10 languages meaningfully covered; unsupported files silently produce no findings | **Partial** |
| Security Center | Risk review | Same rule set, severity views, SARIF/MD export; honest "heuristic" labeling | **Real (limited by B)** |
| Project Health | Health score & history | Real score + snapshots, but can read "Healthy" for un-analyzable projects; arbitrary thresholds | **Partial** |
| Release Gate | Release readiness evidence | Real GitHub checks/statuses/approvals for an existing PR; explicitly not a merge approval | **Real** |
| Baseline | (unnamed feature) "Capture local snapshot" | Real local snapshot + GitHub import snapshot; drives Local Changes and publish diffs | **Real** |
| Preview | Web preview & diagnostics | Static HTML/CSS/JS in a sandboxed iframe with console/network capture; no server code; 2 documented unapplied defects | **Partial** |
| API Tester | HTTP client | Real GET/POST tester with proxy fallback; no PUT/PATCH/DELETE in UI | **Real (limited)** |
| GitHub Integration | Connect, import, review, PR | Real OAuth/import/publish/PR-status/release-gate; never merges; defensive recovery logic | **Real** |
| Project Import | Files, folders, GitHub | All exist; **no zip import**; hard caps with clear errors and partial flags | **Partial** |
| PWA / Offline | Installable, offline editing | Real manifest + service worker + offline banner; GitHub/AI need network | **Real (partial)** |
| VS Code extension | (not claimed on homepage) | Ships in repo, shares the analyzer; independent of the web studio | **Real (separate artifact)** |

---

## 5. Language support analysis

Current matrix (Verified):

| Language | Editor (Monaco mode) | GitHub import | Scanner rules | Effort to fully support |
|---|---|---|---|---|
| JavaScript / JSX | Yes | Yes | 16 rules (JS001–JS016) | Delivered (harden regexes: **S**) |
| TypeScript / TSX | Yes | Yes | JS rules + JS013/JS014 (TS-specific) | Mostly done (**S**: comment-stripping, JSX false-positive tests) |
| Python | Yes | Yes | 8 rules (PY001–PY008) | Mostly done (**S**: more rules + preprocessing) |
| HTML / CSS | Yes | Yes | HTML001–002, CSS001 (+CFG rules for JSON) | Delivered |
| SCSS | Yes | Yes | **None** (inferLanguage → 'other') | **S** (add EXT entry + a few rules) |
| PHP | Yes | Yes | **None** | **S** (EXT + eval/exec/shell_exec/SQL-concat/secret rules) |
| Java | Yes | Yes | **None** | **S–M** (Runtime.exec, deserialization, secrets) |
| Go | Yes | Yes | **None** | **S–M** |
| C / C++ / C# | Yes | Yes | **None** | **M** each |
| Ruby | Editor only | **No** (not in GITHUB_TEXT_PATH) | **None** | **M** |
| SQL / Shell / YAML / XML / MD / TXT | Yes (or text) | Yes (SQL/sh/yml/xml/md/txt) | **None** | **M** (SQL injection patterns valuable) |

**Recommended order:** 1) TypeScript/JSX hardening (S) — already closest to done. 2) Python hardening (S). 3) SCSS + PHP (S) — highest user-visible impact, zero architectural change. 4) Java, Go (S–M). 5) SQL (M, high security value). 6) C/C++/C#/Ruby (M each). 7) A per-file "not covered by any rule" badge in the Explorer + Health coverage gate (**S, single highest-value fix**).

**Tree-sitter (WASM) verdict:** ~0.5–2 MB per grammar + core; seconds-scale parse for a 120-file/2 MB workspace; must move to a Web Worker to avoid main-thread jank; adopting it means rewriting `analyze()` and adapting `intelligence.ts`/`changeSimulation.ts` (both assume line-based regex findings). **Effort L.** The regex engine's rule-table design means new languages need no rewrite — take the cheap path first and evaluate tree-sitter later, worker-based, for the top 3 languages only.

---

## 6. Proposed work plan (PROPOSAL ONLY — nothing below has been implemented)

| # | Item | Value | Effort | Risk |
|---|---|---|---|---|
| 1 | Coverage honesty: show "no rules applied for this language" per file in Explorer; block the "Healthy" label / add a warning banner when targeted coverage is 0% of imported files | Closes the Critical false-safety finding | **S** | Low — pure UI over data already computed by `buildIntelligenceV2` |
| 2 | Apply the two already-written patches: live health score (`PATCH_LIVE_HEALTH_SCORE.md`) and XHR-proxy-fallback + fontshare CSP (`PATCH_PREVIEW_API_FIXES.md`); then run typecheck, `node --test tests/*.test.cjs`, build | Fixes the most likely "partially working" causes | **S** | Low — patch notes include acceptance checks |
| 3 | Add SCSS + PHP (+ Java) rule sets via the existing rule table | Directly answers "can we support more languages without rewriting" — yes | **S–M** | Medium: regex rules need false-positive testing; add engine tests per language |
| 4 | Consolidate the three severity-weight tables into one shared constant | Stops Health vs Intelligence vs Simulation disagreeing | **S** | Low — mechanical, but user-visible numbers change |
| 5 | Rate limiting on `/api/analyze` and `/api/github/*`; add CSP + HSTS headers | Closes the top items of the prior security audit | **M** | Medium — CSP must permit the same-origin preview iframe and Monaco |
| 6 | Zip import (e.g., fflate) reusing `validateWorkspace` caps | Matches the "Flexible Project Import" claim | **M** | Medium — path-traversal checks via `safeIdePath` already exist; cap zip size and entry count |
| 7 | Remove `extension/` + `@types/vscode`/`@vscode/vsce` devDeps together (after owner confirms extension deprecation) | Owner's stated desire; safe for the studio | **S** | Low — verify nothing else references the extension |
| 8 | Split `MiniIDE.tsx` (146 KB) / `Workbench.tsx` (83 KB) into feature modules (Strangler-Fig: extract panels first) | Maintainability; the repo's own docs cite file size as the reason fixes went unapplied | **M–L** | Medium — behavior-preserving refactor; require characterization tests first |
| 9 | Move internal docs (`PATCH_*.md`, `PR_DESCRIPTION.md`, `RUNTIME_PLAN.md`, `public/__qa`) out of the public repo | Hygiene | **S** | Low |
| 10 | Tree-sitter WASM prototype (worker-based, top 3 languages) A/B-tested against the regex engine | Only if regexes prove insufficient | **L** | High — engine semantics change; keep regex engine behind a flag |

---

## 7. Open questions for the owner

1. Should Project Health refuse to display "Healthy" when zero scanner rules applied to any imported file (e.g., PHP-only projects)?
2. Do you want zip import? If yes, what total-size and file-count caps?
3. Confirm the VS Code extension should be removed now — removal is safe for the web studio, but its shared `analyzer.ts` import must be dropped together with the two devDeps (`@types/vscode`, `@vscode/vsce`).
4. May the internal docs (`PATCH_*.md`, `PR_DESCRIPTION.md`, `RUNTIME_PLAN.md`, `public/__qa/`) be removed from the public repo?
5. Is `@monaco-editor/react` `4.8.0-rc.3` (a release candidate) intentional? A stable pin is recommended.
6. Should Intelligence V2's coverage-aware score replace the linear Health score as the single user-facing number?
7. What is the production plan for the AI/weather/gateway routes? `RUNTIME_PLAN.md` lists the requirements; none are provisioned — keep them dev-only for now?
8. Should folder/file import filter `node_modules`/`.git` like the GitHub import does (MiniIDE's folder-pick filter is Unverified)?
9. Is any CI running the 14 test files? No workflow was found in the repo listing.
10. Are the Health thresholds (85/65/40) benchmarked against anything, or should they be derived from the Intelligence formula instead?
11. Priority: **more languages** vs **deeper analysis of existing languages**? (The architecture allows both; language breadth is cheaper.)
12. Would opt-in, anonymous language-coverage telemetry be acceptable, to learn which imported languages users actually have?

---

*End of report. Read-only audit — no code was changed. The only file created is this report, on branch `audit/forgex-audit-report` (created from main @ `52261c1`). Nothing has been merged or committed to `main`.*
