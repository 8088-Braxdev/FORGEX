Imported images previously existed only in Preview memory and could be lost on recovery/export. This branch gives them a validated asset registry, Explorer/viewer integration, full backups and asset-aware recovery; GitHub imports pin a commit and preserve nested binary images. Folder saves now write binary bytes, compare changed paths and detect external changes.

It also preserves the concurrent public UX/SEO work from `e8417426ffbb06a902ffa7f07518bed3be6ee50f`, integrates the supplied logo, adds real social/PWA assets, improves account/profile availability and corrects Analyze/Restore Browser Draft regressions.

Validation at local source `923700053c4e617c1d42711ef13630606215fccd`: `npm run typecheck` and `npm run build` passed; unit/contract runner reported 54 passed, 0 failed, with its HTTP suite skipped; `npm run test:http` separately passed that suite. Tests include image fixtures, backup round trips, legacy IndexedDB migration, folder conflicts, bounded GitHub reads, session expiry/origin checks and the agreed dependency chain. No real provider quota request or product GitHub publish was made.

**Draft / not production ready.** New UI/mobile and actual OAuth/image/folder flows need a reachable Preview. Production AI/weather remain disabled; persistent linked-folder Reload and a real framework/OS runtime are not implemented. See `RELEASE_REPORT.md` for the full PASS/FAIL/NOT TESTED matrix and `RUNTIME_PLAN.md` for blockers. No production env/DNS changes are included.

Migration notes: `/studio` remains the workspace; v2 backups and v3 IndexedDB retain images and original baselines. Legacy storage is preserved; older builds cannot read v2 image backups. GitHub binary images stay outside text PR payloads, and workflow modifications remain blocked.

GitHub responses have a 4 MB encoded JSON budget and an import deadline; oversized imports return explicit partial coverage instead of failing at the hosting payload boundary.
