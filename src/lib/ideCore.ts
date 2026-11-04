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
      content: `body { background: #101820; color: #e9f4f0; font-family: system-ui, sans-serif; padding: 2rem; }
main { max-width: 560px; margin: auto; }
h1 { color: #b9fa77; }
button { background: #b9fa77; border: 0; border-radius: 8px; padding: 12px 20px; cursor: pointer; font-weight: 600; }
button.secondary { background: #1c2b33; color: #d8e6df; border: 1px solid #3d5a49; margin-left: 8px; }
#advice { min-height: 1.5em; color: #9fd8a8; }
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
 * Explicit allowlist of public CDNs that imported projects may load scripts,
 * styles, fonts and images from inside the sandboxed preview. Everything
 * else in those categories stays blocked, keeping the injection surface small.
 *
 * Data requests are deliberately broader: an imported project may call any
 * public HTTPS/WSS API from the browser, exactly like a deployed website.
 * The sandbox keeps an opaque origin, no FORGEX credentials are attached,
 * and the preview fetch override additionally blocks requests aimed at the
 * FORGEX origin itself. Target APIs still enforce their own CORS policy and
 * no server-side proxy is involved.
 */
const PREVIEW_SCRIPT_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://esm.sh";
const PREVIEW_STYLE_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com https://fonts.googleapis.com";
const PREVIEW_FONT_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://fonts.gstatic.com https://fonts.googleapis.com";
const PREVIEW_IMAGE_HOSTS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com";

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

  const instrument = `<script>(function(){
    var channel=${safeChannel};
    var previewAiRoute=${safeAiRoute};
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

// Outbound data requests pass through to the browser network stack so an
// imported project can call its own APIs and render real responses.
// Only HTTPS/WSS is permitted, and requests aimed at the FORGEX origin
// itself always fail. FORGEX bridge routes are handled separately below.
var originalFetch = window.fetch ? window.fetch.bind(window) : null;
var previewAppHost = ${JSON.stringify(APP_HOST).replace(/</g, "\\u003c")};

function isPreviewExternalUrl(input) {
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

  // An imported project must never call the FORGEX origin itself.
  if (previewAppHost !== '' && hostname === previewAppHost) return false;

  return true;
}

window.fetch = function(input, init) {
  if (isPreviewExternalUrl(input) && originalFetch) {
    return originalFetch(input, init);
  }

  var isAI =
    input === '/api/preview/ai' ||
    (
      typeof input === 'string' &&
      previewAiRoute !== '' &&
      input === previewAiRoute
    );

  var isHealth = input === '/api/preview/health';
  var isGateway = input === '/api/preview/gateway';

  if (
    (!isAI && !isHealth && !isGateway) ||
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
};

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
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${PREVIEW_SCRIPT_HOSTS}; style-src 'unsafe-inline' ${PREVIEW_STYLE_HOSTS}; img-src data: blob: ${PREVIEW_IMAGE_HOSTS}; font-src data: ${PREVIEW_FONT_HOSTS}; connect-src https: wss:; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'">`;
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
    return "The sandbox allows outbound HTTPS/WSS data requests. This failure usually means the target API blocked the request by CORS or the network dropped it; verify the URL and the provider's CORS policy.";
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
