"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Github, LogOut, RefreshCw } from "lucide-react";
import { saveWorkspaceDraft, type RepoIdentity } from "@/lib/workspaceDraft";
import type { PreviewBinaryAsset } from "@/lib/previewAssets";
import { useAppConfirm } from "./AppConfirmProvider";
import styles from "./GitHubConnect.module.css";

type Status = { connected: boolean; configured: boolean; login?: string; name?: string; avatarUrl?: string; profileUrl?: string };
type RecoveryFile = { path: string; content: string };

export default function GitHubConnect({ hasWorkspace, currentFiles, assets, selectedPath, baselineFiles, githubBaselineFiles, repoIdentity, repoUrl }: {
  hasWorkspace: boolean;
  assets: PreviewBinaryAsset[];
  selectedPath?: string;
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
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (busy) return;
    let cancelled = false;
    let pending: AbortController | null = null;
    async function refresh() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch("/api/github/session", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Connection unavailable");
        const data = await response.json() as Status;
        if (!cancelled) { setStatus(data); setError(""); }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setStatus(null);
          setError("Cannot check GitHub right now.");
        }
      }
    }
    const onFocus = () => { void refresh(); };
    void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => { cancelled = true; pending?.abort(); window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [retry, busy]);

  async function connect() {
    if (busy || !status?.configured) return;
    setError("");
    if (hasWorkspace) {
      const confirmed = await confirmAction({
        title: "Connect your GitHub account",
        message: "GitHub authorization will temporarily leave FORGEX. Your workspace will be saved on this device for recovery when you return. Export a project backup for an additional copy.",
        confirmText: "Connect GitHub", cancelText: "Cancel",
      });
      if (!confirmed) return;
      try {
        const savedAt = Date.now();
        await saveWorkspaceDraft({ savedAt, files: [...currentFiles], assets,
          baselineFiles: [...baselineFiles], githubBaselineFiles: githubBaselineFiles ? [...githubBaselineFiles] : null,
          selectedPath: selectedPath ?? currentFiles[0]?.path ?? assets[0]?.path ?? "", repoIdentity, repoUrl });
        sessionStorage.setItem("forgex-oauth-recovery-v1", JSON.stringify({ savedAt, storage: "indexeddb" }));
      } catch {
        setError("Browser storage is full or unavailable. Export a project backup before connecting.");
        return;
      }
    }
    setBusy(true);
    window.location.assign("/api/github/connect");
  }

  async function disconnect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/github/session", { method: "POST" });
      if (!response.ok) throw new Error("Disconnect failed");
      setStatus(previous => ({ connected: false, configured: previous?.configured ?? false }));
    } catch { setError("Could not disconnect. Try again."); }
    finally { setBusy(false); }
  }

  const connected = status?.connected && status.login;
  return (
    <section className={styles.connection} aria-label="GitHub account">
      {connected ? (
        <details className={styles.account}>
          <summary>
            {status.avatarUrl ? <img className={styles.avatar} src={status.avatarUrl} alt="" width={28} height={28} referrerPolicy="no-referrer" /> : <Github size={22} />}
            <span className={styles.identity}><strong>{status.name || `@${status.login}`}</strong><span className={styles.connected}><Check size={11} /> Connected</span></span>
            <ChevronDown size={14} />
          </summary>
          <div className={styles.panel}>
            <p>Signed in as <strong>@{status.login}</strong></p>
            {status.profileUrl ? <a href={status.profileUrl} target="_blank" rel="noopener noreferrer">View GitHub profile</a> : null}
            <p>Use Repository to import a project. Review your changes before publishing a pull request.</p>
            <button type="button" className={styles.disconnect} disabled={busy} onClick={() => void disconnect()}><LogOut size={14} />{busy ? "Disconnecting…" : "Disconnect"}</button>
          </div>
        </details>
      ) : (
        <button type="button" className={styles.connect} disabled={busy || !status?.configured} onClick={() => void connect()}>
          <Github size={16} />{busy ? "Connecting…" : status ? "Connect GitHub" : error ? "GitHub unavailable" : "Checking GitHub…"}
        </button>
      )}
      {status && !status.configured ? <p className={styles.status}>GitHub connection is temporarily unavailable. Guest editing is available.</p> : null}
      {error ? <div role="status" className={styles.status}>{error} <button type="button" className={styles.retry} disabled={busy} onClick={() => setRetry(n => n + 1)}><RefreshCw size={12} /> Retry</button></div> : null}
    </section>
  );
}
