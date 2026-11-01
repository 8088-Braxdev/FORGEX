
"use client";

import { useEffect, useState, useRef } from "react";
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import GitHubReleaseGate from "./GitHubReleaseGate";
export type PRData = {
  number: number;
  title: string;
  url: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  updatedAt: string;
  headSha: string;
  baseBranch: string;
};

type Props = {
  repoFullName: string;
  number: number;
    onStatusChange?: (status: PRData | null) => void;
};

export default function GitHubPRStatus({
  repoFullName,
  number,
  onStatusChange,
}: Props) {
  const [data, setData] = useState<PRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const statusCallback = useRef(onStatusChange);

  useEffect(() => {
    statusCallback.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError("");
    setData(null);
    statusCallback.current?.(null);
    const params = new URLSearchParams({
      repo: repoFullName,
      number: String(number),
    });

    fetch(`/api/github/pr-status?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ?? "Unable to load Pull Request."
          );
        }
        if (
          result?.number !== number ||
          (result.state !== "open" && result.state !== "closed") ||
          typeof result.merged !== "boolean" ||
          typeof result.headSha !== "string" ||
          !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(result.headSha)
        ) {
          throw new Error("GitHub returned invalid Pull Request status.");
        }
        return result as PRData;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          statusCallback.current?.(result);
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "GitHub status unavailable."
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [repoFullName, number, refreshCount]);

  const stateLabel = data?.merged
    ? "Merged"
    : data?.state === "closed"
      ? "Closed without merge"
      : data?.draft
        ? "Draft"
        : "Open";

  const mergeLabel =
    data?.state !== "open"
      ? "Not applicable"
      : data.mergeable === true
        ? "No merge conflicts reported"
        : data.mergeable === false
          ? "GitHub reports this PR is not mergeable"
          : "GitHub is still calculating mergeability";

  return (
    <section
      aria-label="GitHub Pull Request status"
      style={{
        marginTop: 14,
        padding: 14,
        border: "1px solid #39535c",
        borderRadius: 9,
        background: "#101e25",
        color: "#e4f2ec",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <GitPullRequest size={17} />
          <strong style={{ fontSize: 13 }}>
            Pull Request #{number}
          </strong>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setData(null);
            setError("");
            setLoading(true);
            statusCallback.current?.(null);
            setRefreshCount((n) => n + 1);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 10px",
            background: "#1e343e",
            border: "1px solid #46616b",
            borderRadius: 6,
            color: "#e4f2ec",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} />
          Refresh status
        </button>
      </div>

      {loading && (
        <p role="status" style={{ fontSize: 12 }}>
          Checking GitHub...
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "#ffb8ad" }}>
          {error}
        </p>
      )}

            {data && !loading && !error && (
        <div style={{ marginTop: 12, fontSize: 12 }}>
          <strong>{data.title}</strong>

          <div
            style={{
              display: "grid",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div>
              <span style={{ color: "#9bb5be" }}>
                State:{" "}
              </span>
              <strong>{stateLabel}</strong>
            </div>

            <div>
              <span style={{ color: "#9bb5be" }}>
                Mergeability:{" "}
              </span>
              {mergeLabel}
            </div>

            <div>
              <span style={{ color: "#9bb5be" }}>
                Target branch:{" "}
              </span>
              {data.baseBranch}
            </div>

            <div>
              <span style={{ color: "#9bb5be" }}>
                Head commit:{" "}
              </span>
              <code>{data.headSha.slice(0, 12)}</code>
            </div>
          </div>

          <p
            style={{
              marginTop: 12,
              color: "#9bb5be",
              lineHeight: 1.6,
            }}
          >
            CI checks, reviews and release readiness are
            not verified by this panel. Mergeability
            alone does not mean the PR is safe to merge.
          </p>

          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              gap: 6,
              alignItems: "center",
              color: "#b9fa77",
            }}
          >
            <ExternalLink size={13} />
            View on GitHub
          </a>
        </div>
      )}
      {data && !loading && !error && (
        <GitHubReleaseGate
          key={`${repoFullName}:${number}:${data.headSha}`}
          repoFullName={repoFullName}
          number={number}
          expectedHeadSha={data.headSha}
        />
      )}
    </section>
  );
}
