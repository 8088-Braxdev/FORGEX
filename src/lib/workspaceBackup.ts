import { parseBackup } from "./ideCore";
import { verifyDraft, type WorkspaceDraft } from "./workspaceDraft";

export const MAX_BACKUP_BYTES = 18_000_000;
export function exportWorkspaceBackup(draft: WorkspaceDraft): string {
  const safe = verifyDraft(draft);
  const text = JSON.stringify({ format: "forgex-workspace", version: 2, ...safe });
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup exceeds 18 MB. Use Save folder or reduce the workspace before exporting.");
  return text;
}
export function parseWorkspaceBackup(text: string): WorkspaceDraft {
  if (text.length > MAX_BACKUP_BYTES || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new Error("Backup is too large.");
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || !("format" in value) || value.format !== "forgex-workspace" || !("version" in value)) throw new Error("Unsupported FORGEX backup.");
  if (value.version === 1) {
    const files = parseBackup(text);
    return { savedAt: Date.now(), files, baselineFiles: files.map(file => ({ ...file })), assets: [], selectedPath: files[0]?.path ?? "", repoUrl: "", repoIdentity: null };
  }
  if (value.version !== 2) throw new Error("Unsupported FORGEX backup version.");
  return verifyDraft(value as unknown as WorkspaceDraft);
}
