"use client";

import { useMemo } from "react";

import type { SourceFile } from "../lib/analyzer";

import {
  buildDependencyImpact,
  type DependencyImpact,
} from "../lib/dependencyImpact";

type Props = {
  baselineFiles: readonly SourceFile[];
  currentFiles: readonly SourceFile[];
  onOpenSource: (path: string, line?: number) => void;
    impactReport?: DependencyImpact;
};

const pill = {
  padding: "6px 9px",
  border: "1px solid #38545e",
  borderRadius: 6,
  background: "#172a33",
  fontSize: 11,
} as const;

export default function DependencyImpactPanel({
  baselineFiles,
  currentFiles,
  onOpenSource,
  impactReport,
}: Props) {
  const result = useMemo(() => {
    if (impactReport) {
      return {
        report: impactReport,
        error: "",
      };
    }

    try {
      return {
        report: buildDependencyImpact(
          baselineFiles,
          currentFiles
        ),
        error: "",
      };
    } catch (error) {
      return {
        report: null,
        error:
          error instanceof Error
            ? error.message
            : "Dependency analysis failed.",
      };
    }
  }, [baselineFiles, currentFiles, impactReport]);

  const { report, error } = result;

  const affected = report ? [...report.direct, ...report.indirect] : [];

  return (
    <section
      aria-label="Dependency impact"
      style={{
        borderTop: "1px solid #36505a",
        paddingTop: 12,
        display: "grid",
        gap: 9,
      }}
    >
      <strong style={{ fontSize: 13 }}>Dependency Impact v3.2</strong>

      {error && (
        <p role="alert" style={{ color: "#ffb6a9" }}>
          {error}
        </p>
      )}

      {report && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span style={pill}>Direct: {report.direct.length}</span>

            <span style={pill}>Indirect: {report.indirect.length}</span>

            <span style={pill}>Unresolved: {report.unresolved}</span>
          </div>

          <p
            style={{
              color: "#a9bec6",
              fontSize: 11,
              margin: 0,
            }}
          >
            {report.changedFiles.length} changed files
            {" · "}
            {report.scannedFiles} current files inspected
          </p>

          {affected.length === 0 ? (
            <p
              style={{
                fontSize: 12,
                color: "#bbd3dc",
                margin: 0,
              }}
            >
              No dependents found among loaded files. This does not rule out
              runtime impact.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 7,
              }}
            >
              {affected.map((item) => (
                <div
                  key={item.path}
                  style={{
                    background: "#162832",
                    border: "1px solid #34515a",
                    borderRadius: 7,
                    padding: "9px 11px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {item.path}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "#a9c2cd",
                      marginTop: 4,
                    }}
                  >
                    {item.depth === 1
                      ? "Direct"
                      : `Indirect (depth ${item.depth})`}

                    {" · via "}
                    {item.via}

                    {item.source === "baseline" ? " · previous reference" : ""}
                  </div>

                                    <button
                    type="button"
                    onClick={() =>
                      onOpenSource(
                        item.path,
                        item.source === "current"
                          ? item.line
                          : undefined
                      )
                    }
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#b9fa77",
                      cursor: "pointer",
                      padding: "6px 0 0",
                      fontSize: 11,
                    }}
                  >
                    {item.source === "current"
                      ? `Open dependency reference · line ${item.line}`
                      : "Open current file · previous reference"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <details
            style={{
              fontSize: 11,
              color: "#a9bec6",
            }}
          >
            <summary style={{ cursor: "pointer" }}>
              Coverage and limitations
            </summary>

            <p style={{ lineHeight: 1.6 }}>{report.notes.join(" ")}</p>
          </details>
        </>
      )}
    </section>
  );
}
