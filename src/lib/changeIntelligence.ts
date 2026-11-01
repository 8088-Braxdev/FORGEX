
import {
  analyzeProject,
  type Finding,
  type SourceFile,
} from "./analyzer";

import { buildIntelligenceV2 } from "./intelligence";
import { compareWorkspace } from "./sourceControl";
import {
  buildDependencyImpact,
  type DependencyImpact,
} from "./dependencyImpact";
export type ChangeReview = {
  status: "ready" | "partial";
  changedFiles: number;
  oldScore: number | null;
  newScore: number | null;
  introduced: Finding[];
  resolved: Finding[];
  removedWithFiles: Finding[];
  unchanged: number;
  notes: string[];
    dependencyImpact: DependencyImpact;
};

const rank: Record<Finding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function fingerprint(finding: Finding): string {
  return [
    finding.file,
    finding.ruleId,
    finding.evidence.trim().replace(/\s+/g, " "),
  ].join("\u0000");
}

function uniqueOnLine(findings: Finding[]): Finding[] {
  const used = new Set<string>();

  return findings.filter((finding) => {
    const key = [
      finding.file,
      finding.line,
      finding.ruleId,
    ].join("\u0000");

    if (used.has(key)) return false;

    used.add(key);
    return true;
  });
}

export function buildChangeIntelligence(
  baselineFiles: readonly SourceFile[],
  currentFiles: readonly SourceFile[],
  disabledRules: readonly string[] = [],
  repositoryPartial = false
): ChangeReview {
  if (
    baselineFiles.length > 120 ||
    currentFiles.length > 120 ||
    baselineFiles.some((f) => f.content.length > 400000) ||
    currentFiles.some((f) => f.content.length > 400000) ||
    baselineFiles.reduce(
      (n, f) => n + f.content.length, 0
    ) > 2000000 ||
    currentFiles.reduce(
      (n, f) => n + f.content.length, 0
    ) > 2000000
  ) {
    throw new Error(
      "Impact review limit exceeded: 120 files, " +
      "400 KB per file, 2 million characters per snapshot."
    );
  }
  const dependencyImpact = buildDependencyImpact(
    baselineFiles,
    currentFiles
  );
  const before = analyzeProject(
    [...baselineFiles],
    [...disabledRules]
  );

  const after = analyzeProject(
    [...currentFiles],
    [...disabledRules]
  );

  const beforeMetrics = buildIntelligenceV2(
    [...baselineFiles],
    before,
    disabledRules,
    repositoryPartial
  );

  const afterMetrics = buildIntelligenceV2(
    [...currentFiles],
    after,
    disabledRules,
    repositoryPartial
  );

  const sourceChanges = compareWorkspace(
    baselineFiles,
    currentFiles
  );

  const currentPaths = new Set(
    currentFiles.map((file) => file.path)
  );

  const previous = new Map<string, Finding[]>();

  for (const finding of uniqueOnLine(before.findings)) {
    const key = fingerprint(finding);
    const bucket = previous.get(key) ?? [];

    bucket.push(finding);
    previous.set(key, bucket);
  }

  const introduced: Finding[] = [];
  let unchanged = 0;

  for (const finding of uniqueOnLine(after.findings)) {
    const key = fingerprint(finding);
    const bucket = previous.get(key);

    if (bucket?.length) {
      bucket.pop();
      unchanged++;
    } else {
      introduced.push(finding);
    }
  }

  const resolved: Finding[] = [];
  const removedWithFiles: Finding[] = [];

  for (const bucket of previous.values()) {
    for (const finding of bucket) {
      if (currentPaths.has(finding.file)) {
        resolved.push(finding);
      } else {
        removedWithFiles.push(finding);
      }
    }
  }

  const sort = (a: Finding, b: Finding) =>
    rank[b.severity] - rank[a.severity] ||
    a.file.localeCompare(b.file) ||
    a.line - b.line;

  introduced.sort(sort);
  resolved.sort(sort);
  removedWithFiles.sort(sort);

  const notes: string[] = [];

  if (repositoryPartial) {
    notes.push(
      "Repository import was partial. " +
      "Only loaded files were compared."
    );
  }

  if (before.skippedFiles || after.skippedFiles) {
    notes.push(
      "Some files were skipped by the analyzer."
    );
  }

  if (!baselineFiles.length) {
    notes.push(
      "No captured baseline files are available."
    );
  }

  if (
    beforeMetrics.score === null ||
    afterMetrics.score === null
  ) {
    notes.push(
      "One or both advisory scores are unavailable."
    );
  }
  if (disabledRules.length > 0) {
    notes.push(
      `${disabledRules.length} rule(s) are disabled. ` +
      "Those checks were excluded from this comparison."
    );
  }

  if (dependencyImpact.unresolved > 0) {
    notes.push(
      `${dependencyImpact.unresolved} current local reference(s) ` +
      "could not be resolved among loaded files."
    );
  }
  notes.push(
    "Findings are heuristic, not proof of vulnerabilities. " +
    "Tests were not executed. Comparison uses the local " +
    "snapshot, not a GitHub commit."
  );

  return {
    status:
      repositoryPartial ||
      before.skippedFiles > 0 ||
      after.skippedFiles > 0 ||
      !baselineFiles.length ||
      disabledRules.length > 0 ||
      dependencyImpact.unresolved > 0 ||
      beforeMetrics.score === null ||
      afterMetrics.score === null
        ? "partial"
        : "ready",

    dependencyImpact,
    changedFiles: sourceChanges.changes.length,
    oldScore: beforeMetrics.score,
    newScore: afterMetrics.score,
    introduced,
    resolved,
    removedWithFiles,
    unchanged,
    notes,
  };
}
