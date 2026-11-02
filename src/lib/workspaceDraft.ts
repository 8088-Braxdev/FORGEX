import type { SourceFile } from "./analyzer";
import { validatePreviewAssets, type PreviewBinaryAsset } from "./previewAssets";
import { validateWorkspace } from "./ideCore";

export type RepoIdentity = {
  fullName: string;
  branch: string;
  commitSha: string;
  partial: boolean;
  importedPaths: string[];
};

export type WorkspaceDraft = {
  savedAt: number;
  assets?: PreviewBinaryAsset[];
  files: SourceFile[];
  baselineFiles: SourceFile[];
  githubBaselineFiles?: SourceFile[] | null;
  selectedPath: string;
  repoUrl: string;
  repoIdentity: RepoIdentity | null;
};

const DB_NAME = "forgex-local-workspace-v3";
const LEGACY_DB_NAME = "forgex-local-workspace-v2";
const STORE_NAME = "drafts";
const KEY = "active";

function openDatabase(name = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => reject(request.error);

    request.onblocked = () =>
      reject(new Error("Workspace storage is blocked."));
  });
}

export function verifyDraft(value: WorkspaceDraft): WorkspaceDraft {
  if (!value || !Number.isFinite(value.savedAt)) {
    throw new Error("Invalid workspace recovery data.");
  }


const files =
  Array.isArray(value.files) && value.files.length === 0
    ? []
    : validateWorkspace(value.files);


  const baselineFiles = value.baselineFiles?.length
    ? validateWorkspace(value.baselineFiles)
    : [];

  const githubBaselineFiles =
    Array.isArray(value.githubBaselineFiles) &&
    value.githubBaselineFiles.length > 0
      ? validateWorkspace(value.githubBaselineFiles)
      : null;
  const savedRepo = value.repoIdentity;


  const repoIdentity: RepoIdentity | null =
    savedRepo &&
    typeof savedRepo.fullName === "string" &&
    /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(savedRepo.fullName) &&
    typeof savedRepo.branch === "string" &&
    savedRepo.branch.length > 0 &&
    typeof savedRepo.commitSha === "string" &&
    /^[a-f0-9]{40,64}$/i.test(savedRepo.commitSha) &&
    Array.isArray(savedRepo.importedPaths)
      ? {
          fullName: savedRepo.fullName,
          branch: savedRepo.branch,
          commitSha: savedRepo.commitSha,
          partial: savedRepo.partial === true,
importedPaths: [
  ...new Set(
    savedRepo.importedPaths.filter(
      (path) =>
        typeof path === "string" &&
        path.length > 0 &&
        path.length <= 500 &&
        !path.startsWith("/") &&
        !path.includes("\\") &&
        !path.split("/").some(
          (part) => !part || part === "." || part === ".."
        ) &&
        !/[\u0000-\u001f]/.test(path)
    )
  ),
],
        }
      : null;

const assets = validatePreviewAssets(value.assets ?? [], files.map(file => file.path));

return {
  savedAt: value.savedAt,
  assets,
  repoIdentity,
  files,
  baselineFiles,
  githubBaselineFiles,

selectedPath: [...files, ...assets].some(
  (file) => file.path === value.selectedPath
)
  ? value.selectedPath
  : files[0]?.path ?? assets[0]?.path ?? "",

    repoUrl: typeof value.repoUrl === "string" ? value.repoUrl : "",
  };
}

async function readDraft(name: string): Promise<{ found: boolean; draft: WorkspaceDraft | null }> {
  const db = await openDatabase(name);

  return new Promise((resolve, reject) => {
    let raw: WorkspaceDraft | null | undefined;

    const transaction = db.transaction(STORE_NAME, "readonly");

    const request = transaction.objectStore(STORE_NAME).get(KEY);

    request.onsuccess = () => {
      raw = request.result as WorkspaceDraft | null | undefined;
    };

    transaction.oncomplete = () => {
      db.close();

      try {
        resolve({ found: raw !== undefined, draft: raw ? verifyDraft(raw) : null });
      } catch (error) {
        reject(error);
      }
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function readWorkspaceDraft(): Promise<WorkspaceDraft | null> {
  const current = await readDraft(DB_NAME);
  if (current.found) return current.draft;
  const legacy = await readDraft(LEGACY_DB_NAME);
  if (legacy.draft) await saveWorkspaceDraft(legacy.draft);
  else await clearWorkspaceDraft();
  return legacy.draft;
}

export async function saveWorkspaceDraft(value: WorkspaceDraft): Promise<void> {
  const safe = verifyDraft(value);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    transaction.objectStore(STORE_NAME).put(safe, KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function clearWorkspaceDraft(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");

    // A tombstone prevents cleared drafts from being resurrected from legacy storage.
    transaction.objectStore(STORE_NAME).put(null, KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}
