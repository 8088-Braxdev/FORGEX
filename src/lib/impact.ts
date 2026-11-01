
import type { SourceFile } from "./analyzer";

export type ImportEdge = {
  from: string;
  to: string;
  specifier: string;
};

export type UnresolvedImport = {
  from: string;
  specifier: string;
};

export type ImpactNode = {
  path: string;
  depth: number;
};

export type ImpactGraph = {
  files: string[];
  edges: ImportEdge[];
  unresolved: UnresolvedImport[];
  importsOf: (file: string) => string[];
  importedBy: (file: string) => string[];
  affectedBy: (file: string) => ImpactNode[];
};

const EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx",
  ".mjs", ".cjs", ".json", ".css"
];

function normalize(path: string): string {
  const segments: string[] = [];

  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;

    if (part === "..") segments.pop();
    else segments.push(part);
  }

  return segments.join("/");
}

function importsIn(code: string): string[] {
  const withoutComments = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|\s)\/\/[^\r\n]*/gm, "$1");

  const imports = new Set<string>();

  for (const line of withoutComments.split(/\r?\n/)) {
    const rx =
      /(?:\bimport\s*(?:[^'";]*?\s+from\s*)?|\bexport\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"\r\n]+)['"]/g;

    for (const match of line.matchAll(rx)) {
      imports.add(match[1]);
    }
  }

  return [...imports];
}

function resolve(
  from: string,
  specifier: string,
  paths: Set<string>
): string | null {
  let base: string;

  if (specifier.startsWith("@/")) {
    base = normalize("src/" + specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    const folder = from.split("/").slice(0, -1).join("/");
    base = normalize(folder + "/" + specifier);
  } else {
    return null;
  }

  const guesses = [
    base,
    ...EXTENSIONS.map(ext => base + ext),
    ...EXTENSIONS.map(ext => base + "/index" + ext)
  ];

  return guesses.find(path => paths.has(path)) ?? null;
}

export function buildImpactGraph(
  source: SourceFile[]
): ImpactGraph {
  const content = new Map<string, string>();

  for (const file of source) {
    if (
      typeof file.path === "string" &&
      typeof file.content === "string"
    ) {
      content.set(normalize(file.path), file.content);
    }
  }

  const files = [...content.keys()].sort();
  const paths = new Set(files);

  const forward = new Map(
    files.map(file => [file, new Set<string>()])
  );

  const reverse = new Map(
    files.map(file => [file, new Set<string>()])
  );

  const edges: ImportEdge[] = [];
  const unresolved: UnresolvedImport[] = [];

  for (const from of files) {
    for (const specifier of importsIn(content.get(from)!)) {
      if (
        !specifier.startsWith(".") &&
        !specifier.startsWith("@/")
      ) continue;

      const to = resolve(from, specifier, paths);

      if (!to) {
        unresolved.push({ from, specifier });
      } else if (!forward.get(from)!.has(to)) {
        forward.get(from)!.add(to);
        reverse.get(to)!.add(from);

        edges.push({ from, to, specifier });
      }
    }
  }

  const sorted = (items?: Set<string>) =>
    [...(items ?? [])].sort();

  return {
    files,
    edges,
    unresolved,

    importsOf: file =>
      sorted(forward.get(normalize(file))),

    importedBy: file =>
      sorted(reverse.get(normalize(file))),

    affectedBy(file) {
      const target = normalize(file);
      const seen = new Set([target]);

      const queue: ImpactNode[] = [
        { path: target, depth: 0 }
      ];

      const affected: ImpactNode[] = [];

      for (let i = 0; i < queue.length; i++) {
        const current = queue[i];

        for (const parent of sorted(reverse.get(current.path))) {
          if (seen.has(parent)) continue;

          seen.add(parent);

          const next = {
            path: parent,
            depth: current.depth + 1
          };

          affected.push(next);
          queue.push(next);
        }
      }

      return affected;
    }
  };
}
