# FORGEX DevStudio

Developer intelligence by [BraxCode Digitals Foundation](https://braxcode.com).

FORGEX brings a browser editor, static Preview, advisory analysis, change comparison and confirmation-based GitHub pull requests into one workspace. Start at `/`; open the IDE at `/studio`. GitHub connection is optional for guest editing.

## Run locally

Use the repository folder containing `package.json`. Install the supported Node version required by Next.js 15, then run:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Stop the dev server before a production build on a constrained machine.

## What this branch implements

- Landing-first navigation, legacy `/welcome` redirect, and OAuth return/recovery at `/studio`.
- GitHub avatar, name/username, connected state, reconnect handling and explicit disconnect; credentials remain in server cookies.
- Source files and a separate binary asset registry for PNG, JPEG, WebP, GIF and ICO. Safe SVG text can be viewed as an image or edited as source.
- Image Explorer entries, viewer tabs, fit/zoom, dimensions, format/bytes and image download.
- Binary-safe backup version 2, IndexedDB recovery and OAuth recovery; version 1 text backups remain readable.
- Commit-pinned public/private GitHub import with nested images, bounded file sizes and partial-import warnings.
- Save folder writes changed/new text and binary files after confirmation. External changes are checked before writes; partial failures are reported. It does not delete disk files or create a persistent two-way folder link.
- Metadata, canonical URLs, share image, robots/sitemap, approved logo assets, favicon and PWA icons. Preview deployments request no indexing.
- Source/impact analysis, source control and a limited workspace terminal. Findings and scores are advisory.

## Limits and boundaries

Text workspace: 120 files, 400,000 characters per file and 2 million characters total. GitHub import: up to 60 text files at 125,000 bytes per file, plus up to 32 images at 1.5 MB each / 8 MB total. Unsupported/oversized relevant imports are reported as partial. GitHub JSON responses also have a 4 MB transport budget; larger imports are explicitly partial so hosting payload limits do not crash the response. Text analysis does not inspect binary data.

GitHub publishing supports text changes. Imported binary images are read-only for publishing; adding binary images locally blocks publishing until reimport. Workflow files may be read but their changes cannot be published through FORGEX. Publishing validates the base commit and original imported paths, limits changes to 20 paths, and creates a branch and pull request after confirmation.

Preview executes supported static HTML/CSS/JS in an iframe with `sandbox="allow-scripts"`. It does not install npm packages or run a React/Vite build, Next.js server or operating-system shell. Local asset rewriting covers HTML image/srcset/favicon references and CSS URLs; arbitrary JavaScript asset loaders are not a framework runtime.

Gemini, weather gateway and health bridge endpoints remain development-only. Production credentials alone do not enable them. A production provider policy with authentication, durable quotas and owner budget approval is required. API Tester is separate and subject to browser CORS.

Browser storage can be removed by browser settings or quota pressure. Export a backup before clearing site data or changing devices. Backups contain source code and repository identity: store them privately. Do not import or transmit credentials through Preview prompts.

## Configuration

See `.env.example` for names only. Enter values privately in local ignored environment files or the appropriate hosting environment. Never put GitHub or provider secrets in `NEXT_PUBLIC_` variables. GitHub configuration must match the intended host and `/api/github/callback`; Preview needs its own appropriate credentials. Do not copy production secrets to a Preview.

## Verification

```bash
npm run typecheck
node --test tests/*.test.cjs
npm run build
npm run test:http
```

`test:http` starts the production build locally, runs the HTTP smoke suite and stops the server. Run it after `npm run build`. It does not authenticate real GitHub accounts, consume Gemini quota, install a PWA or substitute for mobile browser QA. See `BASELINE_REPORT.md` and `RELEASE_REPORT.md` for evidence and outstanding checks.

## Support

- WhatsApp: [0618811359](https://wa.me/255618811359)
- Email: [braxtonbruzzzy@gmail.com](mailto:braxtonbruzzzy@gmail.com)
- Company: [BraxCode Digitals Foundation](https://braxcode.com)
