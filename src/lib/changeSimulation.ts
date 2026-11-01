
import {
  analyzeProject,
  type Finding,
  type ProjectResult,
  type SourceFile,
} from "./analyzer";

export type ChangePreview = {
  originalLine: string;
  replacementLine: string;
  before: ProjectResult;
  after: ProjectResult;
  resolved: Finding[];
  introduced: Finding[];
  penaltyBefore: number;
  penaltyAfter: number;
};

export function rawPenalty(findings: Finding[]): number {
  return findings.reduce((total, finding) => {
    const weights = {
      critical: 22,
      high: 12,
      medium: 4,
      low: 1.5,
    };
    return total + weights[finding.severity];
  }, 0);
}

function fingerprint(f: Finding): string {
  return [f.file, f.ruleId, f.evidence].join("\u0000");
}

function difference(a: Finding[], b: Finding[]): Finding[] {
  const seen = new Map<string, number>();

  for (const f of b) {
    const key = fingerprint(f);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return a.filter(f => {
    const key = fingerprint(f);
    const remaining = seen.get(key) ?? 0;

    if (remaining > 0) {
      seen.set(key, remaining - 1);
      return false;
    }

    return true;
  });
}

export function simulateLineChange(
  files: SourceFile[],
  before: ProjectResult,
  finding: Finding,
  replacementLine: string,
  disabled: string[],
): ChangePreview {
  const file = files.find(f => f.path === finding.file);

  if (!file) {
    throw new Error("Source file is not loaded.");
  }

  if (/[\r\n]/.test(replacementLine)) {
    throw new Error(
      "This preview supports one replacement line at a time."
    );
  }

  const lines = file.content.split(/\r?\n/);
  const originalLine = lines[finding.line - 1];

  if (originalLine === undefined) {
    throw new Error(
      "The selected source line no longer exists. Re-scan."
    );
  }

  if (originalLine.trim().slice(0, 240) !== finding.evidence) {
    throw new Error(
      "The source changed since analysis. Run a new scan."
    );
  }

  if (originalLine === replacementLine) {
    throw new Error(
      "Edit the replacement line to simulate a change."
    );
  }

  if (replacementLine.length > 4000) {
    throw new Error(
      "The replacement line is too long (limit 4,000 characters)."
    );
  }

  lines[finding.line - 1] = replacementLine;

  const newline = file.content.includes("\r\n")
    ? "\r\n"
    : "\n";

  const candidate = lines.join(newline);

  if (candidate.length > 400_000) {
    throw new Error("Changed file exceeds the scan limit.");
  }

  const nextFiles = files.map(f =>
    f.path === file.path
      ? { ...f, content: candidate }
      : f
  );

  if (
    nextFiles.reduce((n, f) => n + f.content.length, 0) >
    2_000_000
  ) {
    throw new Error("Changed project exceeds the scan limit.");
  }

  const after = analyzeProject(nextFiles, disabled);

  return {
    originalLine,
    replacementLine,
    before,
    after,
    resolved: difference(before.findings, after.findings),
    introduced: difference(after.findings, before.findings),
    penaltyBefore: rawPenalty(before.findings),
    penaltyAfter: rawPenalty(after.findings),
  };
}
