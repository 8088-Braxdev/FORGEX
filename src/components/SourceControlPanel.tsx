
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PreviewBinaryAsset } from "@/lib/previewAssets";
import { useAppConfirm } from "./AppConfirmProvider";
import type { SourceFile } from "../lib/analyzer";
import {
  compareWorkspace,
  type DiffLine,
} from "../lib/sourceControl";
import styles from "./SourceControlPanel.module.css";
import GitHubConnect from "./GitHubConnect";
import type { RepoIdentity } from "../lib/workspaceDraft";
type Props = {
  baselineFiles: readonly SourceFile[];
  currentFiles: readonly SourceFile[];
  assets: PreviewBinaryAsset[];
  selectedPath?: string;
  onOpenFile: (path: string, line?: number) => void;
  onCaptureBaseline?: () => void;
  githubBaselineFiles: readonly SourceFile[] | null;
repoIdentity: RepoIdentity | null;
repoUrl: string;
};

function numbers(line: DiffLine) {
  return (
    `${line.oldLine ?? ""}`.padStart(4, " ") +
    " " +
    `${line.newLine ?? ""}`.padStart(4, " ")
  );
}

export default function SourceControlPanel({
  baselineFiles,
  currentFiles,
  assets,
  selectedPath,
  onOpenFile,
  onCaptureBaseline,
  githubBaselineFiles,
  repoIdentity,
  repoUrl
}: Props) {
  const confirmAction = useAppConfirm();
  const report = useMemo(
    () => compareWorkspace(baselineFiles, currentFiles),
    [baselineFiles, currentFiles]
  );

  const [reviewPath, setReviewPath] = useState<string | null>(null);

  const reviewDialogRef = useRef<HTMLDialogElement>(null);

  const reviewChange = report.changes.find(
    (change) => change.path === reviewPath
  );

  useEffect(() => {
    const dialog = reviewDialogRef.current;
    if (!dialog) return;

    if (reviewChange && !dialog.open) {
      dialog.showModal();
    }

    if (!reviewChange && dialog.open) {
      dialog.close();
    }
  }, [reviewChange]);

  async function captureSnapshot() {
    if (!onCaptureBaseline) return;

    const confirmed = await confirmAction({
      title: "Capture comparison snapshot?",
      message: "Current files will become the comparison snapshot. This clears local change markers without saving files or publishing to GitHub.",
      confirmText: "Capture Snapshot", cancelText: "Cancel",
    });

    if (!confirmed) return;

    onCaptureBaseline();
  }

  return (
    <section
      className={styles.root}
      aria-label="Local Source Control"
    >
      <div className={styles.head}>
        <strong>LOCAL CHANGES</strong>
        <span>{report.changes.length}</span>
      </div>

      <p className={styles.note}>
        Compared against the last local snapshot,
        not against a live GitHub commit. No network write.
      </p>

      <div className={styles.stats}>
        <span title="Added files">A {report.added}</span>
        <span title="Modified files">M {report.modified}</span>
        <span title="Deleted files">D {report.deleted}</span>
      </div>

      {report.changes.length === 0 ? (
        <p className={styles.empty}>
          No changes relative to the current snapshot.
        </p>
      ) : (
        <div className={styles.changes}>
          {report.changes.map((change) => (
            <details key={change.path} className={styles.file}>
              <summary>
                <span
                  className={`${styles.status} ${
                    styles[change.status]
                  }`}
                >
                  {change.status[0].toUpperCase()}
                </span>

                <span
                  className={styles.path}
                  title={change.path}
                >
                  {change.path}
                </span>
              </summary>

              <div className={styles.details}>
                <div className={styles.changeInfo}>
                  <span>
                    {change.additions === null
                      ? "Line counts unavailable"
                      : `+${change.additions} / -${change.deletions}`}
                  </span>

                  <button
                    type="button"
                    onClick={() => setReviewPath(change.path)}
                    aria-label={`Review diff for ${change.path}`}
                  >
                    Review diff
                  </button>

                  {change.status !== "deleted" && (
                    <button
                      type="button"
                      onClick={() => {
                        const first = change.diff.find(
                          (item) => item.kind === "add"
                        )?.newLine;

                        onOpenFile(change.path, first ?? 1);
                      }}
                    >
                      Open in editor
                    </button>
                  )}
                </div>

                <div
                  className={styles.diff}
                  role="region"
                  aria-label={`Diff for ${change.path}`}
                >
                  {change.diff.map((line, index) => (
                    <div
                      key={`${index}-${line.kind}`}
                      className={`${styles.diffLine} ${
                        styles[line.kind]
                      }`}
                    >
                      <span className={styles.numbers}>
                        {line.kind === "skip"
                          ? ""
                          : numbers(line)}
                      </span>

                      <span className={styles.sign}>
                        {line.kind === "add"
                          ? "+"
                          : line.kind === "remove"
                            ? "−"
                            : " "}
                      </span>

                      <code>{line.text || " "}</code>
                    </div>
                  ))}
                </div>

                {change.limited && (
                  <p className={styles.note}>
                    Preview is limited. The file is still
                    marked as changed.
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      <dialog
        ref={reviewDialogRef}
        className={styles.reviewDialog}
        aria-label={
          reviewChange
            ? `Review changes to ${reviewChange.path}`
            : "Review source changes"
        }
        onClose={() => setReviewPath(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        {reviewChange && (
          <div className={styles.reviewContent}>
            <header className={styles.reviewHeader}>
              <div className={styles.reviewTitle}>
                <strong>{reviewChange.path}</strong>

                <span>
                  {reviewChange.status.toUpperCase()} ·{" "}
                  {reviewChange.additions === null
                    ? "Exact line counts unavailable"
                    : `+${reviewChange.additions} / -${reviewChange.deletions}`}
                </span>
              </div>

              <button
                type="button"
                className={styles.reviewClose}
                onClick={() =>
                  reviewDialogRef.current?.close()
                }
                aria-label="Close diff review"
              >
                × Close
              </button>
            </header>

            <p className={styles.reviewHelp}>
              Compared with the last local snapshot.
              Green lines were added; red lines were removed.
              Nothing has been committed or pushed.
            </p>

            <div
              className={styles.reviewDiff}
              role="region"
              aria-label="Source line changes"
              tabIndex={0}
            >
              {reviewChange.diff.map((line, index) => (
                <div
                  key={`${index}-${line.kind}`}
                  className={`${styles.reviewLine} ${
                    styles[line.kind]
                  }`}
                >
                  <span
                    className={styles.numbers}
                    aria-hidden="true"
                  >
                    {line.kind === "skip"
                      ? ""
                      : numbers(line)}
                  </span>

                  <span
                    className={styles.sign}
                    aria-hidden="true"
                  >
                    {line.kind === "add"
                      ? "+"
                      : line.kind === "remove"
                        ? "−"
                        : " "}
                  </span>

                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>

            {reviewChange.limited && (
              <p className={styles.note}>
                This diff preview is limited for large
                files; it does not invent line counts.
              </p>
            )}

            <footer className={styles.reviewFooter}>
              {reviewChange.status !== "deleted" && (
                <button
                  type="button"
                  onClick={() => {
                    const first = reviewChange.diff.find(
                      (line) => line.kind === "add"
                    )?.newLine;

                    onOpenFile(
                      reviewChange.path,
                      first ?? 1
                    );

                    reviewDialogRef.current?.close();
                  }}
                >
                  Open file in editor
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  reviewDialogRef.current?.close()
                }
              >
                Done reviewing
              </button>
            </footer>
          </div>
        )}
      </dialog>

<GitHubConnect
  hasWorkspace={currentFiles.length > 0 || assets.length > 0 || repoIdentity !== null}
  currentFiles={currentFiles}
  assets={assets}
  selectedPath={selectedPath}
  baselineFiles={baselineFiles}
  githubBaselineFiles={githubBaselineFiles}
  repoIdentity={repoIdentity}
  repoUrl={repoUrl}
/>

      {onCaptureBaseline && (
        <button
          type="button"
          className={styles.capture}
          onClick={() => void captureSnapshot()}
        >
          Capture local snapshot
        </button>
      )}

      <p className={styles.foot}>
        Snapshot ≠ Save ≠ Git commit.
        GitHub push/PR is a separate,
        permissioned feature.
      </p>
    </section>
  );
}
