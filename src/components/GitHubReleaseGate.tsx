
"use client";

import { useEffect, useState } from "react";
import { sameHeadCommit } from "../lib/prReview";
type Evidence = {
  verdict:
    | "blocked"
    | "in-progress"
    | "not-verified"
    | "checks-passing"
    | "merged"
    | "closed";
  headSha: string;
  checks: Array<{
    name: string;
    status: string;
    conclusion: string | null;
    url: string | null;
  }>;
  statuses: Array<{
    name: string;
    state: string;
    url: string | null;
  }>;
  approvals: number;
  changeRequests: number;
  unavailable: string[];
  truncated: boolean;
  note: string;
};

const labels: Record<Evidence["verdict"], string> = {
  blocked: "Blocked — review the failures below",
  "in-progress": "In progress — checks pending",
  "not-verified": "Not verified — evidence is incomplete",
  "checks-passing":
    "Reported checks passing — not a merge approval",
  merged: "Merged on GitHub",
  closed: "Closed without merge",
};
const verdictColors: Record<Evidence["verdict"], string> = {
  blocked: "#ffb3aa",
  "in-progress": "#f2cc88",
  "not-verified": "#f2cc88",
  "checks-passing": "#c4eaa8",
  merged: "#c4eaa8",
  closed: "#b7cbd1",
};
export default function GitHubReleaseGate({
  repoFullName,
  number,
  expectedHeadSha,
}: {
  repoFullName: string;
  number: number;
  expectedHeadSha?: string;
}) {
  const [data, setData] = useState<Evidence | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setBusy(true);
    setError("");
    setData(null);

    const query = new URLSearchParams({
      repo: repoFullName,
      number: String(number),
    });

    fetch(`/api/github/release-gate?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ?? "Release Gate request failed."
          );
        }

        return json as Evidence;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setData(value);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load Release Gate."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
        }
      });

    return () => controller.abort();
  }, [repoFullName, number, refresh, expectedHeadSha]);

  const headMismatch =
    data !== null &&
    expectedHeadSha !== undefined &&
    !sameHeadCommit(expectedHeadSha, data.headSha);

  return (
    <section
      style={{
        border: "1px solid #3e5b63",
        background: "#0e1b21",
        borderRadius: 9,
        padding: 12,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <strong>FORGEX Release Gate v3</strong>

        <button
          type="button"
          disabled={busy}
          onClick={() => setRefresh((n) => n + 1)}
          style={{
            background: "#20343e",
            color: "#dcf3e6",
            border: "1px solid #46636c",
            borderRadius: 6,
            padding: "7px 10px",
            cursor: "pointer",
          }}
        >
          {busy ? "Checking..." : "Refresh evidence"}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ color: "#ffc0b7" }}>
          {error}
        </p>
      )}

      {data && (
        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          <strong
            role="status"
                 style={{
              color:
                headMismatch ||
                (data.verdict === "checks-passing" &&
                  (data.truncated || data.unavailable.length > 0))
                  ? "#f2cc88"
                  : verdictColors[data.verdict],
            }}
          >
                        {headMismatch
              ? "Not verified — head commits do not match"
              : labels[data.verdict]}
          </strong>
          {headMismatch && (
            <p
              role="alert"
              style={{ color: "#f2cc88", margin: 0 }}
            >
              PR status and check evidence refer to different head commits.
              Use Refresh status above to reload the PR and its evidence.
            </p>
          )}
          <div style={{ color: "#b7cbd1" }}>
            {data.checks.length} check runs ·{" "}
            {data.statuses.length} commit statuses ·{" "}
            {data.approvals} approvals recorded ·{" "}
            {data.changeRequests} change requests
          </div>

          {(data.unavailable.length > 0 ||
            data.truncated) && (
            <p
              role="alert"
              style={{
                color: "#f2cc88",
                margin: 0,
              }}
            >
              {[
                ...data.unavailable,
                ...(data.truncated
                  ? ["Some GitHub results were truncated."]
                  : []),
              ].join(" ")}
            </p>
          )}

          <details>
            <summary style={{ cursor: "pointer" }}>
              Check runs ({data.checks.length})
            </summary>

            {data.checks.length ? (
              data.checks.map((check, index) => (
                <div
                  key={`${check.name}-${index}`}
                  style={{
                    padding: "5px 0",
                    borderBottom: "1px solid #29434b",
                  }}
                >
                  {check.name}:{" "}
                  {check.conclusion ?? check.status}

                  {check.url && (
                    <>
                      {" · "}
                      <a
                        href={check.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Details
                      </a>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p>No check runs returned for this head commit.</p>
            )}
          </details>

          <details>
            <summary style={{ cursor: "pointer" }}>
              Commit statuses ({data.statuses.length})
            </summary>

            {data.statuses.length ? (
              data.statuses.map((item) => (
                <div
                  key={item.name}
                  style={{
                    padding: "5px 0",
                    borderBottom: "1px solid #29434b",
                  }}
                >
                  {item.name}: {item.state}

                  {item.url && (
                    <>
                      {" · "}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Details
                      </a>
                    </>
                  )}
                </div>
              ))
            ) : (
              <p>No commit statuses returned for this head commit.</p>
            )}
          </details>

          <small style={{ color: "#a1b9c0" }}>
            Head: {data.headSha.slice(0, 12)}
            {" · "}
            {data.note}
          </small>
        </div>
      )}
    </section>
  );
}
