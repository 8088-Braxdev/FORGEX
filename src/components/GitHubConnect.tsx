
"use client";

import { useEffect, useState } from "react";
import { Github, LogOut } from "lucide-react";
import type { RepoIdentity } from "../lib/workspaceDraft";
import { useAppConfirm } from "./AppConfirmProvider";

type Status = {
  connected: boolean;
  login?: string;
  configured: boolean;
};

type RecoveryFile = {
  path: string;
  content: string;
};

export default function GitHubConnect({
  hasWorkspace,
  currentFiles,
  baselineFiles,
  githubBaselineFiles,
  repoIdentity,
  repoUrl,
}: {
  hasWorkspace: boolean;
  currentFiles: readonly RecoveryFile[];
  baselineFiles: readonly RecoveryFile[];
  githubBaselineFiles: readonly RecoveryFile[] | null;
  repoIdentity: RepoIdentity | null;
  repoUrl: string;
}) {
  const confirmAction = useAppConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteDismissed, setInviteDismissed] = useState(false);
  useEffect(() => {
    let cancelled = false;

    fetch("/api/github/session", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Status unavailable");
        return (await res.json()) as Status;
      })
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Cannot check GitHub connection.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);


async function connect() {
  setError("");

  if (hasWorkspace) {
    const confirmed = await confirmAction({
      title: "Connect your GitHub account",
      message:
        "GitHub authorization will temporarily leave FORGEX.\n\n" +
        "Your current workspace will be saved in browser storage " +
        "and offered for recovery when you return.\n\n" +
        "For additional safety, export a project backup before continuing.",
      confirmText: "Connect GitHub",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      sessionStorage.setItem(
        "forgex-oauth-recovery-v1",
        JSON.stringify({
          savedAt: Date.now(),
          files: currentFiles.map((file) => ({ ...file })),
          baseline: baselineFiles.map((file) => ({ ...file })),
          githubBaseline: githubBaselineFiles
            ? githubBaselineFiles.map((file) => ({ ...file }))
            : null,
          repoIdentity: repoIdentity
            ? {
                ...repoIdentity,
                importedPaths: [...repoIdentity.importedPaths],
              }
            : null,
          repoUrl,
        }),
      );
    } catch {
      setError(
        "Browser storage is unavailable or full. " +
        "Use Save > Export project backup before connecting.",
      );
      return;
    }
  }

  window.location.assign("/api/github/connect");
}


  async function disconnect() {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/github/session", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Disconnect failed");

      setStatus((previous) => ({
        connected: false,
        configured: previous?.configured ?? false,
      }));
    } catch {
      setError("Could not disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 12px",
    border: "1px solid #527454",
    borderRadius: 7,
    background: "#25402d",
    color: "#cfffaa",
    fontSize: 12,
    cursor: "pointer",
  } as const;

  return (
    <section
      style={{
        borderTop: "1px solid #30464f",
        padding: "12px 0",
        marginTop: 12,
      }}
    >
      <strong
        style={{
          fontSize: 11,
          letterSpacing: ".06em",
        }}
      >
        GITHUB CONNECTION
      </strong>

      {status?.connected ? (
        <>
          <p style={{ fontSize: 12, color: "#b9fa77" }}>
            Connected as @{status.login}
          </p>

          <button
            type="button"
            disabled={busy}
            style={buttonStyle}
            onClick={disconnect}
          >
            <LogOut size={14} />
            Disconnect
          </button>

          <p style={{ fontSize: 11 }}>
            Use the publishing panel to review changes and create a pull
            request.
          </p>
        </>
      ) : (
        <>
          {inviteDismissed ? (
            <button
              type="button"
              onClick={() => setInviteDismissed(false)}
              style={buttonStyle}
            >
              <Github size={15} />
              Connect GitHub (optional)
            </button>
          ) : (
            <>
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                Want to work with GitHub repositories? Connect your account when
                you're ready. You can continue using FORGEX without signing in.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={!status?.configured}
                  onClick={connect}
                >
                  <Github size={15} />
                  Connect GitHub
                </button>

                <button
                  type="button"
                  onClick={() => setInviteDismissed(true)}
                  style={{
                    ...buttonStyle,
                    background: "transparent",
                    color: "#aebfc6",
                  }}
                >
                  Maybe later
                </button>
              </div>
            </>
          )}
        </>
      )}

      {status && !status.configured && (
        <p role="status" style={{ fontSize: 11 }}>
          Configure your GitHub App in .env.local first.
        </p>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 11, color: "#f5b1a9" }}>
          {error}
        </p>
      )}
    </section>
  );
}
