# FORGEX DevStudio

Developer intelligence by [BraxCode Digitals Foundation](https://braxcode.com).

## Supported analysis languages

FORGEX currently runs targeted heuristic checks for:
JavaScript, TypeScript, JSX/TSX, Python, PHP/PHTML, HTML, CSS, SCSS, and JSON.

Other files can be imported and edited, but are marked as not checked and do not
contribute to the Project Health score.

FORGEX brings a browser editor, static Preview, advisory analysis, change comparison, and confirmation-based GitHub pull requests into one workspace. Start at `/`; open the IDE at `/studio`. GitHub connection is optional for guest editing.

## Run locally

Use the repository folder containing `package.json`. Install the supported Node version required by Next.js 15, then run:

```bash
npm ci
npm run dev