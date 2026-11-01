# FORGEX DevStudio — Release Report (interim)

**Branch:** feature/forgex-public-ux-seo  
**Commit:** 172fc9b55171a97566163d24380804871bdec477  
**Date:** 2026-11-02  
**Deployment URL:** NOT DEPLOYED (local build only; Vercel deploy requires owner approval)

## Build/test evidence
- `npm run typecheck`: PASS
- `npm run test:engine`: PASS (30 rules)
- `node tests/sourceControl.test.cjs`: PASS (10/10)
- `node tests/intelligence-v2.test.cjs`: PASS (7/7)
- `node tests/githubPublishRetry.test.cjs`: PASS (5/5)
- `npm run build`: PASS (17 static pages)

## Acceptance matrix (this batch)

### Public routes, support, branding, SEO
- Live `/` opens Welcome landing: PASS (build + route table)
- Direct IDE route works after reload: PASS (build shows /studio static)
- GitHub OAuth returning user lands in correct workspace: NOT TESTED (requires Vercel env + browser)
- WhatsApp contact link: PASS (footer link present)
- Email support link: PASS
- Footer company links to braxcode.com: PASS
- No excessive "Local Engine"/version ticker on primary UI: PASS (removed topbar noise)
- Logo matches approved asset: NOT TESTED (no approved asset supplied)
- Metadata titles/descriptions, canonical, OG, robots, sitemap: PARTIAL (metadata/robots/sitemap added; OG image not real)
- Branded 404: PASS (retained, links updated)
- PWA installs/launches correct route: NOT TESTED

### Mobile/desktop/account
- Responsive widths tested: NOT TESTED (CSS not changed this batch)
- Mobile GitHub Connect CTA not dimmed: PARTIAL (styling improved; needs browser QA)
- GitHub login authenticates on deployment: NOT TESTED
- Monaco/editor state: NOT TESTED (no changes)
- Image viewer/binary assets: NOT IMPLEMENTED (unchanged)
- Linked folder: NOT IMPLEMENTED (unchanged)

### Files/Preview/APIs
- Save/export/restore: NOT TESTED
- HTML page navigation: NOT TESTED (unchanged)
- SVG/JPG/PNG/WebP/GIF: Previously demonstrated; NOT REGRESSION-TESTED
- Imported chatbot API: NOT TESTED
- API Tester: NOT TESTED
- No open proxy: PASS (no changes to proxy)

### Source intelligence/publishing/production
- typecheck/build: PASS
- Analyzer tests: PASS
- GitHub PR new-branch flow: NOT TESTED (unchanged)
- Release Gate evidence-only: NOT TESTED
- Vercel Preview with env: NOT TESTED (owner action)
- Runtime support claims: NOT IMPLEMENTED (unchanged)

## Remaining blockers / next work
- Approved logo asset not supplied (owner action).
- Vercel env names/values and redeploy (owner action).
- Mobile responsive QA and screenshots (needs browser emulation).
- API Preview end-to-end imported chatbot test.
- Image/binary asset lifecycle, linked folder, framework runtime (major engineering).
- OAuth callback origin verification on deployed domain.