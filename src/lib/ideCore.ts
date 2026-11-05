import { safeIdePath } from "./paths";
export { safeIdePath } from "./paths";
import type { SourceFile } from "./analyzer";
import { svgPreviewUrl, type PreviewBinaryAsset } from "./previewAssets";
export const IDE_MAX_FILES = 120;
export const IDE_MAX_CHARS = 2_000_000;

const LANGUAGES: Record<string, { name: string; monaco: string }> = {
  js: { name: "JavaScript", monaco: "javascript" },
  jsx: { name: "JavaScript", monaco: "javascript" },
  mjs: { name: "JavaScript", monaco: "javascript" },
  cjs: { name: "JavaScript", monaco: "javascript" },
  ts: { name: "TypeScript", monaco: "typescript" },
  tsx: { name: "TypeScript", monaco: "typescript" },
  html: { name: "HTML", monaco: "html" },
  htm: { name: "HTML", monaco: "html" },
  css: { name: "CSS", monaco: "css" },
  scss: { name: "SCSS", monaco: "scss" },
  json: { name: "JSON", monaco: "json" },
  py: { name: "Python", monaco: "python" },
  md: { name: "Markdown", monaco: "markdown" },
  php: { name: "PHP", monaco: "php" },
  go: { name: "Go", monaco: "go" },
  rs: { name: "Rust", monaco: "rust" },
  java: { name: "Java", monaco: "java" },
  c: { name: "C", monaco: "c" },
  cpp: { name: "C++", monaco: "cpp" },
  h: { name: "C++", monaco: "cpp" },
  hpp: { name: "C++", monaco: "cpp" },
  cs: { name: "C#", monaco: "csharp" },
  rb: { name: "Ruby", monaco: "ruby" },
  sql: { name: "SQL", monaco: "sql" },
  yml: { name: "YAML", monaco: "yaml" },
  yaml: { name: "YAML", monaco: "yaml" },
  sh: { name: "Shell", monaco: "shell" },
  bash: { name: "Shell", monaco: "shell" },
  txt: { name: "Text", monaco: "plaintext" },
};

export function ideLanguage(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGES[extension] ?? { name: "Text", monaco: "plaintext" };
}

export function languageTotals(files: SourceFile[]) {
  const totals = new Map<string, { files: number; lines: number }>();
  let totalLines = 0;
  for (const file of files) {
    const name = ideLanguage(file.path).name;
    const lines = file.content
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "").length;
    const previous = totals.get(name) ?? { files: 0, lines: 0 };
    totals.set(name, {
      files: previous.files + 1,
      lines: previous.lines + lines,
    });
    totalLines += lines;
  }
  return [...totals]
    .map(([name, value]) => ({
      name,
      ...value,
      percent: totalLines ? (100 * value.lines) / totalLines : 0,
    }))
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));
}

export function validateWorkspace(files: SourceFile[]): SourceFile[] {
  if (
    !Array.isArray(files) ||
    files.length < 1 ||
    files.length > IDE_MAX_FILES
  ) {
    throw new Error(`Project must contain 1–${IDE_MAX_FILES} files.`);
  }
  let chars = 0;
  const names = new Set<string>();
  return files.map((file) => {
    if (
      !file ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    ) {
      throw new Error("Invalid project file.");
    }
    const path = safeIdePath(file.path);
    if (!path) throw new Error(`Invalid path: ${file.path}`);
    if (names.has(path.toLowerCase()))
      throw new Error(`Duplicate path: ${path}`);
    names.add(path.toLowerCase());
    chars += file.content.length;
    if (file.content.length > 400_000 || chars > IDE_MAX_CHARS) {
      throw new Error("Project is too large (400k chars/file, 2m total). ");
    }
    return { path, content: file.content };
  });
}

export function starterProject(): SourceFile[] {
  return [
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My FORGEX project</title>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <main>
    <h1>My project</h1>
    <p>
      Edit these files in the editor, then press Run to see the preview
      update live. Open the Console tab to read its output.
    </p>
    <button id="ping" type="button">Test the console</button>
    <button id="fetch-advice" type="button" class="secondary">Fetch a live API</button>
    <p id="advice" role="status"></p>
  </main>
  <script src="./app.js"></script>
</body>
</html>
`,
    },
    {
      path: "style.css",
      content: `body { background: #101820; color: #e9f4f0; font-family: system-ui, sans-serif; padding: 1.25rem; }
main { max-width: 560px; margin: auto; }
h1 { color: #b9fa77; font-size: 1.35rem; }
p { font-size: 0.95rem; line-height: 1.6; }
button { background: #b9fa77; border: 0; border-radius: 8px; padding: 12px 18px; cursor: pointer; font-weight: 600; font-size: 0.95rem; }
button.secondary { background: #1c2b33; color: #d8e6df; border: 1px solid #3d5a49; margin: 8px 0 0; }
#advice { min-height: 1.5em; color: #9fd8a8; word-wrap: break-word; }
@media (max-width: 360px) { body { padding: 1rem; } button { width: 100%; padding: 14px 16px; } button.secondary { margin-top: 8px; } }
`,
    },
    {
      path: "app.js",
      content: `// This template runs inside the FORGEX preview sandbox.
// Try each button, then inspect the Console and Network tabs below.

document.querySelector("#ping").addEventListener("click", () => {
  console.info("Button clicked. This message came from app.js.");
});

// Live API demo: the sandbox can call public HTTPS APIs and render the
// response. Replace the URL with your own API endpoint.
document.querySelector("#fetch-advice").addEventListener("click", () => {
  const output = document.querySelector("#advice");
  output.textContent = "Loading…";
  fetch("https://api.github.com/zen")
    .then((response) => {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.text();
    })
    .then((text) => {
      output.textContent = text;
    })
    .catch((error) => {
      output.textContent = "Request failed: " + error.message;
    });
});
`,
    },
  ];
}

function resolveLocal(path: string, relative: string): string | null {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/|#)/i.test(relative)) return null;
  const cleanRef = relative.split(/[?#]/)[0];
  const parts = (path.split("/").slice(0, -1).join("/") + "/" + cleanRef)
    .replace(/\\/g, "/")
    .split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!stack.length) return null;
      stack.pop();
    } else stack.push(part);
  }
  return stack.join("/");
}

export type PreviewDocument = { html: string; entry: string };

/**
 * Explicit allowlist of public CDNs that imported projects may load scripts
 * and styles from inside the sandboxed preview. Everything else in those
 * categories stays blocked, keeping the injection surface small.
 *
 * Data requests use a two-stage strategy so imported apps receive real
 * responses even when the target API has no CORS headers: direct
 * https/wss calls are attempted first, and anything the browser blocks
 * (the sandbox sends Origin: null) retries through FORGEX's server-side
 * preview proxy. The proxy performs a genuine server-to-server request,
 * which is not subject to browser CORS, and returns status, contentType
 * and body; the sandbox shim rebuilds a real Response object so app code
 * cannot tell the difference. The proxy keeps SSRF protections: https
 * targets only, private networks blocked, FORGEX origin blocked, size
 * and rate limits enforced, and no FORGEX credentials are attached.
 */
const PREVIEW_SCRIPT_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://esm.sh";
const PREVIEW_STYLE_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com";

/** FORGEX's own hostname; requests to it are always blocked from previews. */
const APP_HOST =
  typeof window !== "undefined"
    ? window.location.hostname.toLowerCase()
    : "";

export function buildPreview(
  files: SourceFile[],
  channel: string,
  requestedPage = "",
  binaryAssets: readonly PreviewBinaryAsset[] = [],
  aiRoute = "",
): PreviewDocument | null {
  const requested = files.find(
    (file) =>
      file.path === requestedPage &&
      /\.html?$/i.test(file.path),
  );

  const entry =
    requested ??
    files.find((file) => file.path === "index.html") ??
    files.find((file) => /(^|\/)index\.html?$/i.test(file.path)) ??
    files.find((file) => /\.html?$/i.test(file.path));
  if (!entry) return null;
  const contents = new Map(files.map((file) => [file.path, file.content]));

  const binaryAssetUrls = new Map(
    binaryAssets.map((asset) => [asset.path, asset.dataUrl]),
  );

  const localBinaryUrl = (
    ownerPath: string,
    reference: string,
  ): string | null => {
    const resolved = resolveLocal(ownerPath, reference.trim());
    return resolved
      ? (binaryAssetUrls.get(resolved) ?? null)
      : null;
  };

  const localSvgUrl = (
    ownerPath: string,
    reference: string,
  ): string | null => {
    const path = resolveLocal(ownerPath, reference.trim());

    if (!path || !/\.svg$/i.test(path)) return null;

    const svg = contents.get(path);

    if (
      !svg ||
      svg.length > 100_000 ||
      !/<svg(?:\s|>)/i.test(svg)
    ) {
      return null;
    }

    return svgPreviewUrl(svg);
  };

  const rewriteCssSvgUrls = (
    css: string,
    ownerPath: string,
  ): string =>
    css.replace(
      /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]*))\s*\)/gi,
      (original, doubleQuoted, singleQuoted, unquoted) => {
        const reference = (
          doubleQuoted ??
          singleQuoted ??
          unquoted ??
          ""
        ).trim();

        const dataUrl =
          localSvgUrl(ownerPath, reference) ??
          localBinaryUrl(ownerPath, reference);

        return dataUrl ? `url("${dataUrl}")` : original;
      },
    );

  let html = entry.content;
  const escapeClose = (code: string, tag: string) =>
    code.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);

  // In a srcdoc iframe every relative resource URL resolves against the
  // FORGEX page itself (/studio), so unresolvable references produce real
  // network requests to the FORGEX origin that fail as confusing console
  // errors. Empty attributes are stripped (they never carry a resource),
  // and script/link/img references that do not resolve to a workspace
  // file are removed and reported once instead of being left to hit FORGEX.

  html = html.replace(
    /<(img|script|source)\b([^>]*?)\ssrc\s*=\s*(["'])\s*\3/gi,
    (_match, tag: string, before: string) => `<${tag}${before}`,
  );
  html = html.replace(
    /<link\b([^>]*?)\shref\s*=\s*(["'])\s*\2/gi,
    (_match, before: string) => `<link${before}`,
  );
  html = html.replace(
    /<(img|source)\b([^>]*?)\ssrcset\s*=\s*(["'])\s*\3/gi,
    (_match, tag: string, before: string) => `<${tag}${before}`,
  );

  const droppedResources: string[] = [];
  html = html.replace(
    /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/script>/gi,
    (tag, _quote: string, ref: string) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|data:)/i.test(ref)) return tag;
      const resolved = resolveLocal(entry.path, ref);
      if (resolved && contents.has(resolved)) return tag;
      droppedResources.push(ref);
      return "";
    },
  );

  html = html.replace(
    /<link\b[^>]*>/gi,
    (tag) => {
      if (/\brel\s*=\s*["'][^"']*(?:icon)[^"']*["']/i.test(tag)) return tag;
      const hrefMatch = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(tag);
      if (!hrefMatch) return tag;
      const ref = hrefMatch[2];
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|data:|#)/i.test(ref)) return tag;
      const resolved = resolveLocal(entry.path, ref);
      if (resolved && contents.has(resolved)) return tag;
      droppedResources.push(ref);
      return "";
    },
  );

  html = html.replace(
    /<img\b[^>]*>/gi,
    (tag) => {
      const srcMatch = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(tag);
      if (!srcMatch) return tag;
      const ref = srcMatch[2];
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|data:)/i.test(ref)) return tag;
      const dataUrl =
        localSvgUrl(entry.path, ref) ?? localBinaryUrl(entry.path, ref);
      if (dataUrl) return tag.replace(srcMatch[0], `src="${dataUrl}"`);
      const resolved = resolveLocal(entry.path, ref);
      if (resolved) return tag;
      droppedResources.push(ref);
      return "";
    },
  );

  html = html.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    (tag, ref: string) => {
      const resolved = resolveLocal(entry.path, ref);
      const code = resolved ? contents.get(resolved) : undefined;
      return code !== undefined && resolved && /\.css$/i.test(resolved)
        ? `<style>${escapeClose(
            rewriteCssSvgUrls(code, resolved),
            "style",
          )}</style>`
        : tag;
    },
  );
  html = html.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (tag, ref: string) => {
      const resolved = resolveLocal(entry.path, ref);
      const code = resolved ? contents.get(resolved) : undefined;
      // Source labels are best-effort; browsers may still report about:srcdoc.
      const sourceLabel = resolved
        ? resolved.replace(/[^a-zA-Z0-9_./-]/g, "_")
        : "script.js";

      if (
        code === undefined ||
        !resolved ||
        !/\.(?:js|mjs|cjs)$/i.test(resolved)
      ) {
        return tag;
      }

      return (
        `<script data-forgex-source="${encodeURIComponent(resolved)}">\n` +
        `${escapeClose(code, "script")}\n` +
        `//# sourceURL=forgex-preview:///${sourceLabel}\n` +
        `</script>`
      );
    },
  );

  // Resolve responsive images and imported favicon references without opening the sandbox.
  html = html.replace(/<(?:img|source)\b[^>]*>/gi, tag => tag.replace(
    /\bsrcset\s*=\s*(["'])(.*?)\1/i,
    (attribute, quote: string, value: string) => {
      if (/data:/i.test(value)) return attribute;
      const rewritten = value.split(",").map(candidate => {
        const match = candidate.trim().match(/^(\S+)(.*)$/);
        if (!match) return candidate;
        const dataUrl = localSvgUrl(entry.path, match[1]) ?? localBinaryUrl(entry.path, match[1]);
        return dataUrl ? dataUrl + match[2] : candidate.trim();
      }).join(", ");
      return `srcset=${quote}${rewritten}${quote}`;
    },
  ));
  html = html.replace(/<link\b[^>]*>/gi, tag => {
    if (!/\brel\s*=\s*["'][^"']*(?:icon)[^"']*["']/i.test(tag)) return tag;
    return tag.replace(/\bhref\s*=\s*(["'])(.*?)\1/i, (attribute, quote: string, reference: string) => {
      const dataUrl = localSvgUrl(entry.path, reference) ?? localBinaryUrl(entry.path, reference);
      return dataUrl ? `href=${quote}${dataUrl}${quote}` : attribute;
    });
  });

  // Resolve SVG images loaded from the local workspace.
  html = html.replace(/<img\b[^>]*>/gi, (tag) =>
    tag.replace(
      /\bsrc\s*=\s*(["'])(.*?)\1/i,
      (attribute, _quote: string, reference: string) => {
        const dataUrl =
          localSvgUrl(entry.path, reference) ??
          localBinaryUrl(entry.path, reference);

        return dataUrl
          ? `src="${dataUrl}"`
          : attribute;
      },
    ),
  );

  // Resolve SVG URLs inside inline HTML style blocks.
  html = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (tag, css: string) =>
      tag.replace(
        css,
        rewriteCssSvgUrls(css, entry.path),
      ),
  );

  // Opaque-origin iframe; sends limited console entries only to this page.
  const safeChannel = JSON.stringify(channel).replace(/</g, "\\u003c");

  const safeAiRoute = JSON.stringify(
    /^\/api\/[a-z0-9/_-]{1,80}$/i.test(aiRoute)
      ? aiRoute
      : "",
  ).replace(/</g, "\\u003c");

  const droppedNotice =
    droppedResources.length === 0
      ? ""
      : `emit('warn', ['${droppedResources
          .slice(0, 10)
          .map((item) => item.replace(/'/g, ""))
          .join(" | ")} not found in this workspace; relative references were removed so they do not hit the FORGEX origin.'], 'Preview sandbox');`;

  const instrument = `<script>(function(){
    var channel=${safeChannel};
    var previewAiRoute=${safeAiRoute};
${droppedNotice}
// Real-world apps (auth SDKs, Supabase, Firebase, settings caches) read
// localStorage/sessionStorage during startup. A sandboxed iframe without
// allow-same-origin throws on the first access, which used to crash those
// apps before they could render. Probe both stores and install an
// in-memory fallback when access throws. The fallback lives only for this
// preview instance: data does not survive a preview reload, which is the
// correct expectation inside an opaque sandbox.
(function(){
  function memoryStorage(){
    var data = Object.create(null);
    return {
      getItem: function(key){ key = String(key); return key in data ? data[key] : null; },
      setItem: function(key, value){ data[String(key)] = String(value); },
      removeItem: function(key){ delete data[String(key)]; },
      clear: function(){ data = Object.create(null); },
      key: function(index){ var keys = Object.keys(data); return index >= 0 && index < keys.length ? keys[index] : null; },
      get length(){ return Object.keys(data).length; }
    };
  }
  ['localStorage','sessionStorage'].forEach(function(name){
    var usable = false;
    try {
      var probe = window[name];
      probe.setItem('__forgex_probe__','1');
      probe.removeItem('__forgex_probe__');
      usable = true;
    } catch (error) {
      usable = false;
    }
    if (!usable) {
      try {
        Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
      } catch (defineError) {
        // Leave the native accessor in place; apps must handle it.
      }
    }
  });
})();

document.addEventListener('click', function(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  ) return;

  var node = event.target;
  var link = node && node.closest
    ? node.closest('a[href]')
    : null;

  if (!link || link.hasAttribute('download')) return;

  var target = (link.getAttribute('target') || '').toLowerCase();

  if (target && target !== '_self') return;

  var href = link.getAttribute('href') || '';

  if (
    !href ||
    href.charAt(0) === '#' ||
    href.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) return;

  // Stop the iframe from navigating to a Next.js route.
  event.preventDefault();

  parent.postMessage({
    kind: 'forgex-preview-navigation',
    channel: channel,
    href: href.slice(0, 512)
  }, '*');
}, true);

var sourceMaps = __FORGEX_SOURCE_MAPS__;

function locateSource(source, line, column) {
  var reported = String(source || "");
  var prefix = "forgex-preview:///";
  var label = reported.startsWith(prefix)
    ? reported.slice(prefix.length)
    : null;

  var srcdoc =
    !reported ||
    reported === "about:srcdoc" ||
    reported === "HTML preview";

  var n = Number(line);

  if (!label && !srcdoc) {
    return { source: reported, line: 0, column: 0 };
  }

  for (var i = 0; i < sourceMaps.length; i++) {
    var m = sourceMaps[i];

    if (label && label !== m.label) continue;

    if (n >= m.startLine && n <= m.endLine) {
      return {
        source: prefix + m.path,
        line: n - m.startLine + 1,
        column: Number(column) || 0
      };
    }
  }

  if (label) {
    var candidates = sourceMaps.filter(function(m) {
      return m.label === label;
    });

    if (
      candidates.length === 1 &&
      Number.isInteger(n) &&
      n >= 1 &&
      n <= candidates[0].count
    ) {
      return {
        source: prefix + candidates[0].path,
        line: n,
        column: Number(column) || 0
      };
    }
  }

  return {
    source: reported || "HTML preview",
    line: 0,
    column: 0
  };
}

    function format(value){try{if(typeof value==='string')return value;return JSON.stringify(value);}catch(e){return String(value);}}
    function emit(level,args,source,line,column){
      try{parent.postMessage({kind:'forgex-preview-log',channel:channel,level:level,text:Array.from(args).map(format).join(' ').slice(0,1800),source:source||'',line:line||0,column:column||0},'*');}
      catch(err){return;}
    }
    ['log','info','warn','error'].forEach(function(level){var original=console[level];console[level]=function(){emit(level,arguments);if(original)original.apply(console,arguments);};});
    // Explicit diagnostics for unsupported requests. Public HTTPS/WSS data
    // requests pass through; FORGEX bridge routes are handled below.
    // Never fabricate a backend response or silently forward credentials.

var previewRequests = Object.create(null);
var previewRequestId = 0;
var previewNetworkId = 0;
var sensitiveNetworkParam = /(^|[-_])(key|token|secret|auth|api[-_]?key|password)$/i;

function sanitizeNetworkUrl(raw) {
  try {
    var value = String(raw || '');
    var queryIndex = value.indexOf('?');
    if (queryIndex === -1) return value;
    var hashIndex = value.indexOf('#', queryIndex);
    var base = value.slice(0, queryIndex);
    var query = value.slice(queryIndex + 1, hashIndex === -1 ? value.length : hashIndex);
    var hash = hashIndex === -1 ? '' : value.slice(hashIndex);
    var parts = query.split('&');
    for (var i = 0; i < parts.length; i++) {
      var equals = parts[i].indexOf('=');
      if (equals === -1) continue;
      var name = parts[i].slice(0, equals);
      try { name = decodeURIComponent(name); } catch (error) { /* keep encoded name */ }
      if (sensitiveNetworkParam.test(name)) {
        parts[i] = parts[i].slice(0, equals + 1) + '***';
      }
    }
    return base + '?' + parts.join('&') + hash;
  } catch (error) {
    return String(raw || '');
  }
}

function emitNetwork(method, url, status, startedAt, via, ok, error) {
  try {
    var message = {
      kind: 'forgex-preview-network',
      channel: channel,
      id: ++previewNetworkId,
      method: String(method || 'GET').toUpperCase().slice(0, 16),
      url: sanitizeNetworkUrl(url).slice(0, 512),
      status: Number.isInteger(status) && status >= 0 ? status : 0,
      durationMs: Math.max(0, Math.round(
        ((window.performance && window.performance.now)
          ? window.performance.now()
          : Date.now()) - startedAt
      )),
      via: via === 'proxy' ? 'proxy' : 'direct',
      ok: ok === true
    };
    if (error) message.error = sanitizeNetworkUrl(String(error)).slice(0, 180);
    parent.postMessage(message, '*');
  } catch (error) {
    return;
  }
}

window.addEventListener('message', function(event) {
  if (event.source !== parent) return;

  var data = event.data;

  if (
    !data ||
    data.kind !== 'forgex-preview-response' ||
    data.channel !== channel
  ) return;

  var pending = previewRequests[data.id];
  if (!pending) return;

  delete previewRequests[data.id];
  clearTimeout(pending.timer);

  var status =
    Number.isInteger(data.status) &&
    data.status >= 200 &&
    data.status <= 599
      ? data.status
      : 502;

  pending.resolve(new Response(
    typeof data.body === 'string'
      ? data.body
      : '{"error":"Invalid response."}',
    {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    }
  ));
});

// The sandboxed iframe sends Origin: null, so APIs without CORS headers for
// that origin have their responses blocked by the browser: the fetch
// promise rejects with a TypeError carrying no status, and apps that
// swallow errors leave the console silent. Direct https calls are still
// attempted first (fast path), and blocked calls retry through the
// FORGEX server proxy, which performs a real server-to-server request
// (CORS does not apply) and returns status, contentType and body.
var originalFetch = window.fetch ? window.fetch.bind(window) : null;
var previewAppHost = ${JSON.stringify(APP_HOST).replace(/</g, "\\u003c")};
var PREVIEW_PROXY_ROUTE = '/api/preview/proxy';
var PROXYABLE_BRIDGES = ['/api/preview/ai', '/api/preview/health', '/api/preview/gateway'];

function isExternalHttpsUrl(input) {
  var raw = '';
  try {
    if (typeof input === 'string') raw = input;
    else if (input && typeof input.url === 'string') raw = input.url;
  } catch (error) {
    return false;
  }
  if (typeof raw !== 'string') return false;
  if (raw.indexOf('https://') !== 0 && raw.indexOf('wss://') !== 0) return false;
  var hostMatch = /^(?:https|wss):\\/\\/([^\\/?#]+)/i.exec(raw);
  var hostname = hostMatch ? hostMatch[1].toLowerCase() : '';
  if (!hostname) return false;
  if (previewAppHost !== '' && hostname === previewAppHost) return false;
  return true;
}

function proxyViaServer(target, method, init, resolve, reject) {
  var request = null;
  try {
    if (typeof Request !== 'undefined' && target instanceof Request) request = target;
  } catch (error) {
    request = null;
  }

  var targetUrl = request ? request.url : target;
  var initBodyProvided = !!(init && init.body !== undefined);
  var bodyText = null;

  if (initBodyProvided) {
    try {
      if (typeof init.body === 'string') {
        bodyText = init.body;
      } else if (
        typeof URLSearchParams !== 'undefined' &&
        init.body instanceof URLSearchParams
      ) {
        bodyText = init.body.toString();
      } else if (init.body !== null) {
        reject(new TypeError('This body type is not supported by the preview proxy'));
        return;
      }
    } catch (error) {
      reject(new TypeError('This body type is not supported by the preview proxy'));
      return;
    }
  }

  var headers = {};
  try {
    if (init && init.headers) {
      if (Array.isArray(init.headers)) {
        for (var i = 0; i < init.headers.length; i++) {
          var pair = init.headers[i];
          if (Array.isArray(pair) && pair.length >= 2) {
            headers[String(pair[0])] = String(pair[1]);
          }
        }
      } else if (typeof init.headers.forEach === 'function') {
        init.headers.forEach(function(value, name) { headers[name] = value; });
      } else if (typeof init.headers === 'object') {
        for (var name in init.headers) headers[name] = init.headers[name];
      }
    } else if (request) {
      request.headers.forEach(function(value, name) { headers[name] = value; });
    }
  } catch (error) {
    headers = {};
  }

  var requestMethod = String(
    (init && init.method) ||
    (request && request.method) ||
    method ||
    'GET'
  );

  function send(body) {
    originalFetch.call(window, PREVIEW_PROXY_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: targetUrl,
        method: requestMethod,
        headers: headers,
        body: body
      })
    }).then(function(proxyResponse) {
      if (!proxyResponse.ok) {
        proxyResponse.json().then(function(info) {
          reject(new TypeError((info && info.error) || 'The preview proxy could not reach the target API.'));
        }).catch(function() {
          reject(new TypeError('The preview proxy could not reach the target API.'));
        });
        return;
      }
      proxyResponse.json().then(function(envelope) {
        resolve(new Response(
          typeof envelope.body === 'string' ? envelope.body : '',
          {
            status: envelope.status || 502,
            headers: { 'Content-Type': envelope.contentType || 'text/plain' }
          }
        ));
      }).catch(function() {
        reject(new TypeError('The preview proxy returned an unreadable response.'));
      });
    }).catch(function() {
      var message = (typeof navigator !== 'undefined' && !navigator.onLine)
        ? 'You are offline. The preview proxy requires an internet connection.'
        : 'The preview proxy is unavailable.';
      reject(new TypeError(message));
    });
  }

  if (initBodyProvided) {
    send(bodyText);
    return;
  }

  if (request) {
    if (request.body === null) {
      send(null);
      return;
    }
    try {
      request.text().then(function(text) {
        send(text);
      }).catch(function() {
        reject(new TypeError('The preview proxy could not read the request body.'));
      });
    } catch (error) {
      reject(new TypeError('The preview proxy could not read the request body.'));
    }
    return;
  }

  send(bodyText);
}

window.fetch = function(input, init) {
  var isBridge =
    input === '/api/preview/ai' ||
    input === '/api/preview/health' ||
    input === '/api/preview/gateway' ||
    (
      typeof input === 'string' &&
      previewAiRoute !== '' &&
      input === previewAiRoute
    );

  if (isBridge) {
    return bridgeFetch(input, init);
  }

  var startedAt =
    window.performance && window.performance.now
      ? window.performance.now()
      : Date.now();
  var requestMethod = 'GET';
  var requestUrl = '';
  try {
    if (init && init.method) requestMethod = String(init.method);
    else if (input && typeof input === 'object' && input.method) requestMethod = String(input.method);
    if (typeof input === 'string') requestUrl = input;
    else if (input && typeof input.url === 'string') requestUrl = input.url;
  } catch (error) {
    requestUrl = '';
  }

  if (isExternalHttpsUrl(input) && originalFetch) {
    var method = requestMethod;
    var proxyInput = input;
    try {
      if (typeof Request !== 'undefined' && input instanceof Request) {
        proxyInput = input.clone();
      }
    } catch (error) {
      proxyInput = input;
    }
    return originalFetch(input, init).then(function(response) {
      emitNetwork(requestMethod, requestUrl, response.status, startedAt, 'direct', response.ok);
      return response;
    }).catch(function(directError) {
      // CORS or network block on the direct call: retry through the
      // server proxy so the app still receives the real response.
      return new Promise(function(resolve, reject) {
        proxyViaServer(
          proxyInput,
          method,
          init,
          function(response) {
            emitNetwork(requestMethod, requestUrl, response.status, startedAt, 'proxy', response.ok);
            resolve(response);
          },
          function(error) {
            emitNetwork(requestMethod, requestUrl, 0, startedAt, 'proxy', false, error && error.message);
            reject(error);
          }
        );
      });
    });
  }

  var blocked = new TypeError('Blocked: relative URLs resolve to the FORGEX origin inside this sandbox. Call your API with its full https:// address.');
  emitNetwork(requestMethod, requestUrl, 0, startedAt, 'direct', false, blocked.message);
  return Promise.reject(blocked);
};

// XHR uses the same strategy: direct https first, proxy fallback on
// failure, and a clear rejection for relative non-bridge URLs.
(function(){
  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') {
      if (isExternalHttpsUrl(url)) {
        var xhr = this;
        var requestMethod = String(method || 'GET').toUpperCase();
        var requestUrl = url;
        var startedAt =
          window.performance && window.performance.now
            ? window.performance.now()
            : Date.now();
        var finished = false;
        var finish = function(errorMessage) {
          if (finished) return;
          finished = true;
          var status = 0;
          try { status = Number(xhr.status) || 0; } catch (statusError) { status = 0; }
          emitNetwork(
            requestMethod,
            requestUrl,
            status,
            startedAt,
            'direct',
            status >= 200 && status < 300,
            status === 0 ? (errorMessage || 'Request failed') : ''
          );
        };
        this.addEventListener('loadend', function() { finish(''); });
        this.addEventListener('error', function() {
          finish('Network request failed');
          emit('warn', ['Direct request failed; the target API may not allow browser origins. Use fetch for automatic proxy fallback: ' + url], 'Preview sandbox');
        });
        return originalOpen.apply(this, arguments);
      }
      if (
        url.charAt(0) === '/' &&
        PROXYABLE_BRIDGES.indexOf(url) === -1
      ) {
        var blockedMessage = 'Blocked: relative URL "' + url + '" resolves to the FORGEX origin. Call your API with its full https:// address.';
        var blockedStartedAt =
          window.performance && window.performance.now
            ? window.performance.now()
            : Date.now();
        emitNetwork(String(method || 'GET').toUpperCase(), url, 0, blockedStartedAt, 'direct', false, blockedMessage);
        throw new Error(blockedMessage);
      }
    }
    return originalOpen.apply(this, arguments);
  };
})();

// Bridge routes keep their postMessage-based flow, unchanged from before.
function bridgeFetch(input, init) {
  var isAI = input === '/api/preview/ai';
  var isGateway = input === '/api/preview/gateway';
  var isHealth = input === '/api/preview/health';

  if (
    !init ||
    String(init.method || 'GET').toUpperCase() !== 'POST' ||
    typeof init.body !== 'string'
  ) {
    return Promise.reject(
      new TypeError('This preview request is not supported.')
    );
  }

  var payload;

  try {
    payload = JSON.parse(init.body);
  } catch (error) {
    return Promise.reject(
      new TypeError('Invalid request JSON.')
    );
  }

  if (isGateway) {
    if (
      !payload ||
      payload.provider !== 'weather' ||
      payload.action !== 'current' ||
      typeof payload.latitude !== 'number' ||
      typeof payload.longitude !== 'number' ||
      !Number.isFinite(payload.latitude) ||
      !Number.isFinite(payload.longitude) ||
      payload.latitude < -90 ||
      payload.latitude > 90 ||
      payload.longitude < -180 ||
      payload.longitude > 180
    ) {
      return Promise.reject(
        new TypeError('Invalid gateway request.')
      );
    }
  } else {
    var maxLength = isAI ? 500 : 160;

    var value = payload && (
      isAI && typeof payload.prompt === 'string'
        ? payload.prompt
        : payload.message
    );

    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.length > maxLength
    ) {
      return Promise.reject(
        new TypeError('Invalid preview request content.')
      );
    }
  }

  return new Promise(function(resolve, reject) {
    if (Object.keys(previewRequests).length >= 4) {
      reject(new Error('Too many pending preview requests.'));
      return;
    }

    var id = ++previewRequestId;

    var timer = setTimeout(function() {
      delete previewRequests[id];
      reject(new Error('Preview request timed out.'));
    }, isAI ? 75000 : isGateway ? 15000 : 9000);

    previewRequests[id] = {
      resolve: resolve,
      reject: reject,
      timer: timer
    };

    var message = {
      kind: 'forgex-preview-request',
      channel: channel,
      id: id,
      path: isAI ? '/api/preview/ai' : input
    };

    if (isGateway) {
      message.provider = 'weather';
      message.action = 'current';
      message.latitude = payload.latitude;
      message.longitude = payload.longitude;
    } else {
      message[isAI ? 'prompt' : 'message'] = value.trim();
    }

    parent.postMessage(message, '*');
  });
}

    window.addEventListener('error',function(e){
      if(e.target&&e.target!==window){
        var resource=e.target.src||e.target.href||e.target.tagName||'unknown resource';
        emit('error',['Failed to load resource:',resource],'HTML preview');
        return;
      }

      var location = locateSource(
        e.filename || "",
        e.lineno,
        e.colno
      );

      emit(
        'error',
        [e.message || 'Unknown JavaScript error'],
        location.source,
        location.line,
        location.column
      );

    },true);
    window.addEventListener('unhandledrejection',function(e){
      var reason=e.reason&&e.reason.message?e.reason.message:String(e.reason);
      emit('error',['Unhandled promise rejection:',reason],'HTML preview');
    });
    window.addEventListener('securitypolicyviolation',function(e){emit('warn',['Blocked by sandbox security policy:',e.blockedURI||e.violatedDirective],'Preview sandbox');});
    emit('info',['Preview initialized']);
  })();<\/script>`;
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${PREVIEW_SCRIPT_HOSTS}; style-src 'unsafe-inline' ${PREVIEW_STYLE_HOSTS}; img-src data: blob: https:; font-src data: https:; connect-src https: wss:; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'">`;
  const setup = csp + instrument;
  html = /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (match) => match + setup)
    : setup + html;

  const sourceMaps: Array<{
    path: string;
    label: string;
    startLine: number;
    endLine: number;
    count: number;
  }> = [];

  const marker = /<script\b[^>]*\bdata-forgex-source="([^"]+)"[^>]*>\r?\n/g;

  for (const match of html.matchAll(marker)) {
    const path = decodeURIComponent(match[1]);
    const original = contents.get(path);

    if (original === undefined) continue;

    const startLine = html
      .slice(0, (match.index ?? 0) + match[0].length)
      .split("\n").length;

    const count = original.split(/\r?\n/).length;

    sourceMaps.push({
      path,
      label: path.replace(/[^a-zA-Z0-9_./-]/g, "_"),
      startLine,
      endLine: startLine + count - 1,
      count,
    });
  }

  html = html.replace(
    "__FORGEX_SOURCE_MAPS__",
    JSON.stringify(sourceMaps).replace(/</g, "\\u003c"),
  );

  return { entry: entry.path, html };
}

export type IDEBackup = {
  format: "forgex-workspace";
  version: 1;
  savedAt: string;
  files: SourceFile[];
};

export function exportBackup(files: SourceFile[]): string {
  const backup: IDEBackup = {
    format: "forgex-workspace",
    version: 1,
    savedAt: new Date().toISOString(),
    files: validateWorkspace(files),
  };
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): SourceFile[] {
  const decoded: unknown = JSON.parse(text);
  if (
    !decoded ||
    typeof decoded !== "object" ||
    !("format" in decoded) ||
    decoded.format !== "forgex-workspace" ||
    !("version" in decoded) ||
    decoded.version !== 1 ||
    !("files" in decoded) ||
    !Array.isArray(decoded.files)
  ) {
    throw new Error("This is not a supported FORGEX workspace backup.");
  }
  return validateWorkspace(decoded.files as SourceFile[]);
}

/** General next-step guidance, not a verified runtime root cause. */
export function explainRuntimeError(message: string): string {
  if (
    /relative URL/i.test(message) &&
    /FORGEX origin/i.test(message)
  ) {
    return "Inside the sandbox, a relative URL points at FORGEX itself, which is blocked. Call your API with its full https:// address instead.";
  }
  if (
    /preview proxy could not|preview proxy is unavailable|preview proxy returned/i.test(
      message,
    )
  ) {
    return "The API did not allow a direct browser call from the sandbox, and the server proxy could not complete it either. Check the target URL, whether the API is online, and whether it needs an Authorization header.";
  }
  if (
    /is sandboxed|lacks the 'allow-same-origin'|Failed to read the '(?:local|session)Storage'/i.test(
      message,
    )
  ) {
    return "The sandbox cannot give previews a real browser storage, so FORGEX substitutes an in-memory one that lasts for this preview run. Data will not persist across preview reloads — use your own backend for anything that must survive.";
  }
  if (
    /backend\/network unavailable|Network\/API request unavailable|static preview|API.*unavailable/i.test(
      message,
    )
  ) {
    return "This static preview cannot call /api routes or arbitrary remote services. Configure the backend separately; never put API keys in browser source.";
  }
  if (/ReferenceError|is not defined/i.test(message))
    return "Check the variable or function name, its scope, and whether its script has loaded.";
  if (/SyntaxError|Unexpected token|Unexpected end/i.test(message))
    return "Inspect punctuation, brackets, and quotes near the reported line.";
  if (/TypeError|Cannot read properties|is not a function/i.test(message))
    return "Check for null/undefined values and verify the called method or object type.";
  if (/Failed to fetch|NetworkError|Content Security Policy|CSP/i.test(message))
    return "The sandbox attempts direct calls first and falls back to the FORGEX server proxy when an API does not allow browser origins. Verify the target URL and the provider's availability.";
  return "Inspect the reported source location and the full error message; reproduce before changing code.";
}

/** Generic editor guidance. Suggestions are not proof of the root cause. */
export function explainDiagnostic(message: string, language: string): string {
  if (
    /expected|missing|unterminated|end of input|unexpected token/i.test(message)
  ) {
    return `Review punctuation, quotes and closing brackets near this ${language} line.`;
  }
  if (
    /unknown property|unknown word|property.*does not exist|invalid property/i.test(
      message,
    )
  ) {
    return `Check the spelling and supported ${language} properties or declarations.`;
  }
  if (/cannot find name|is not defined|cannot find module/i.test(message)) {
    return "Check imports, variable declarations, casing and whether the file is part of this workspace.";
  }
  if (
    /type .* is not assignable|type mismatch|argument of type/i.test(message)
  ) {
    return "Compare the expected type with the supplied value and adjust the declaration or conversion.";
  }
  if (/duplicate|already declared/i.test(message))
    return "Look for duplicate identifiers or declarations in the same scope.";
  return `Review the highlighted ${language} code and the editor message. This is a diagnostic hint, not an automatic fix.`;
}
