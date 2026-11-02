# FORGEX release candidate — 2026-11-02

**Verdict: NOT READY for production release. Draft engineering review only.**

- Validated application source commit on GitHub: `7735c8fbb78fc6a9bec0ed119370fb42417c03c9` (byte-identical source tree publication was verified).
- Reconciled upstream base: `e8417426ffbb06a902ffa7f07518bed3be6ee50f`.
- Branch: `work/forgex-assets-recovery-2026-11-02`.
- The local repository was materialized through the authenticated connector; its local snapshot history is independent of GitHub history. Source bytes were verified against Git blob hashes. Published commits retain the upstream base in their ancestry. Follow-up report-only commits do not change the validated application source.
- Test environment: Next.js 15.5.28, dependency lockfile installed with `npm ci --ignore-scripts --no-audit --no-fund`; no owner secrets loaded. No Gemini requests, production environment changes, domain/DNS changes or product-generated GitHub publish operation were performed.

## Observed commands

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | Exit 0 on final source. |
| `node --test tests/*.test.cjs` | PASS | 55 registered tests: 54 passed, 0 failed, 1 HTTP suite skipped because no server origin was supplied to this invocation. |
| `npm run build` | PASS | Exit 0; optimized compilation and static generation completed. Original autoprefixer warnings were corrected. |
| `npm run test:http` | PASS | Starts the production build, runs the skipped HTTP suite against 127.0.0.1:3100, then stops it: 1 passed, 0 failed. |
| `git diff --check` | PASS | No whitespace errors. |
| Narrow current-source secret-pattern scan | PASS for its limited scope | No private-key header, GitHub token or Google API-key pattern matched. This is not a full history/security audit. |

The engine suite covers 30 rules. Dependency fixture verifies 1 changed, 1 direct, 1 indirect, unresolved=0. Existing source-control and publish-retry tests remain passing.

## Changes ready for code review

The branch preserves concurrent upstream landing/studio routing, Help content, JSON-LD and security headers. It adds approved logo derivatives and a real share image, page titles/canonicals, Preview noindex behavior, clearer account controls and support links. Browser QA found and corrected a duplicated Studio title. The primary account UI receives avatar/name/username from the actual session endpoint; no token is included in that response.

Images are separate from source. Local uploads, folder imports and commit-pinned GitHub imports retain nested PNG/JPEG/WebP/GIF/ICO assets. Explorer/viewer code provides fit/zoom/download and image metadata. Conservative SVG display rejects active/unsupported content while preserving original source. HTML src/srcset/favicon and CSS URL rewriting have transformation tests.

Workspace backup version 2 includes images, original comparison/GitHub baselines, selected path and repository identity. Version 1 text backups remain readable. Asset-aware recovery uses IndexedDB v3, copies legacy v2 data once and leaves v2 untouched, preventing older tabs from overwriting new asset fields. Clearing v3 uses a tombstone so legacy drafts do not reappear. OAuth uses the full IndexedDB draft plus a small session marker instead of putting image data into sessionStorage.

GitHub imports also enforce a 4 MB encoded JSON budget, counting UTF-8 and JSON escaping. Excess entries are explicitly skipped/partial rather than exceeding the hosting payload limit. The hosting limit is documented in [Vercel Functions limits](https://vercel.com/docs/functions/limitations).

Manual Save folder includes binary bytes, writes only changed/new paths and checks external changes before writing. It aborts failed streams and reports partial completion. A recursive Restore Browser Draft call and Analyze collapsing expanded mode were corrected. Desktop Preview QA verified Analyze retains expanded mode, PNG viewing, editing, image recovery, and a real backup download/import. Broader browser/mobile and native filesystem verification is still required.

## Acceptance matrix

PASS means only the boundary named in the evidence column passed. Unit/mocked checks are not presented as real provider or browser tests.

| Acceptance item | Status | Evidence or remaining boundary |
| --- | --- | --- |
| Landing first, CTA to studio, direct studio HTTP route | PASS | Final built HTTP suite. |
| Current live landing and CTA | PASS | Fresh cloud browser on 2026-11-02: `/` shows landing; CTA reaches `/studio`. These arrived through concurrent upstream work; deployed SHA unknown. |
| New branch Preview build | PASS | GitHub's Vercel status and deployment bot report READY for published source commit `f9e821bb2c139e02484fcf408499bf42778dadce`. No production promotion was performed. |
| New branch browser interactions | PARTIAL PASS | The owner explicitly approved temporary Preview sharing; desktop cloud-browser QA on commit `d813de3` verified landing/studio navigation, expanded Analyze, PNG upload/view/zoom, refresh recovery, source editing, sandbox DOM output, and backup export/import. Mobile, real OAuth and native filesystem boundaries remain open. |
| Follow-up Studio title and asset-aware replacement fixes | PARTIAL PASS | Latest hosted commit `7735c8f` renders `Studio | FORGEX DevStudio` once. Counts and replacement confirmations now include image-only workspaces. The browser's upload permission was declined on this new Preview, so the image-only confirmation flow could not be exercised there. |
| Legacy welcome and old root OAuth callback migration | PASS | HTTP 308 welcome redirect and 307 `?github=connected` redirect to studio. |
| Real GitHub OAuth login and workspace restoration on hosting domain | BLOCKED | Hosted Preview session endpoint returned HTTP 200 with `connected:false, configured:false`; UI correctly disables login. Configuration values were not retrieved or changed. |
| Support email/WhatsApp and company footer targets | PASS | Built public/help/legal/404 markup checks. No message was sent. External destination availability not verified. |
| Legal policy accuracy and operator review | NOT TESTED | Hosting retention/operational details still require owner review. |
| Canonical/title/OG/Twitter metadata, robots and sitemap | PASS | Source and built HTTP checks; private studio/API routes excluded from sitemap/indexing policy. |
| Approved logo source preserved | PASS | Original SHA-256 `8214cd5bf3f963dbda17908feff609803964164bc3b2c1fdca7d112bb999dd62`; derivatives use that asset. |
| Favicon, share image, Apple and manifest icon assets | PASS | Generated dimensions and HTTP/icon-signature checks. Browser installation appearance not verified. |
| PWA install, launch and offline semantics | NOT TESTED | Manifest start_url is `/`; actual install/launch not performed. No offline execution claim added. |
| 320/360/375/390/428/768/1024/desktop responsive interactions | NOT TESTED | CSS improvements implemented; mobile emulation/touch/screenshots remain required. |
| Available GitHub button contrast and account popup | PARTIAL PASS | Unconfigured deployment state was observed: Connect GitHub is disabled with an explanatory message. Configured/connected states and profile popup remain untested. |
| Session avatar/name/username, expiry, offline and logout origin | PASS | Mocked handler tests; no real account authentication claimed. |
| Monaco tabs, focus, suggestions and mobile editor | PARTIAL PASS | Desktop HTML editing through Monaco and switching source/image tabs were observed. Suggestions and mobile editing remain untested. |
| Analyze preserves IDE expansion and reveals insights | PASS | Desktop browser retained Exit full screen and displayed Insights with health score 99/100 after Analyze on the three-file template. |
| Image bytes remain outside text analyzer | PASS | Registry/backup/import tests; no binary text conversion. |
| PNG/JPEG/WebP/animated GIF/ICO handling | PASS for fixtures and PNG browser decode | Real fixture bytes pass registry validation. Uploaded/restored PNG decoded at 192 × 192 in viewer and sandbox; other formats' browser decode/animation remain untested. |
| SVG active-content exclusion | PASS | Conservative display tests, source retained. Not a complete SVG sanitizer. |
| Nested HTML/CSS/srcset/favicon asset rewriting | PASS | Generated Preview transformation tests. |
| Explorer image viewer, dimensions, zoom/fit and download | PARTIAL PASS | PNG Explorer/viewer, dimensions and 125% zoom observed. Original data-URL download timed out; commit `7735c8f` replaces it with a Blob URL. Build/types pass, but the browser's declined upload permission on the new Preview prevented a hosted download/byte comparison. |
| IndexedDB migration, isolation, selected path, baselines and deleted imported paths | PASS within tested boundaries | Mocked migration/isolation tests plus a real hosted refresh and Restore Workspace retained the PNG and selected image path. OAuth and native storage edge cases remain untested. |
| Backup version 2 round-trip and version 1 compatibility | PASS | Real hosted export/import of three source files plus one PNG succeeded; downloaded PNG payload exactly matched original bytes. Contract tests also preserve baselines/identity and version 1 compatibility. 18 MB serialized limit fails explicitly. |
| Public/private GitHub image import | PASS for mocked adapter | Commit-pinned nested fixture, symlink/partial handling, request bounds and fixed destination tests. Real public/private repository import not performed. |
| Binary asset changes in product PR payload | PASS for scope restriction | Images remain outside text payload; local image additions mark import partial. Browser confirmation behavior not yet exercised. |
| HTML navigation Back/Forward and page selector | NOT TESTED | Existing implementation retained; injected scripts compile, but actual navigation not re-exercised on new build. |
| Imported chatbot scope/JS loading fixture | PASS for compilation | Classic-script fixture compiles; no undeclared global testAI dependency. |
| Imported chatbot consent → real Gemini → visible response | FAIL | Production AI remains disabled; no real provider request or response-render test performed. |
| Weather and generic external provider connections in production | FAIL | Current handlers remain development-only; general provider registry/runtime not implemented. |
| API Tester GET/POST/CORS interaction | NOT TESTED | Existing separate tester retained. |
| Open proxy/SSRF/token exposure protection | NOT TESTED as full security audit | GitHub adapter has fixed destinations, redirects rejected, bounded reads; no new arbitrary proxy. Full abuse/rate-limit review remains. |
| Folder binary writes, changed-only plan, external conflicts and partial failures | PASS | Mocked filesystem tests cover these boundaries. |
| Native folder permissions, cancellation and actual disk writes | NOT TESTED | Must be exercised in supported Chrome/Edge on a real folder. |
| Persistent linked-folder Save/Reload across refresh/revocation | FAIL | Not implemented; manual folder export remains distinct. |
| Analyzer, diff, intelligence and dependency fixture | PASS | Existing suites plus dependency chain fixture. |
| Product PR stale SHA, collision and retry/idempotency cases | PASS | Existing publish-retry contract tests. Not live GitHub publishing. |
| Product real new-branch PR creation/status/Release Gate evidence | NOT TESTED | No product publish operation or live Release Gate test was performed. |
| New server input validation and import request bounds | PASS for tested boundaries | Streamed byte/content-type tests and capped failed-download test. Not a general rate-limit audit. |
| Vercel Preview/Production secrets names and OAuth origin config | BLOCKED for real OAuth | Preview reports GitHub `configured:false`. Secret names/values and OAuth origin configuration were not inspected or changed; no inference is made about Production configuration. |
| Genuine React/Vite/Next runtime and OS terminal | FAIL | Not implemented; see RUNTIME_PLAN.md for staged isolation proposal and infrastructure/budget blockers. |

## Migration, rollback and review notes

- `/` remains public landing; `/studio` is the IDE and is noindex. `/welcome` redirects to `/`. The OAuth callback endpoint stays `/api/github/callback`; return destination is `/studio`.
- No new required secret names. Existing server names are listed in `.env.example`; Preview must have appropriately scoped credentials. Public support details are constants supplied by the owner.
- Backup v2 and recovery v3 are forward features: older builds cannot read the new image backup format. Keep exported backups; do not delete the v3 database when reverting code. The old v2 database is preserved, so rollback does not overwrite v3 assets. An old build can show older workspace data until the new version is restored.
- GitHub binary assets are read-only for publishing. SVG remains text; workflow edits are explicitly blocked. Public import can fall back to anonymous reading when the connected app lacks access.
- Filesystem saves are not atomic across multiple paths. Tests cover stopping and partial-reporting, not elimination of every possible external filesystem race.
- Prior reports from concurrent upstream work are archived in `reports/upstream-2026-11-02/`. Their build-only UI PASS labels are historical, not proof of end-to-end behavior.
- Keep the PR draft until a reachable Preview passes browser/mobile, real OAuth, image import/recovery and native folder tests. Production AI/runtime/linked-folder requirements remain open and are not hidden behind this batch's passing tests.

## Published review evidence — 2026-11-02

- Draft review PR: [#3](https://github.com/8088-Braxdev/FORGEX/pull/3), targeting `main` from `work/forgex-assets-recovery-2026-11-02`. GitHub reported open, draft and mergeable; no merge was performed.
- Published source commit `f9e821bb2c139e02484fcf408499bf42778dadce` has tree `826c5d3d81d6b5855a38f312bb10068e5ebca50b`, matching the validated local tree byte-for-byte. This publication check does not test FORGEX's in-product publishing flow.
- The final standalone HTTP suite completed with 1 passed, 0 failed. The unit/contract run completed with 54 passed, 0 failed and its HTTP case skipped; typecheck and build also passed.
- GitHub reported the Vercel check successful. No GitHub Actions pull-request workflow runs were returned. A Vercel build success is not a browser/mobile/OAuth acceptance result.
- Read-only deployment inspection initially returned 403 for team `braxton-bruzzzys-projects`. After the owner approved the official team consent link, inspection succeeded: deployment `dpl_CxeSMNgnB8d4NVBUd4KsHyiKiP1Y` was READY and its Git metadata matched PR head `753e0188abba6a84d09b7d181fa89e6ad6e31582`.
- Before explicit sharing approval, browser automatic approval blocked navigation through Vercel authentication because it may expose a private dashboard. A temporary share link request was separately rejected because anyone holding that link could access the deployment for up to 23 hours. At that stage no share link was created and browser acceptance was untested. The subsequent authorization and QA are recorded below; protection settings and credentials were not changed.

## Authorized desktop Preview QA follow-up — 2026-11-02

The owner subsequently explicitly authorized temporary sharing for up to 23 hours and requested the link. Protected deployment settings were preserved. Temporary access URLs are deliberately excluded from repository files because they grant access to anyone holding them.

On hosted commit `d813de38f3db36ca43a3e820b95ed838881efc23`, the cloud browser verified:

- Public landing renders the supplied logo and support links; Open FORGEX reaches `/studio`.
- New web project creates three source files. Analyze preserves the expanded IDE and reveals Insights/99-point heuristic health score on this fixture.
- A real 36,234-byte PNG upload opens in Explorer/viewer at 192 × 192; zoom changes to 125%.
- Refresh offers Restore Workspace; confirming restores that image and its selected path.
- Monaco HTML editing, sandbox execution, and a real DOM `addEventListener` work. Clicking the test button visibly displays `Script works`; the restored PNG decodes at 192 × 192 in the sandbox. The sandbox's 320 px viewport/focus mode was exercised; this is not a mobile application layout test.
- Export project backup downloads a version 2 JSON containing three source files plus one PNG. Decoded image bytes match the original exactly: SHA-256 `7ec262a2f201c583d852fbabe950483884802c5126b1e649b371857cecc98d26`. Reimport through Restore Backup preserves the image and functioning HTML.
- `/api/github/session` returns HTTP 200, `Cache-Control: no-store`, and `connected:false, configured:false`. The unavailable UI is accurate. No real OAuth or provider request was performed.

Browser QA and follow-up source review found a duplicate Studio title, image counts omitted from workspace/recovery notices, missing replacement confirmation for an image-only workspace, and a data-URL image download that did not start in this browser. Follow-up source commits `04817f1` and `7735c8f` correct those cases; image download now creates and later revokes a Blob URL from the original bytes.

Desktop evidence from the earlier tested source is saved in [the image and recovery screenshot](reports/qa/desktop-assets-recovery-d813de3.jpg). It demonstrates that fixture's image decode and sandbox DOM output; it is not evidence that the follow-up download or image-only confirmation passed.

Latest application source `7735c8fbb78fc6a9bec0ed119370fb42417c03c9` was verified against the local tree `1d8c6c76fa43f7a406a3c3b785102f6e5357efa1`. Local build, typecheck, 54 unit/contract tests and the separate HTTP suite passed. One earlier typecheck overlapped a build that regenerated `.next/types`; it was rerun successfully after build completion. The HTTP suite now asserts the exact Studio title.

Vercel deployment `dpl_HEQGFrMD5Qv5Dxz7mjDNzwUtxPNS` is READY and matches that source commit. The browser opened its landing and observed the corrected Studio title. Upload permission for the image-only QA fixture on this new origin was declined by the user; no alternate upload path was attempted. Final hosted image download and image-only replacement confirmation remain NOT TESTED. The PR remains draft and NOT READY for production.
