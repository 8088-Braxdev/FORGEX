# FORGEX DevStudio — Baseline Report

**Branch:** feature/forgex-public-ux-seo  
**Baseline commit:** e60a72d274c23d2f56e110c91a246dc31157c221  
**Date:** 2026-11-02  

## Environment (non-secret names only)
- Node.js + npm
- Next.js 15.5.28, React 19.1.0, TypeScript 5.8.0, Monaco 0.57.0
- Vercel project `forgex`, domain https://forgex-gamma.vercel.app/
- Env names observed in code: GEMINI_API_KEY, GITHUB_COOKIE_KEY, GITHUB_CLIENT_SECRET, GITHUB_CLIENT_ID, FORGEX_APP_ORIGIN, NEXT_PUBLIC_FORGEX_SUPPORT_EMAIL

## Scripts run
- `npm run typecheck` → PASS (exit 0)
- `npm run test:engine` → PASS (30 rules)
- `node tests/sourceControl.test.cjs` → PASS (10/10)
- `node tests/intelligence-v2.test.cjs` → PASS (7/7)
- `node tests/githubPublishRetry.test.cjs` → PASS (5/5)
- `npm run build` → PASS (compiled successfully, 17 static pages)

## Routes (before)
- `/` = IDE workbench (client)
- `/welcome` = landing
- `/privacy`, `/terms`, `/_not-found` branded

## Routes (after this batch)
- `/` = landing (public layout)
- `/studio` = IDE workbench
- `/welcome` = redirect to `/`
- `/privacy`, `/terms`, `/_not-found`

## Notes
- autoprefixer warning observed: `end` value mixed support; not blocking.
- No secrets printed or committed. `.env.local` remains untracked.