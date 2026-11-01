"use client";

import { useMemo, useState, useEffect } from "react";
import type { SourceFile } from "../lib/analyzer";
import type { RepoIdentity } from "../lib/workspaceDraft";
import { compareWorkspace } from "../lib/sourceControl";
import GitHubPRStatus, { type PRData } from "./GitHubPRStatus";
import { useAppConfirm } from "./AppConfirmProvider";
import { canCreatePullRequest, readPullRequestNumber } from "../lib/prReview";
export default function GitHubPublish({
  identity,
  files,
  baselineFiles,
}: {
  identity: RepoIdentity;
  files: readonly SourceFile[];
  baselineFiles: readonly SourceFile[];
}) {
  const confirmAction = useAppConfirm();
  const identityKey = `${identity.fullName}:${identity.branch}:${identity.commitSha}`;

const [additionApproval, setAdditionApproval] = useState<{
  identityKey: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}>({
  identityKey: "",
  files: [],
});


  const baselinePaths = useMemo(
    () => new Set(baselineFiles.map((file) => file.path)),
    [baselineFiles],
  );

  const newFiles = useMemo(
    () => files.filter((file) => !baselinePaths.has(file.path)),
    [files, baselinePaths],
  );


const approvedAdditions = useMemo(() => {
  if (additionApproval.identityKey !== identityKey) {
    return new Set<string>();
  }

  const currentContent = new Map(
    newFiles.map((file) => [file.path, file.content])
  );

  return new Set(
    additionApproval.files
      .filter(
        (approved) =>
          currentContent.get(approved.path) === approved.content
      )
      .map((approved) => approved.path)
  );
}, [additionApproval, identityKey, newFiles]);




  const publishFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          baselinePaths.has(file.path) || approvedAdditions.has(file.path),
      ),
    [files, baselinePaths, approvedAdditions],
  );

  const changes = useMemo(
    () => compareWorkspace(baselineFiles, publishFiles).changes,
    [baselineFiles, publishFiles],
  );


function setAdditionIncluded(
  path: string,
  included: boolean
) {
  const current = newFiles.find(
    (file) => file.path === path
  );

  setAdditionApproval((previous) => {
    const existing =
      previous.identityKey === identityKey
        ? previous.files
        : [];

    const next = existing.filter(
      (file) => file.path !== path
    );

    if (included && current) {
      next.push({
        path: current.path,
        content: current.content,
      });
    }

    return {
      identityKey,
      files: next,
    };
  });
}


  const [title, setTitle] = useState("Update project via FORGEX");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [branchLink, setBranchLink] = useState("");

  const storageKey = `forgex:last-pr:${identity.fullName}:${identity.commitSha}`;

  const [prNumber, setPrNumber] = useState<number | null>(null);
  const [trackedPR, setTrackedPR] = useState<PRData | null>(null);
  const [loadedStorageKey, setLoadedStorageKey] = useState("");
  useEffect(() => {
    setTrackedPR(null);

    try {
      const saved = window.localStorage.getItem(storageKey);
      const value = saved ? Number(saved) : NaN;

      setPrNumber(Number.isSafeInteger(value) && value > 0 ? value : null);
    } catch {
      setPrNumber(null);
    } finally {
      setLoadedStorageKey(storageKey);
    }
  }, [storageKey]);

  const available =
    canCreatePullRequest({
      historyReady: loadedStorageKey === storageKey,
      prNumber,
      status: trackedPR,
      hasPublishedLink: Boolean(link),
    }) &&
    !identity.partial &&
    changes.length > 0 &&
    changes.length <= 20 &&
    title.trim().length > 0 &&
    !busy &&
    !branchLink;

  async function publish() {
    if (!available) return;

    const paths = changes.map((c) => `${c.status}: ${c.path}`).join("\n");


const approved = await confirmAction({
  title: "Review GitHub publication",
  message:
    `Repository: ${identity.fullName}\n` +
    `Base branch: ${identity.branch}\n` +
    `Base commit: ${identity.commitSha.slice(0, 12)}\n\n` +
    `Proposed changes:\n${paths}\n\n` +
    "FORGEX will create a new branch and Pull Request. " +
    "The base branch will not be modified directly. " +
    "Tests are not executed by this action.",
  confirmText: "Create Pull Request",
  cancelText: "Cancel",
});

    if (!approved) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/github/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          identity,
          baselineFiles,
          files: publishFiles,
          title: title.trim(),
          previousPRNumber: prNumber,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        url?: string;
        branch?: string;
        branchUrl?: string;
        warning?: string;
        number?: number;
        reused?: boolean;
      };

      if (!res.ok) {
        if (data.branchUrl) {
          setBranchLink(data.branchUrl);
        }

        throw new Error(
          [data.error, data.warning].filter(Boolean).join(" ") ||
            "Publishing failed.",
        );
      }

      const createdNumber = readPullRequestNumber(identity.fullName, data.url);

      if (createdNumber === null) {
        throw new Error(
          "GitHub did not return a valid Pull Request link for this repository.",
        );
      }

      setLink(`https://github.com/${identity.fullName}/pull/${createdNumber}`);
      setTrackedPR(null);
      setPrNumber(createdNumber);

      try {
        window.localStorage.setItem(storageKey, String(createdNumber));
      } catch {
        // Tracking remains available until this page reloads.
      }

      setMessage(
        data.reused
          ? `Recovered existing Pull Request #${createdNumber}.`
          : `Pull Request created on ${data.branch ?? "a new branch"}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details
      style={{
        border: "1px solid #35515b",
        borderRadius: 9,
        marginBottom: 12,
        padding: 12,
        background: "#132129",
        color: "#e5f4ed",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        GitHub publishing · Review & Create PR ({changes.length} changes)
      </summary>

      <p
        style={{
          color: "#a8c3cc",
          fontSize: 12,
        }}
      >
        {identity.fullName} · {identity.branch} ·{" "}
        {identity.commitSha.slice(0, 12)}
      </p>

      {newFiles.length > 0 && (
        <section
          aria-label="Review new files for publishing"
          style={{
            marginTop: 14,
            marginBottom: 14,
            padding: 13,
            border: "1px solid #52614a",
            borderRadius: 8,
            background: "#1a2925",
          }}
        >
          <strong style={{ fontSize: 12, color: "#d7f5bd" }}>
            New files require approval
          </strong>

          <p
            style={{
              color: "#b7c9c1",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >
            {newFiles.length} new file(s) are excluded from publishing by
            default. Select only files you intend to include in this Pull
            Request. Review their contents for private data before approving.
          </p>

          <div
            style={{
              display: "grid",
              gap: 10,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {newFiles.map((file) => (
              <label
                key={file.path}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={approvedAdditions.has(file.path)}
                  onChange={(event) =>
                    setAdditionIncluded(file.path, event.target.checked)
                  }
                  style={{
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    accentColor: "#b9fa77",
                  }}
                />

                <code style={{ overflowWrap: "anywhere" }}>{file.path}</code>
              </label>
            ))}
          </div>

          <p
            role="status"
            style={{
              marginBottom: 0,
              color: "#c2d3c8",
              fontSize: 11,
            }}
          >
            {newFiles.filter((file) => approvedAdditions.has(file.path)).length}{" "}
            of {newFiles.length} new files approved.
          </p>
        </section>
      )}

      {identity.partial && (
        <p role="alert">
          Partial import: publishing is blocked. Reimport a complete supported
          workspace.
        </p>
      )}

      <div
        style={{
          maxHeight: 220,
          overflowY: "auto",
          padding: "4px 0",
        }}
      >
        {changes.map((change) => (
          <details
            key={change.path}
            style={{
              borderBottom: "1px solid #314550",
              padding: "6px 0",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {change.status.toUpperCase()} · {change.path}
            </summary>

            <pre
              style={{
                whiteSpace: "pre",
                overflowX: "auto",
                background: "#09151a",
                padding: 8,
                fontSize: 11,
              }}
            >
              {change.diff
                .map(
                  (line) =>
                    `${
                      line.kind === "add"
                        ? "+"
                        : line.kind === "remove"
                          ? "-"
                          : " "
                    } ${line.text}`,
                )
                .join("\n")}
            </pre>

            {change.limited && (
              <small>
                Diff preview is limited. Review the file in editor before
                publishing.
              </small>
            )}
          </details>
        ))}
      </div>

      <label
        style={{
          display: "grid",
          gap: 6,
          marginTop: 12,
          fontSize: 12,
        }}
      >
        Pull Request title
        <input
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          style={{
            width: "100%",
            padding: 9,
            border: "1px solid #42606a",
            borderRadius: 6,
            background: "#0b161d",
            color: "#fff",
          }}
        />
      </label>

      <p
        style={{
          fontSize: 11,
          color: "#a8c3cc",
        }}
      >
        Creates a new GitHub branch and PR. Does not run tests or merge into
        main.
      </p>
      {prNumber !== null && (
        <p role="status" style={{ fontSize: 12, color: "#b7cbd1" }}>
          {trackedPR?.number !== prNumber
            ? "Verify the tracked PR status below before creating another PR."
            : trackedPR.merged
              ? "This PR is merged. Reimport the latest branch before publishing new changes."
              : trackedPR.state === "open"
                ? `PR #${prNumber} is still open. Review the existing PR below.`
                : "The previous PR was closed without merge. You may review the changes and create another PR."}
        </p>
      )}
      <button
        type="button"
        disabled={!available}
        onClick={() => void publish()}
        style={{
          padding: "10px 14px",
          borderRadius: 7,
          border: 0,
          background: "#b9fa77",
          color: "#102019",
          fontWeight: 700,
          opacity: available ? 1 : 0.5,
        }}
      >
        {busy ? "Publishing..." : "Review & Create Pull Request"}
      </button>

      {message && (
        <p role="status" style={{ fontSize: 12 }}>
          {message}
        </p>
      )}

      {link && (
        <p>
          <a href={link} target="_blank" rel="noopener noreferrer">
            Open Pull Request on GitHub
          </a>
        </p>
      )}
      {prNumber !== null && (
        <GitHubPRStatus
          key={`${identity.fullName}:${prNumber}`}
          repoFullName={identity.fullName}
          number={prNumber}
          onStatusChange={setTrackedPR}
        />
      )}
      {branchLink && (
        <p>
          <a href={branchLink} target="_blank" rel="noopener noreferrer">
            Open created branch on GitHub
          </a>
        </p>
      )}
    </details>
  );
}
