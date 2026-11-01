
"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Search,
  ShieldAlert
} from "lucide-react";

import type {
  Finding,
  ProjectResult,
  Severity,
  SourceFile
} from "../lib/analyzer";

import { buildImpactGraph } from "../lib/impact";

type Props = {
  files: SourceFile[];
  result: ProjectResult;
  onOpenSource: (finding: Finding) => void;
};

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export default function TraceInspector({
  files,
  result,
  onOpenSource
}: Props) {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] =
    useState<"all" | Severity>("all");
  const [requestedId, setRequestedId] = useState("");

  const graph = useMemo(
    () => buildImpactGraph(files),
    [files]
  );

  const ranked = useMemo(
    () => [...result.findings].sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        a.file.localeCompare(b.file) ||
        a.line - b.line
    ),
    [result.findings]
  );

  const filtered = ranked.filter(f =>
    (severity === "all" || f.severity === severity) &&
    `${f.file} ${f.title} ${f.ruleId} ${f.detail}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const finding =
    filtered.find(f => f.id === requestedId) ?? filtered[0];

  const source = files.find(
    f => f.path === finding?.file
  );

  const lines = source?.content.split(/\r?\n/) ?? [];

  const start = finding
    ? Math.max(1, finding.line - 3)
    : 1;

  const end = finding
    ? Math.min(lines.length, finding.line + 3)
    : 0;

  const affected =
    finding && graph.files.includes(finding.file)
      ? graph.affectedBy(finding.file)
      : [];

  const neighbors = finding
    ? result.findings.filter(
        f => f.file === finding.file && f.id !== finding.id
      ).length
    : 0;

  const counts = {
    critical: ranked.filter(f => f.severity === "critical").length,
    high: ranked.filter(f => f.severity === "high").length,
    medium: ranked.filter(f => f.severity === "medium").length,
    low: ranked.filter(f => f.severity === "low").length
  };

  return (
    <section
      className="fxtrace"
      aria-label="FORGEX Source Trace"
    >
      <header className="fxtrace-header">
        <div>
          <div className="fxtrace-kicker">
            <GitBranch size={14} />
            DIAGNOSTIC INTELLIGENCE / TRACE
          </div>

          <h2>From signal to source.</h2>
          <p>
            Investigate a finding, read its surrounding
            code, and identify the next action.
          </p>
        </div>

        <div className="fxtrace-score">
          <strong>{result.score}</strong>
          <span>/100 · heuristic</span>
        </div>
      </header>

      <div
        className="fxtrace-overview"
        aria-label="Severity breakdown"
      >
        {(["critical", "high", "medium", "low"] as const)
          .map(level => (
            <button
              key={level}
              type="button"
              className={`fxtrace-counter ${
                severity === level ? "active" : ""
              }`}
              onClick={() => {
                setSeverity(
                  severity === level ? "all" : level
                );
                setRequestedId("");
              }}
            >
              <span>{level}</span>
              <strong>{counts[level]}</strong>
            </button>
          ))}
      </div>

      <p className="fxtrace-note">
        Score = 100 minus capped severity penalties
        (critical 22, high 12, medium 4, low 1.5 each).
        This is not proof of code safety.
      </p>

      {ranked.length === 0 ? (
        <div className="fxtrace-empty">
          <CheckCircle2 size={20} />
          No active rule findings in this scan.
          A clean scan cannot guarantee safety.
        </div>
      ) : (
        <div className="fxtrace-grid">
          <aside
            className="fxtrace-list"
            aria-label="Findings"
          >
            <label className="fxtrace-search">
              <Search size={15} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find rule, file or issue…"
              />
            </label>

            {filtered.length === 0 ? (
              <p className="fxtrace-note">
                No findings match these filters.
              </p>
            ) : (
              filtered.slice(0, 150).map(f => (
                <button
                  type="button"
                  key={f.id}
                  className={`fxtrace-item ${
                    finding?.id === f.id ? "active" : ""
                  }`}
                  onClick={() => setRequestedId(f.id)}
                >
                  <span
                    className={`fxtrace-level ${f.severity}`}
                  >
                    {f.severity} · {f.ruleId}
                  </span>

                  <strong>{f.title}</strong>
                  <small>{f.file}:{f.line}</small>
                </button>
              ))
            )}

            {filtered.length > 150 && (
              <p className="fxtrace-note">
                Showing first 150 matching findings.
              </p>
            )}
          </aside>

          <div className="fxtrace-detail">
            {finding && (
              <>
                <div className="fxtrace-detail-head">
                  <div>
                    <span
                      className={`fxtrace-level ${finding.severity}`}
                    >
                      <ShieldAlert size={13} />
                      {finding.severity.toUpperCase()}
                      {" · "}
                      {finding.category}
                    </span>

                    <h3>{finding.title}</h3>
                    <p>
                      {finding.file}:{finding.line}:{finding.column}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="fxtrace-open"
                    onClick={() => onOpenSource(finding)}
                  >
                    <FileCode2 size={15} />
                    Open file
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                <div
                  className="fxtrace-code"
                  aria-label="Source code surrounding the finding"
                >
                  {source ? (
                    lines.slice(start - 1, end).map(
                      (text, i) => {
                        const number = start + i;

                        return (
                          <div
                            key={number}
                            className={`fxtrace-line ${
                              number === finding.line
                                ? "flagged"
                                : ""
                            }`}
                          >
                            <span>{number}</span>
                            <code>{text || " "}</code>
                          </div>
                        );
                      }
                    )
                  ) : (
                    <p>
                      Source not loaded. Import the original
                      file to inspect its context.
                    </p>
                  )}
                </div>

                <div className="fxtrace-advice">
                  <div>
                    <strong>
                      <AlertTriangle size={15} />
                      Why flagged
                    </strong>
                    <p>{finding.detail}</p>
                  </div>

                  <div>
                    <strong>Possible impact</strong>
                    <p>{finding.impact}</p>
                  </div>

                  <div>
                    <strong>Suggested action</strong>
                    <p>{finding.fix}</p>
                  </div>

                  <div className="fxtrace-confidence">
                    Detection confidence: {finding.confidence}
                    {" · "}
                    {neighbors} other findings in this file
                  </div>
                </div>

                {finding.replacement !== undefined && source && (
                  <div className="fxtrace-patch">
                    <strong>
                      Suggested line edit — review before applying
                    </strong>

                    <pre>
                      - {lines[finding.line - 1] ?? ""}
                    </pre>

                    <pre>
                      + {finding.replacement ||
                        "(remove matched statement)"}
                    </pre>

                    <p>
                      This is a proposed edit, not an automatic
                      fix. Validate behavior and tests.
                    </p>
                  </div>
                )}

                <div className="fxtrace-impact">
                  <strong>
                    <GitBranch size={15} />
                    Possible downstream impact
                    {" · "}
                    {affected.length} files
                  </strong>

                  {affected.length === 0 ? (
                    <p>
                      No local importers were detected
                      in the loaded files.
                    </p>
                  ) : (
                    affected.slice(0, 8).map(node => (
                      <span key={node.path}>
                        {node.path} · depth {node.depth}
                      </span>
                    ))
                  )}

                  {affected.length > 8 && (
                    <p>
                      Plus {affected.length - 8} more files.
                    </p>
                  )}

                  <small>
                    Based on static imports, not runtime execution.
                    Partial scans can miss dependencies.
                  </small>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
