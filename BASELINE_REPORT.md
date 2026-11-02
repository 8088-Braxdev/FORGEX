# FORGEX baseline — 2026-11-01

## Source and scope

- Upstream: `8088-Braxdev/FORGEX`, private, default branch `main`.
- Upstream commit: `e60a72d274c23d2f56e110c91a246dc31157c221`.
- All 66 source files were retrieved through the authenticated GitHub connection and their Git blob hashes verified byte for byte. No `AGENTS.md` was present in that tree.
- Local snapshot commit `ba42f3d` is an independently created snapshot, not an upstream Git commit. Work branch: `work/forgex-product-completion`.
- No production changes, remote repository writes or provider-quota requests were performed during this baseline.

## Commands and results before edits

| Check | Result | Evidence |
| --- | --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS | 157 packages installed; exit 0. |
| `npm run typecheck` | PASS | No diagnostics; shell continued to tests. |
| `node --test tests/*.test.cjs` | PASS | 23 tests, 23 passed, 0 failed; includes 30-rule engine suite. |
| `npm run build` | PASS with warnings | Next.js 15.5.28, exit 0. Three autoprefixer warnings: mini-ide.css align-items:start, style.css align-items:start/end. |
| Tracked secret paths | PASS for listed current tree | No .env/PEM/credential path present. .gitignore excludes .env, .env.*, .vercel and generated outputs. |
| Literal source secret-pattern scan | PASS for narrow scan | No GitHub token, Google API key or private-key-header pattern matched current src. Full history and all possible credential formats were not audited. |

## Observed live UI before edits

URL: https://forgex-gamma.vercel.app/ . Browser viewport width: 1363 px. The live deployment SHA could not be independently read; these observations are not claimed as deployment-to-commit provenance.

- FAIL: base URL enters IDE directly; welcome is at /welcome.
- PASS: /welcome, /privacy and /terms render their distinct page titles.
- FAIL: welcome CTA targets /, which is currently the workbench.
- FAIL: WhatsApp and email support links are absent in inspected public navigation/footer.
- FAIL: publisher text in inspected footers has no company link.
- FAIL: Privacy and Terms show missing-contact placeholders.
- FAIL: welcome DOM lacks canonical, Open Graph and Twitter metadata.
- FAIL: workspace displays repeated local engine/version labels.
- Source finding: GitHubConnect.tsx is rendered inside SourceControlPanel, but is absent from the primary workspace header. The repository picker reports that GitHub must be connected.
- NOT TESTED: mobile widths, actual OAuth login/profile, PWA install, imported API response, binary persistence, linked-folder conflicts and PR publishing.

## Runtime blockers found in source

AI, gateway and health Preview routes are development-only. MiniIDE also blocks AI/health outside development. This protects public deployments but means configured production keys do not enable these capabilities. Do not remove these guards without an approved production policy, durable quotas and authentication.

## Environment names read from source (no values)

GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_COOKIE_KEY, FORGEX_APP_ORIGIN, GEMINI_API_KEY, NODE_ENV and the old optional NEXT_PUBLIC_FORGEX_SUPPORT_EMAIL. Vercel environment presence and values were not retrieved. No production OAuth or billable Gemini call was made.

## Concurrent upstream update on 2026-11-02

Before delivery, main advanced six commits to `e8417426ffbb06a902ffa7f07518bed3be6ee50f` (73 files). The 17 changed/new paths were read at that exact SHA. The existing landing/studio routing, metadata, profile fields, Help text and security headers have been reconciled with this branch. The upstream baseline and interim release report are retained under `reports/upstream-2026-11-02/` as historical evidence; their build-only UI PASS labels are not treated as browser verification. Final validation applies to the combined source documented in RELEASE_REPORT.md. No concurrent source changes were overwritten remotely.

## Live recheck on 2026-11-02

A fresh cloud-browser visit now shows the landing page at `/`, with support/company links. Clicking Launch FORGEX IDE reaches `/studio` and renders the empty IDE. These changes arrived through concurrent upstream work and are not claimed as deployments made by this task. The exact deployed commit is unknown. This task's additional image/recovery/account/branding changes remain local and are not browser-verified on that live deployment.
