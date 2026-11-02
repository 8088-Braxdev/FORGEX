# Production providers, linked folders and framework runtime

**Status: architecture only; not provisioned or demonstrated. Date: 2026-11-02.**

The static srcDoc Preview is not a Node/React/Vite/Next runtime. The terminal remains a limited workspace command interface. This branch does not change those claims or relax the iframe sandbox.

## Production provider boundary

The existing AI, weather gateway and health handlers are development-only. Production UI now describes this limitation. Removing the guard alone would expose shared quota and is not an acceptable rollout.

A production implementation requires an explicitly enabled owner policy; a verified session binding; same-origin/CSRF checks; durable per-account and total quotas; a budget ceiling; a server-controlled provider/action/schema registry; bounded request and response streams; timeouts; redirect rejection; and logs that omit secrets and private prompts. A curated provider adapter should have a fixed destination; no arbitrary URL proxy. Generic destinations require DNS/IP/redirect defenses in addition to an allowlist. Credentials must never be given to imported browser code.

Next acceptance fixture: `examples/preview-chatbot`. Its script uses addEventListener, so it does not depend on an undeclared global testAI function. Verify click → consent → provider → response → visible output, then deny/timeout/quota/offline paths, on an approved Preview deployment. No real provider request was made during this task.

Blocker: no approved production provider access/budget policy or durable quota backend has been provisioned for this branch. Configured Production keys alone do not resolve that boundary. Preview credentials must be scoped separately.

## Persistent linked folder

This branch implements manual Save folder with binary writes, changed-file detection, explicit overwrite review, external-change checks and partial-failure reporting. It does not persist a directory handle, synchronize in the background, delete disk files or reload a linked folder.

The next implementation should persist an explicitly chosen handle and project identity in IndexedDB, recheck permissions after refresh, maintain fingerprints from the last disk read/save, and require conflict decisions for Save/Reload. Replacing a project must detach the old handle. Unsupported browsers keep import/export backup. Real Chrome/Edge permission, revocation, external-edit, cancellation and refresh tests are required before advertising this workflow. Filesystem writes are not a multi-file atomic transaction; failures must name saved and unsaved paths.

Blocker: browser-native permission and disk interaction QA is unavailable against the agent's local server from the cloud browser. Mock tests verify the write planner and conflict boundaries but do not replace device tests.

## Framework runner proposal

Use a separate isolated runner with a private filesystem, short lifetime, resource ceilings, tenant ownership, an authenticated preview origin and default-denied egress. Keep GitHub/provider credentials outside untrusted execution. Audit package install scripts and dependency license terms before enabling installs. Start with a single controlled React/Vite fixture, then a Next.js fixture that demonstrates a real server route. Run denial, timeout, cleanup, cross-tenant and cost-ceiling tests before exposing a terminal.

Vercel Sandbox is a candidate because its official documentation describes microVM isolation and development-server previews. It has usage charges and network controls; it was not activated or purchased here. No VM, account permission, billing setting, domain or production environment was changed.

Implementation stages: owner selects runner/budget → isolated empty runner with stop/cleanup tests → controlled build fixture → authenticated preview routing → editor sync and logs → constrained interactive commands → wider framework support. Runtime support should remain clearly absent until an actual application passes those tests.

Official references consulted: [Vercel Sandbox](https://vercel.com/docs/sandbox), [network controls](https://vercel.com/sandbox), [Next.js metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).
