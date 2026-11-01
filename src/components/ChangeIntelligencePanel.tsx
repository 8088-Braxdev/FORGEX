
"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  SourceFile,
  Finding,
} from "../lib/analyzer";

import {
  buildChangeIntelligence,
  type ChangeReview,
} from "../lib/changeIntelligence";
import DependencyImpactPanel from "./DependencyImpactPanel";
type Props = {
  baselineFiles: readonly SourceFile[];
  currentFiles: readonly SourceFile[];
  disabledRules: readonly string[];
  repositoryPartial?: boolean;
  onOpenSource: (path: string, line?: number) => void;
};

export default function ChangeIntelligencePanel({
  baselineFiles,
  currentFiles,
  disabledRules,
  repositoryPartial = false,
  onOpenSource,
}: Props) {
  const changedFiles = useMemo(() => {
    const before = new Map(
      baselineFiles.map((f) => [f.path, f.content])
    );

    const after = new Map(
      currentFiles.map((f) => [f.path, f.content])
    );

    return [
      ...new Set([
        ...before.keys(),
        ...after.keys(),
      ]),
    ].filter(
      (path) => before.get(path) !== after.get(path)
    ).length;
  }, [baselineFiles, currentFiles]);

  const [report, setReport] =
    useState<ChangeReview | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    setReport(null);
    setError("");
  }, [
    baselineFiles,
    currentFiles,
    disabledRules,
    repositoryPartial,
  ]);

  if (!baselineFiles.length || changedFiles === 0) {
    return null;
  }

  function runReview() {
    setError("");

    try {
      const next = buildChangeIntelligence(
        baselineFiles,
        currentFiles,
        disabledRules,
        repositoryPartial
      );

      setReport(next);
    } catch (cause) {
      setReport(null);

      setError(
        cause instanceof Error
          ? cause.message
          : "Impact review failed."
      );
    }
  }

  function Findings({
    title,
    items,
    deleted = false,
  }: {
    title: string;
    items: Finding[];
    deleted?: boolean;
  }) {
    return (
      <details
        style={{
          borderTop: "1px solid #334950",
          paddingTop: 9,
        }}
      >
        <summary
          style={{
            cursor: "pointer",
            fontWeight: 650,
            fontSize: 12,
          }}
        >
          {title} ({items.length})
        </summary>

        {items.length === 0 ? (
          <p style={{ color: "#9bb3be", fontSize: 12 }}>
            None detected.
          </p>
        ) : (
          items.slice(0, 30).map((issue, index) => (
            <div
              key={`${issue.file}:${issue.ruleId}:${issue.line}:${index}`}
              style={{
                padding: "9px 0",
                borderBottom: "1px solid #263b43",
              }}
            >
              <strong style={{ fontSize: 12 }}>
                {issue.severity.toUpperCase()} · {issue.title}
              </strong>

              <div
                style={{
                  fontSize: 11,
                  color: "#a8bfc7",
                  overflowWrap: "anywhere",
                }}
              >
                {issue.file}:{issue.line} · {issue.ruleId}
              </div>

              {!deleted && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenSource(issue.file, issue.line)
                    }
                    style={{
                      marginTop: 5,
                      background: "transparent",
                      color: "#b9fa77",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    Open source
                  </button>

                  <div
                    style={{
                      fontSize: 11,
                      color: "#b4cfbf",
                      marginTop: 4,
                    }}
                  >
                    Suggestion: {issue.fix}
                  </div>
                </>
              )}
            </div>
          ))
        )}

        {items.length > 30 && (
          <p style={{ fontSize: 11 }}>
            Showing the first 30 findings.
          </p>
        )}
      </details>
    );
  }

  return (
    <section
      aria-label="FORGEX change intelligence"
      style={{
        margin: "14px 0",
        padding: 16,
        background: "#101d24",
        border: "1px solid #38515a",
        borderRadius: 10,
        color: "#e8f2ed",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <strong style={{ fontSize: 14 }}>
            Change Intelligence v3.1
          </strong>

          <div
            style={{
              fontSize: 11,
              color: "#9fb8c1",
            }}
          >
            {changedFiles} changed files · Local snapshot comparison
          </div>
        </div>

        <button
          type="button"
          onClick={runReview}
          style={{
            padding: "9px 12px",
            border: "1px solid #55754a",
            borderRadius: 7,
            background: "#25412d",
            color: "#d1ffa8",
            cursor: "pointer",
          }}
        >
          Run impact review
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: "#ffb6a9" }}>
          {error}
        </p>
      )}

       {report && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            role="status"
            style={{
              border: "1px solid #38515a",
              borderRadius: 8,
              padding: 12,
              background: "#142630",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            <strong>
              Local review summary
            </strong>

            <p style={{ margin: "6px 0" }}>
              {report.introduced.some(
                (finding) =>
                  finding.severity === "critical" ||
                  finding.severity === "high"
              )
                ? "Review required: new high-severity signals detected."
                : report.status === "partial"
                  ? "Review incomplete: coverage is partial."
                  : "No new high-severity signals detected by enabled rules."}
            </p>

            <div style={{ color: "#b4cbd2" }}>
              {report.status === "partial"
                ? "Partial coverage"
                : "Loaded files only"}
              {" · "}
              {report.dependencyImpact.direct.length} direct dependents
              {" · "}
              {report.dependencyImpact.indirect.length} indirect dependents
              {" · "}
              {report.dependencyImpact.unresolved} unresolved references
            </div>

            <p
              style={{
                margin: "6px 0 0",
                color: "#aabfc7",
                fontSize: 11,
              }}
            >
              GitHub PR evidence is not included in this local result.
              Tests and builds were not executed for this comparison.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              ["Introduced", report.introduced.length],
              ["Resolved", report.resolved.length],
              ["Removed with file", report.removedWithFiles.length],
              ["Unchanged signals", report.unchanged],
            ].map(([label, value]) => (
              <span
                key={String(label)}
                style={{
                  background: "#172a33",
                  border: "1px solid #36505a",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 12,
                }}
              >
                {label}: <strong>{value}</strong>
              </span>
            ))}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#c1d5d7",
            }}
          >
            Advisory score: {report.oldScore ?? "N/A"}
            {" → "}
            {report.newScore ?? "N/A"}

            {report.status === "partial"
              ? " · Partial coverage"
              : " · Loaded files only"}
          </p>

          <Findings
            title="New risks"
            items={report.introduced}
          />

          <Findings
            title="Resolved signals"
            items={report.resolved}
          />

          <Findings
            title="Removed because a file was deleted"
            items={report.removedWithFiles}
            deleted
          />
          <DependencyImpactPanel
            baselineFiles={baselineFiles}
            currentFiles={currentFiles}
            onOpenSource={onOpenSource}
            impactReport={report.dependencyImpact}
          />
          <p
            style={{
              fontSize: 11,
              color: "#aabfc7",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {report.notes.join(" ")}
          </p>
        </div>
      )}
    </section>
  );
}
