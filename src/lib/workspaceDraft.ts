import type { SourceFile } from "./analyzer";
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
  files: SourceFile[];
  baselineFiles: SourceFile[];
  githubBaselineFiles?: SourceFile[] | null;
  selectedPath: string;
  repoUrl: string;
  repoIdentity: RepoIdentity | null;
};

const DB_NAME = "forgex-local-workspace-v2";
const STORE_NAME = "drafts";
const KEY = "active";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

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

function verifyDraft(value: WorkspaceDraft): WorkspaceDraft {
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

return {
  savedAt: value.savedAt,
  repoIdentity,
  files,
  baselineFiles,
  githubBaselineFiles,

selectedPath: files.some(
  (file) => file.path === value.selectedPath
)
  ? value.selectedPath
  : files[0]?.path ?? "",

    repoUrl: typeof value.repoUrl === "string" ? value.repoUrl : "",
  };
}

export async function readWorkspaceDraft(): Promise<WorkspaceDraft | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let raw: WorkspaceDraft | undefined;

    const transaction = db.transaction(STORE_NAME, "readonly");

    const request = transaction.objectStore(STORE_NAME).get(KEY);

    request.onsuccess = () => {
      raw = request.result as WorkspaceDraft | undefined;
    };

    transaction.oncomplete = () => {
      db.close();

      try {
        resolve(raw ? verifyDraft(raw) : null);
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

    transaction.objectStore(STORE_NAME).delete(KEY);

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
