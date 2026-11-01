/**
 * FORGEX Intelligence 2.0 — advisory project metrics.
 * Pure functions. No network calls, code execution, or storage.
 * Does NOT replace the original analyzer or its compatibility score.
 */
import {
  RULE_CATALOG,
  inferLanguage,
  type Finding,
  type ProjectResult,
  type SourceFile,
  type Severity,
} from "./analyzer";

type CoverageLevel = "targeted" | "generic" | "none";
type Confidence = Finding["confidence"];

export type IntelligenceHotspot = {
  path: string;
  findings: number;
  weightedImpact: number;
  score: number;
};

export type IntelligencePriority = {
  id: string;
  path: string;
  line: number;
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  suggestion: string;
};

export type IntelligenceV2 = {
  version: "2.0";
  status: "complete" | "partial" | "empty";
  score: number | null;
  securityScore: number | null;
  qualityScore: number | null;
  /** Rule applicability, NOT line/branch test coverage. */
  coverage: {
    importedFiles: number;
    processedFiles: number;
    skippedDuringAnalysis: number;
    targetedFiles: number;
    genericOnlyFiles: number;
    withoutActiveRules: number;
    targetedPercent: number;
    note: string;
  };
  summary: {
    nonEmptyLines: number;
    findings: number;
    uniqueIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  hotspots: IntelligenceHotspot[];
  priorities: IntelligencePriority[];
  methodology: string;
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 18,
  high: 9,
  medium: 3,
  low: 1,
};
const CONFIDENCE_RANK: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function countNonEmptyLines(content: string): number {
  return content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function toScore(weightedImpact: number, nonEmptyLines: number): number {
  // Smooth density penalty: unlike 100 - (sum of issue penalties),
  // repeated low-priority signals do not automatically clamp to zero.
  // Protect short snippets with a 200-line normalization floor.
  const capacity = Math.max(200, nonEmptyLines);
  return Math.max(0, Math.min(100, Math.round(100 / (1 + (weightedImpact * 10) / capacity))));
}

function deduplicate(findings: Finding[]): Finding[] {
  const used = new Set<string>();
  const output: Finding[] = [];
  for (const finding of findings) {
    // One report per rule, source file, and logical line. Multiple different
    // rules on one line remain separate; repeated regex hits do not inflate score.
    const key = `${finding.file}\u0000${finding.line}\u0000${finding.ruleId}`;
    if (used.has(key)) continue;
    used.add(key);
    output.push(finding);
  }
  return output;
}

function activeCoverage(path: string, disabled: Set<string>): CoverageLevel {
  const language = inferLanguage(path);
  const applicable = RULE_CATALOG.filter(
    (rule) => !disabled.has(rule.id) && rule.languages.includes(language),
  );
  if (!applicable.length) return "none";
  if (applicable.some((rule) => rule.id !== "GEN001")) return "targeted";
  return "generic";
}

/**
 * `sourceFiles` are the currently loaded files, not necessarily an entire repo.
 * `result` must correspond to these same source files and disabled rules.
 * `repositoryPartial` is reported by the GitHub importer when it omitted files.
 */
export function buildIntelligenceV2(
  sourceFiles: SourceFile[],
  result: ProjectResult | null,
  disabledRules: readonly string[] = [],
  repositoryPartial = false,
): IntelligenceV2 {
  const disabled = new Set(disabledRules);
  const processedPaths = new Set(result?.files.map((file) => file.path) ?? []);
  const processed = sourceFiles.filter((file) => processedPaths.has(file.path));
  const codeLines = processed.reduce((sum, file) => sum + countNonEmptyLines(file.content), 0);
  const issues = deduplicate(result?.findings ?? []);
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const impacts = new Map<string, number>();
  let overall = 0;
  let security = 0;
  let quality = 0;

  for (const issue of issues) {
    counts[issue.severity]++;
    const weight = SEVERITY_WEIGHT[issue.severity];
    overall += weight;
    impacts.set(issue.file, (impacts.get(issue.file) ?? 0) + weight);
    if (issue.category === "security") security += weight;
    else quality += weight; // Quality, maintainability and dependency signals.
  }

  const activeCoverageLevels = processed.map((file) => activeCoverage(file.path, disabled));
  const targetedFiles = activeCoverageLevels.filter((level) => level === "targeted").length;
  const genericOnlyFiles = activeCoverageLevels.filter((level) => level === "generic").length;
  const withoutActiveRules = activeCoverageLevels.filter((level) => level === "none").length;
  const applicableCategoryFiles = (category: "security" | "quality") =>
    processed.filter((file) => RULE_CATALOG.some((rule) =>
      !disabled.has(rule.id) && rule.languages.includes(inferLanguage(file.path)) &&
      (category === "security" ? rule.category === "security" : rule.category !== "security"),
    )).length;
  const securityEligible = applicableCategoryFiles("security") > 0;
  const qualityEligible = applicableCategoryFiles("quality") > 0;
  const skipped = result?.skippedFiles ?? sourceFiles.length;
  const isPartial = repositoryPartial || skipped > 0 || processed.length !== sourceFiles.length;
  const hasScanned = !!result && processed.length > 0;
  const hasActiveChecks = !!result && result.checks > 0;
  const canScore = hasScanned && hasActiveChecks && targetedFiles > 0;

  const hotspots = processed
    .map((file) => {
      const items = issues.filter((finding) => finding.file === file.path);
      const nonEmptyLines = countNonEmptyLines(file.content);
      const impact = impacts.get(file.path) ?? 0;
      return {
        path: file.path,
        findings: items.length,
        weightedImpact: impact,
        score: toScore(impact, nonEmptyLines),
      };
    })
    .filter((entry) => entry.findings > 0)
    .sort((a, b) => a.score - b.score || b.weightedImpact - a.weightedImpact)
    .slice(0, 8);

  const priorities = [...issues]
    .sort((a, b) =>
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
      CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] ||
      a.file.localeCompare(b.file) || a.line - b.line,
    )
    .slice(0, 8)
    .map((finding) => ({
      id: finding.id,
      path: finding.file,
      line: finding.line,
      ruleId: finding.ruleId,
      title: finding.title,
      severity: finding.severity,
      confidence: finding.confidence,
      suggestion: finding.fix,
    }));

  return {
    version: "2.0",
    status: !hasScanned ? "empty" : isPartial || withoutActiveRules > 0 ? "partial" : "complete",
    score: canScore ? toScore(overall, codeLines) : null,
    securityScore: canScore && securityEligible ? toScore(security, codeLines) : null,
    qualityScore: canScore && qualityEligible ? toScore(quality, codeLines) : null,
    coverage: {
      importedFiles: sourceFiles.length,
      processedFiles: processed.length,
      skippedDuringAnalysis: skipped,
      targetedFiles,
      genericOnlyFiles,
      withoutActiveRules,
      targetedPercent: processed.length ? Math.round((targetedFiles / processed.length) * 100) : 0,
      note: "Coverage measures active heuristic-rule applicability to processed files. It does not measure test execution, exploitable vulnerabilities, or scan completeness of a remote repository.",
    },
    summary: {
      nonEmptyLines: codeLines,
      findings: result?.findings.length ?? 0,
      uniqueIssues: issues.length,
      ...counts,
    },
    hotspots,
    priorities,
    methodology: "Advisory signals only. Scores use severity weights (critical 18, high 9, medium 3, low 1) per unique rule/file/line, normalized against at least 200 nonempty lines using score = round(100 / (1 + weightedImpact*10/max(200, lines))). Scores do not prove code safety or production readiness.",
  };
}
