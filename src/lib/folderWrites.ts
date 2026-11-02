import { safeIdePath } from "./paths";

export type WorkspaceDirectoryHandle = {
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<WorkspaceDirectoryHandle>;
  getFileHandle(name: string, options: { create: boolean }): Promise<{
    getFile(): Promise<File>;
    createWritable(): Promise<{ write(content: string | Uint8Array<ArrayBuffer>): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
  }>;
};
export type FolderFile = { path: string; bytes: Uint8Array<ArrayBuffer> };
export type FolderChange = FolderFile & { before: string | null };
export class FolderWriteError extends Error {
  constructor(message: string, readonly written: number) { super(`${message} ${written} file(s) saved before stopping.`); }
}
const digest = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map(byte => byte.toString(16).padStart(2, "0")).join("");
function checkPath(path: string) {
  if (safeIdePath(path) !== path) throw new Error("Invalid folder write path.");
}
async function targetFingerprint(root: WorkspaceDirectoryHandle, path: string): Promise<string | null> {
  checkPath(path);
  try {
    const parts = path.split("/"); let folder = root;
    for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create: false });
    const file = await (await folder.getFileHandle(parts[parts.length - 1], { create: false })).getFile();
    if (file.size > 2_000_000) throw new Error(`Target file is too large to compare safely: ${path}`);
    return digest(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return null;
    throw error;
  }
}
export async function prepareFolderWrites(root: WorkspaceDirectoryHandle, files: readonly FolderFile[]): Promise<FolderChange[]> {
  const changes: FolderChange[] = []; const seen = new Set<string>();
  for (const entry of files) {
    checkPath(entry.path);
    if (seen.has(entry.path.toLowerCase())) throw new Error("Duplicate folder write path.");
    seen.add(entry.path.toLowerCase());
    const before = await targetFingerprint(root, entry.path);
    if (before !== await digest(entry.bytes)) changes.push({ path: entry.path, bytes: entry.bytes.slice(), before });
  }
  return changes;
}
export async function writeFolderChanges(root: WorkspaceDirectoryHandle, changes: readonly FolderChange[]): Promise<number> {
  let written = 0;
  try {
    for (const file of changes) if (await targetFingerprint(root, file.path) !== file.before) throw new Error(`External change detected: ${file.path}.`);
    for (const file of changes) {
      if (await targetFingerprint(root, file.path) !== file.before) throw new Error(`External change detected: ${file.path}.`);
      const parts = file.path.split("/"); let folder = root;
      for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create: true });
      const handle = await folder.getFileHandle(parts[parts.length - 1], { create: true });
      const stream = await handle.createWritable();
      try { await stream.write(file.bytes); await stream.close(); }
      catch (error) { await stream.abort?.().catch(() => {}); throw error; }
      written++;
    }
    return written;
  } catch (error) { throw new FolderWriteError(error instanceof Error ? error.message : "Folder save failed.", written); }
}
