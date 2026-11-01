
"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import {
  Activity,
  GitCompare,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import type {
  Finding,
  ProjectResult,
  SourceFile,
} from "../lib/analyzer";

import { buildImpactGraph } from "../lib/impact";

import {
  rawPenalty,
  simulateLineChange,
  type ChangePreview,
} from "../lib/changeSimulation";

type Props = {
  files: SourceFile[];
  result: ProjectResult;
  disabled: string[];
  onApply: (
    finding: Finding,
    replacement: string,
    expected: string
  ) => void;
};

export default function ChangeSimulation({
  files,
  result,
  disabled,
  onApply,
}: Props) {
  const [requested, setRequested] = useState("");
  const [draft, setDraft] = useState<{
    id: string;
    text: string;
  } | null>(null);

  const [preview, setPreview] =
    useState<ChangePreview | null>(null);

  const [message, setMessage] = useState("");

  const sourceLines = useMemo(
    () => new Map(
      files.map(file => [
        file.path,
        file.content.split(/\r?\n/),
      ])
    ),
    [files]
  );

  const visibleFindings = useMemo(
    () => result.findings.filter(
      f => sourceLines.get(f.file)?.[f.line - 1] !== undefined
    ).slice(0, 200),
    [result, sourceLines]
  );

  const finding = visibleFindings.find(
    f => f.id === requested
  ) ?? visibleFindings[0];

  const originalLine = finding
    ? sourceLines.get(finding.file)?.[finding.line - 1] ?? ""
    : "";

  const candidate = finding && draft?.id === finding.id
    ? draft.text
    : finding?.replacement ?? originalLine;

  const raw = useMemo(
    () => rawPenalty(result.findings),
    [result]
  );

  const graph = useMemo(
    () => buildImpactGraph(files),
    [files]
  );

  const impact = finding
    ? graph.affectedBy(finding.file).length
    : 0;

  function runPreview() {
    if (!finding) return;

    try {
      setPreview(
        simulateLineChange(
          files,
          result,
          finding,
          candidate,
          disabled
        )
      );
      setMessage("");
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Simulation failed."
      );
    }
  }

  return (
    <section className="fxsim">
      <div className="fxsim-title">
        <span className="fxsim-eyebrow">
          <GitCompare size={15} />
          CHANGE LAB / EXPERIMENTAL
        </span>

        <h2>Test a change before applying it.</h2>
        <p>
          Compare scanner findings without
          modifying any source files.
        </p>
      </div>

      <div className="fxsim-metrics">
        <div>
          <small>HEALTH SCORE</small>
          <strong>{result.score}/100</strong>
        </div>

        <div>
          <small>RAW RISK PENALTY</small>
          <strong>{raw.toLocaleString()}</strong>
        </div>

        <div>
          <small>FINDINGS</small>
          <strong>{result.findings.length}</strong>
        </div>
      </div>

      {result.score === 0 && (
        <p className="fxsim-explain">
          <Activity size={15} />
          The score is capped at zero after
          the raw penalty reaches 100.
          Fixes can reduce the penalty even
          while the score stays at zero.
        </p>
      )}

      {!finding ? (
        <p className="fxsim-explain">
          No findings to simulate in the loaded files.
        </p>
      ) : (
        <>
          <label className="fxsim-label" htmlFor="fxsim-finding">
            CHOOSE A FINDING
          </label>

          <select
            id="fxsim-finding"
            value={finding.id}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setRequested(e.target.value);
              setDraft(null);
              setPreview(null);
              setMessage("");
            }}
          >
            {visibleFindings.map(f => (
              <option value={f.id} key={f.id}>
                {f.severity.toUpperCase()} · {f.title}
                {" · "}{f.file}:{f.line}
              </option>
            ))}
          </select>

          {result.findings.length > 200 && (
            <p className="fxsim-explain">
              Showing the first 200 findings.
              Narrow the scan for the remaining findings.
            </p>
          )}

          <div className="fxsim-source">
            <strong>
              {finding.file}:{finding.line}
            </strong>

            <p>{finding.detail}</p>

            <p>
              <b>Suggested action:</b> {finding.fix}
            </p>

            <small>
              Possible downstream importers: {impact}.
              Import-based estimate only.
            </small>
          </div>

          <label className="fxsim-label" htmlFor="fxsim-original">
            CURRENT SOURCE LINE
          </label>

          <pre className="fxsim-original" id="fxsim-original">
            {originalLine}
          </pre>

          <label className="fxsim-label" htmlFor="fxsim-draft">
            PROPOSED REPLACEMENT
          </label>

          <textarea
            id="fxsim-draft"
            rows={3}
            spellCheck={false}
            value={candidate}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              setDraft({
                id: finding.id,
                text: e.target.value,
              });

              setPreview(null);
              setMessage("");
            }}
          />

          <div className="fxsim-actions">
            <button type="button" onClick={runPreview}>
              Simulate change
            </button>

            <span>
              One source line only · No code execution
            </span>
          </div>

          {message && (
            <p className="fxsim-error" role="alert">
              {message}
            </p>
          )}

          {preview && (
            <div className="fxsim-report" aria-live="polite">
              <h3>
                <ShieldCheck size={17} />
                Simulation results
              </h3>

              <div className="fxsim-comparison">
                <div>
                  <small>HEALTH</small>
                  <strong>
                    {preview.before.score} → {preview.after.score}
                  </strong>
                </div>

                <div>
                  <small>RAW PENALTY</small>
                  <strong>
                    {preview.penaltyBefore} → {preview.penaltyAfter}
                  </strong>
                </div>

                <div>
                  <small>FINDINGS</small>
                  <strong>
                    {preview.before.findings.length}
                    {" → "}
                    {preview.after.findings.length}
                  </strong>
                </div>
              </div>

              <p>
                <b>{preview.resolved.length} cleared</b>
                {" · "}
                <b>{preview.introduced.length} newly flagged</b>
              </p>

              {preview.resolved.slice(0, 3).map(f => (
                <p key={f.id} className="fxsim-cleared">
                  − {f.ruleId}: {f.title}
                </p>
              ))}

              {preview.introduced.slice(0, 3).map(f => (
                <p key={f.id} className="fxsim-new">
                  + {f.ruleId}: {f.title}
                </p>
              ))}

              <p className="fxsim-caution">
                <AlertTriangle size={15} />
                Heuristic re-scan only. Tests are not
                executed and behavior is not verified.
              </p>

              <button
                type="button"
                className="fxsim-apply"
                onClick={() =>
                  onApply(
                    finding,
                    preview.replacementLine,
                    preview.originalLine
                  )
                }
              >
                Apply to local workspace
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
