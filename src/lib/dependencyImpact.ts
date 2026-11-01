
import type { SourceFile } from "./analyzer";

type LinkKind =
  | "import"
  | "require"
  | "dynamic-import"
  | "html-reference"
  | "css-import";

type Edge = {
  from: string;
  to: string;
  line: number;
  kind: LinkKind;
  source: "current" | "baseline";
};

export type ImpactedFile = {
  path: string;
  depth: number;
  via: string;
  line: number;
  kind: LinkKind;
  source: "current" | "baseline";
};

export type DependencyImpact = {
  changedFiles: string[];
  direct: ImpactedFile[];
  indirect: ImpactedFile[];
  unresolved: number;
  scannedFiles: number;
  notes: string[];
};

const candidates = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".html",
  ".htm",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
  "/index.css",
];
function isLocalReference(
  raw: string,
  allowRoot: boolean
): boolean {
  const specifier = raw.split(/[?#]/, 1)[0];

  if (
    !specifier ||
    specifier.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(specifier)
  ) {
    return false;
  }

  return allowRoot || /^\.\.?\//.test(specifier);
}
function resolveLocal(
  from: string,
  raw: string,
  paths: Set<string>,
  allowRoot: boolean
): string | null {
    const specifier = raw.split(/[?#]/, 1)[0];
  const root = allowRoot && specifier.startsWith("/");

  if (!isLocalReference(raw, allowRoot)) {
    return null;
  }

  const segments = root
    ? []
    : from.split("/").slice(0, -1);

  for (const part of specifier.split("/")) {
    if (!part || part === ".") continue;

    if (part === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }

  const path = segments.join("/");

  for (const extension of candidates) {
    const candidate = path + extension;

    if (paths.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extract(file: SourceFile) {
  const entries: Array<{
    specifier: string;
    index: number;
    kind: LinkKind;
    allowRoot: boolean;
  }> = [];

  const add = (
    pattern: RegExp,
    kind: LinkKind,
    allowRoot = false
  ) => {
    for (const match of file.content.matchAll(pattern)) {
      entries.push({
        specifier: match[1],
        index: match.index,
        kind,
        allowRoot,
      });
    }
  };

  if (/\.(?:js|jsx|mjs|cjs|ts|tsx)$/i.test(file.path)) {
    add(
      /\b(?:import|export)\s+(?:[^"'`;]*?\bfrom\s+)?["']([^"'\r\n]+)["']/g,
      "import"
    );

    add(
      /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
      "require"
    );

    add(
      /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
      "dynamic-import"
    );
  } else if (/\.(?:css|scss)$/i.test(file.path)) {
    add(
      /@import\s+(?:url\(\s*)?["']([^"']+)["']/g,
      "css-import",
      true
    );
  } else if (/\.(?:html|htm)$/i.test(file.path)) {
    add(
      /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
      "html-reference",
      true
    );

    add(
      /<link\b(?=[^>]*\brel\s*=\s*["']stylesheet["'])[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
      "html-reference",
      true
    );
  }

  return entries;
}

export function buildDependencyImpact(
  baseline: readonly SourceFile[],
  current: readonly SourceFile[]
): DependencyImpact {
  const allFiles = [...baseline, ...current];

  if (
    baseline.length > 120 ||
    current.length > 120 ||
    allFiles.some((f) => f.content.length > 400_000) ||
    allFiles.reduce(
      (sum, f) => sum + f.content.length,
      0
    ) > 4_000_000
  ) {
    throw new Error(
      "Dependency review limit: 120 files per snapshot, " +
      "400 KB per file."
    );
  }

  const old = new Map(
    baseline.map((f) => [f.path, f.content])
  );

  const now = new Map(
    current.map((f) => [f.path, f.content])
  );

  const changedFiles = [
    ...new Set([...old.keys(), ...now.keys()]),
  ]
    .filter((path) => old.get(path) !== now.get(path))
    .sort();
  const snapshotPaths = {
    current: new Set(now.keys()),
    baseline: new Set(old.keys()),
  };

  const surviving = snapshotPaths.current;




  const edgeMap = new Map<string, Edge>();

  let unresolved = 0;

  for (const [source, files] of [
    ["current", current],
    ["baseline", baseline],
  ] as const) {
    for (const file of files) {
      for (const item of extract(file)) {
        if (
          !isLocalReference(
            item.specifier,
            item.allowRoot
          )
        ) {
          continue;
        }

        const target = resolveLocal(
          file.path,
          item.specifier,
          snapshotPaths[source],
          item.allowRoot
        );

        if (!target) {
          if (source === "current") {
            unresolved++;
          }

          continue;
        }

        const key = [
          file.path,
          target,
          item.kind,
        ].join("\u0000");

        if (!edgeMap.has(key)) {
          edgeMap.set(key, {
            from: file.path,
            to: target,
            line: file.content
              .slice(0, item.index)
              .split("\n").length,
            kind: item.kind,
            source,
          });
        }
      }
    }
  }

  const reverse = new Map<string, Edge[]>();

  for (const edge of edgeMap.values()) {
    if (!surviving.has(edge.from)) continue;

    const incoming = reverse.get(edge.to) ?? [];

    incoming.push(edge);
    reverse.set(edge.to, incoming);
  }

  const queue = changedFiles.map((path) => ({
    path,
    depth: 0,
  }));

  const visited = new Set(changedFiles);
  const affected: ImpactedFile[] = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];

    for (const edge of reverse.get(item.path) ?? []) {
      if (visited.has(edge.from)) continue;

      visited.add(edge.from);

      const depth = item.depth + 1;

      queue.push({
        path: edge.from,
        depth,
      });

      affected.push({
        path: edge.from,
        depth,
        via: item.path,
        line: edge.line,
        kind: edge.kind,
        source: edge.source,
      });
    }
  }

  affected.sort(
    (a, b) =>
      a.depth - b.depth ||
      a.path.localeCompare(b.path)
  );

  return {
    changedFiles,

    direct: affected.filter(
      (item) => item.depth === 1
    ),

    indirect: affected.filter(
      (item) => item.depth > 1
    ),

    unresolved,

    scannedFiles: surviving.size,

    notes: [
      "Static references only. Runtime behavior and " +
        "variable-based dynamic imports were not verified.",

      "Import aliases, Python dependencies, build tooling " +
        "and external packages are outside this graph.",

      "Baseline-only references may no longer exist " +
        "in current code.",
            "Reference matching is heuristic and may include comments or strings.",  
    ],
  };
}
