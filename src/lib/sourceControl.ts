import type { SourceFile } from "./analyzer";

export type FileChangeStatus = "added" | "modified" | "deleted";
export type DiffLineKind = "context" | "add" | "remove" | "skip";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
  oldLine?: number;
  newLine?: number;
};

export type FileChange = {
  path: string;
  status: FileChangeStatus;
  additions: number | null;
  deletions: number | null;
  diff: DiffLine[];
  limited: boolean;
};

export type SourceControlReport = {
  changes: FileChange[];
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
  limited: number;
};

const MAX_CELLS = 500_000;
const MAX_RENDERED_LINES = 220;
const CONTEXT = 3;

function sourceLines(content: string): string[] {
  if (content === "") return [];
  // Keep trailing lines: a missing/final newline must not be silently ignored.
  return content.replace(/\r\n/g, "\n").split("\n");
}

function keepContext(operations: DiffLine[]): {
  lines: DiffLine[];
  limited: boolean;
} {
  const visible = new Set<number>();
  for (let i = 0; i < operations.length; i++) {
    if (operations[i].kind === "context") continue;
    for (let j = Math.max(0, i - CONTEXT); j <= Math.min(operations.length - 1, i + CONTEXT); j++) {
      visible.add(j);
    }
  }

  const result: DiffLine[] = [];
  let skipped = false;
  for (let i = 0; i < operations.length; i++) {
    if (!visible.has(i)) {
      if (!skipped) result.push({ kind: "skip", text: "Unchanged lines omitted" });
      skipped = true;
      continue;
    }
    skipped = false;
    result.push(operations[i]);
    if (result.length >= MAX_RENDERED_LINES) {
      result.push({ kind: "skip", text: "Diff preview truncated" });
      return { lines: result, limited: true };
    }
  }
  return { lines: result, limited: false };
}

function compareLines(before: string, after: string): {
  additions: number | null;
  deletions: number | null;
  diff: DiffLine[];
  limited: boolean;
} {
  if (before !== after && before.replace(/\r\n/g, "\n") === after.replace(/\r\n/g, "\n")) {
    return {
      additions: 0,
      deletions: 0,
      diff: [{ kind: "skip", text: "Line endings changed (CRLF / LF)." }],
      limited: false,
    };
  }
  const oldLines = sourceLines(before);
  const newLines = sourceLines(after);
  const n = oldLines.length;
  const m = newLines.length;

  // Never pretend a coarse block is an exact line diff on very large files.
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    return {
      additions: null,
      deletions: null,
      diff: [{ kind: "skip", text: "File changed; exact line diff exceeds preview limit." }],
      limited: true,
    };
  }

  // Bounded LCS: exact line-level changes, no guessed hunks.
  const table = new Uint32Array((n + 1) * (m + 1));
  const stride = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const index = i * stride + j;
      table[index] = oldLines[i] === newLines[j]
        ? 1 + table[(i + 1) * stride + j + 1]
        : Math.max(table[(i + 1) * stride + j], table[index + 1]);
    }
  }

  const operations: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let additions = 0;
  let deletions = 0;
  while (i < n || j < m) {
    if (i < n && j < m && oldLines[i] === newLines[j]) {
      operations.push({ kind: "context", text: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (j < m && (i === n || table[i * stride + j + 1] >= table[(i + 1) * stride + j])) {
      operations.push({ kind: "add", text: newLines[j], newLine: j + 1 });
      j++;
      additions++;
    } else {
      operations.push({ kind: "remove", text: oldLines[i], oldLine: i + 1 });
      i++;
      deletions++;
    }
  }

  const preview = keepContext(operations);
  return { additions, deletions, diff: preview.lines, limited: preview.limited };
}

export function compareWorkspace(
  baseline: readonly SourceFile[],
  working: readonly SourceFile[],
): SourceControlReport {
  const before = new Map(baseline.map((file) => [file.path, file.content]));
  const after = new Map(working.map((file) => [file.path, file.content]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a.localeCompare(b));
  const changes: FileChange[] = [];
  let unchanged = 0;

  for (const path of paths) {
    const had = before.has(path);
    const has = after.has(path);
    if (had && has && before.get(path) === after.get(path)) {
      unchanged++;
      continue;
    }
    const status: FileChangeStatus = !had ? "added" : !has ? "deleted" : "modified";
    const result = compareLines(before.get(path) ?? "", after.get(path) ?? "");
    if (status !== "modified" && result.diff.length === 0) {
      result.diff.push({ kind: "skip", text: "Empty file" });
    }
    changes.push({ path, status, ...result });
  }
  const count = (status: FileChangeStatus) => changes.filter((item) => item.status === status).length;
  return {
    changes,
    added: count("added"),
    modified: count("modified"),
    deleted: count("deleted"),
    unchanged,
    limited: changes.filter((change) => change.limited).length,
  };
}
