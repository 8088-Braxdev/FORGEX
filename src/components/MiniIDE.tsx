"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Monaco as MonacoApi } from "@monaco-editor/react";
import { loader as monacoLoader } from "@monaco-editor/react";
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  FileCode2,
  FilePlus2,
  Files,
  Folder,
  FolderDown,
  GitBranch,
  HardDriveDownload,
  Languages,
  Maximize2,
  Minimize2,
  MonitorPlay,
  PanelBottom,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Terminal,
  Upload,
  X,
  Trash2,
  AlertCircle,
  Command,
  Ellipsis,
} from "lucide-react";
import { analyzeProject, type Finding, type SourceFile } from "@/lib/analyzer";
import {
  detectPreviewLimits,
  type PreviewLimitSignals,
} from "@/lib/previewLimits";
import type { WorkspaceDraft, RepoIdentity } from "../lib/workspaceDraft";
import AppNotice from "./AppNotice";
import ImageViewer from "./ImageViewer";
import { prepareFolderWrites, writeFolderChanges, type WorkspaceDirectoryHandle as DirectoryHandle } from "@/lib/folderWrites";
import { exportWorkspaceBackup, parseWorkspaceBackup, MAX_BACKUP_BYTES } from "@/lib/workspaceBackup";
import ApiRequestTester from "./ApiRequestTester";
import {
  buildPreview,
  ideLanguage,
  languageTotals,
  explainRuntimeError,
  explainDiagnostic,
  safeIdePath,
  starterProject,
  validateWorkspace,
  IDE_MAX_FILES,
} from "../lib/ideCore";

import {
  readPreviewBinaryAsset,
  svgPreviewUrl,
  MAX_PREVIEW_IMAGE_BYTES,
  MAX_PREVIEW_IMAGE_TOTAL_BYTES,
  MAX_PREVIEW_IMAGES,
  type PreviewBinaryAsset,
} from "../lib/previewAssets";

import SourceControlPanel from "./SourceControlPanel";
import { useAppConfirm } from "./AppConfirmProvider";
if (typeof window !== "undefined") {
  monacoLoader.config({ paths: { vs: "/monaco/vs" } });
}

const Monaco = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const DRAFT_KEY = "forgex-mini-ide-v1";

const FOLDER_NAME_KEY = "forgex:folder-name:v1";

const EMPTY_DISABLED_RULES: string[] = [];
const EMPTY_BASELINE_FILES: SourceFile[] = [];
type Destination = "health" | "security" | "release" | "rules" | "history";

type SideView = "files" | "search" | "languages" | "insights" | "changes";

type MobileView =
  | "files"
  | "editor"
  | "preview"
  | "console"
  | "insights"
  | "changes";

type LogLevel = "log" | "info" | "warn" | "error";
type PreviewLog = {
  id: number;
  level: LogLevel;
  text: string;
  source?: string;
  line?: number;
  column?: number;
};

type NetworkRecord = {
  key: string;
  path: string;
  status: number;
  durationMs: number;
  method?: string;
  url?: string;
  via?: "direct" | "proxy";
  error?: string;
};

const SENSITIVE_NETWORK_PARAM =
  /(^|[-_])(key|token|secret|auth|api[-_]?key|password)$/i;

function sanitizeNetworkUrl(raw: string): string {
  const queryIndex = raw.indexOf("?");
  if (queryIndex === -1) return raw;
  const hashIndex = raw.indexOf("#", queryIndex);
  const base = raw.slice(0, queryIndex);
  const query = raw.slice(
    queryIndex + 1,
    hashIndex === -1 ? undefined : hashIndex,
  );
  const hash = hashIndex === -1 ? "" : raw.slice(hashIndex);
  const parts = query.split("&").map((part) => {
    const equals = part.indexOf("=");
    if (equals === -1) return part;
    let name = part.slice(0, equals);
    try {
      name = decodeURIComponent(name);
    } catch {
      // Keep the encoded parameter name.
    }
    return SENSITIVE_NETWORK_PARAM.test(name)
      ? `${part.slice(0, equals)}=***`
      : part;
  });
  return `${base}?${parts.join("&")}${hash}`;
}

const PREVIEW_LIMITS_MESSAGE =
  "This preview runs in a browser sandbox. It cannot run backend code (API routes, servers) or read .env secrets, so calls to /api/... fail. Calls to public HTTPS APIs work (CORS handled by our proxy). To test backend features, run the project locally or deploy it.";

const PREVIEW_LIMITS_ENV_MESSAGE =
  "Environment variables are not available in the preview. Do not paste real secret keys into project files; they would be visible in the browser.";

const PREVIEW_BRIDGE_PATHS = new Set([
  "/api/preview/ai",
  "/api/preview/health",
  "/api/preview/gateway",
]);

function isBlockedRelativeApiRequest(url: string): boolean {
  if (!url.startsWith("/api/")) return false;

  const path = url.split(/[?#]/, 1)[0];

  return !PREVIEW_BRIDGE_PATHS.has(path);
}

type IdeDiagnostic = {
  id: string;
  path: string;
  line: number;
  column: number;
  severity: "error" | "warn" | "info";
  message: string;
};
type Props = {
  files: SourceFile[];
  assets: PreviewBinaryAsset[];
  onRestoreWorkspace: (draft: WorkspaceDraft) => void;
  selectedPath: string;
  focusRequest?: { path: string; line?: number; id: number };
  externalImportKey?: number;
  baselineFiles?: SourceFile[];
  githubBaselineFiles: SourceFile[] | null;
  repoIdentity: RepoIdentity | null;
  repoUrl: string;
  onCaptureBaseline?: () => void;
  onSelectFile: (path: string) => void;
  onChangeFile: (path: string, content: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile?: (path: string) => void;
  disabledRules?: string[];
  onNewProject: (files: SourceFile[], assets?: PreviewBinaryAsset[]) => void;
  onAnalyze: () => void;
  analyzing?: boolean;
  healthScore?: number | null;
  onNavigate?: (destination: Destination) => void;
  onImportFiles?: () => void;
  onImportRepository?: () => void;
  repositoryPanel?: ReactNode;
};
type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
  files: string[];
};
type EditorRef = {
  revealLineInCenter(line: number): void;
  setPosition(position: { lineNumber: number; column: number }): void;
  getModel?(): { uri: { path: string } } | null;
  focus(): void;
};
type DirectoryPicker = Window & {
  showDirectoryPicker?: (options?: {
    mode: "readwrite";
  }) => Promise<DirectoryHandle>;
};

function makeTree(files: readonly { path: string }[]): FolderNode {
  const root: FolderNode = { name: "ROOT", path: "", children: [], files: [] };
  for (const file of files) {
    const parts = file.path.replace(/\\/g, "/").split("/");
    let node = root;
    for (const folder of parts.slice(0, -1)) {
      let next = node.children.find((child) => child.name === folder);
      if (!next) {
        next = {
          name: folder,
          path: node.path ? `${node.path}/${folder}` : folder,
          children: [],
          files: [],
        };
        node.children.push(next);
      }
      node = next;
    }
    node.files.push(file.path);
  }
  function sort(node: FolderNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.files.sort((a, b) => a.localeCompare(b));
    node.children.forEach(sort);
  }
  sort(root);
  return root;
}

function downloadText(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function languageColor(path: string) {
  const name = ideLanguage(path).name;
  const colors: Record<string, string> = {
    JavaScript: "#ead36f",
    TypeScript: "#75aaff",
    HTML: "#ecaa76",
    CSS: "#a5b7fc",
    Python: "#88d4b1",
    JSON: "#d1b5e9",
    Markdown: "#a5c0cc",
    PHP: "#a9a5f4",
    Go: "#82d3da",
    Rust: "#dfb28e",
    Java: "#e5b07e",
    "C++": "#91b7e9",
  };
  return colors[name] ?? "#b4c3ce";
}

export default function MiniIDE({
  files,
  assets: previewBinaryAssets,
  onRestoreWorkspace,
  selectedPath,
  focusRequest,
  externalImportKey,
  onSelectFile,
  onChangeFile,
  onCreateFile,
  onDeleteFile,
  disabledRules = EMPTY_DISABLED_RULES,
  onNewProject,
  onAnalyze,
  analyzing = false,
  healthScore,
  onNavigate,
  onImportFiles,
  onImportRepository,
  repositoryPanel,
  baselineFiles = EMPTY_BASELINE_FILES,
  githubBaselineFiles,
  repoIdentity,
  repoUrl,
  onCaptureBaseline,
}: Props) {
  const confirmAction = useAppConfirm();
  const [expanded, setExpanded] = useState(false);

  const [showExpandTip, setShowExpandTip] = useState(false);

  useEffect(() => {
    try {
      setShowExpandTip(
        localStorage.getItem("forgex-expand-tip-dismissed-v1") !== "1",
      );
    } catch {
      setShowExpandTip(true);
    }
  }, []);

  function dismissExpandTip() {
    setShowExpandTip(false);

    try {
      localStorage.setItem("forgex-expand-tip-dismissed-v1", "1");
    } catch {
      // The tip remains dismissed for this session.
    }
  }

  const [sideView, setSideView] = useState<SideView>("files");
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [smallScreen, setSmallScreen] = useState(false);
  const [toolbarSize, setToolbarSize] = useState({ compact: false, narrow: false });
  const compactToolbar = smallScreen || toolbarSize.compact;
  const [previewVisible, setPreviewVisible] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(true);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [editorClosed, setEditorClosed] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [localFolderName, setLocalFolderName] = useState<string | null>(null);

  const [workspaceNameOpen, setWorkspaceNameOpen] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState("");
  const workspaceNameDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = workspaceNameDialogRef.current;
    if (!dialog) return;

    if (workspaceNameOpen && !dialog.open) {
      dialog.showModal();
    } else if (!workspaceNameOpen && dialog.open) {
      dialog.close();
    }
  }, [workspaceNameOpen]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(FOLDER_NAME_KEY);

      if (saved && saved.length <= 80) {
        setLocalFolderName(saved);
      }
    } catch {
      // Session storage may be unavailable.
    }
  }, []);

  function rememberFolderName(value: string | null) {
    const name = value?.trim().slice(0, 80) || null;

    setLocalFolderName(name);

    try {
      if (name) {
        sessionStorage.setItem(FOLDER_NAME_KEY, name);
      } else {
        sessionStorage.removeItem(FOLDER_NAME_KEY);
      }
    } catch {
      // The name remains available in the current session.
    }
  }

  const [codeSearch, setCodeSearch] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [svgSourcePath, setSvgSourcePath] = useState("");

  const [previewAiRoute, setPreviewAiRoute] = useState("/api/chat");

  const [previewAiEnabled, setPreviewAiEnabled] = useState(false);

  const [previewEntry, setPreviewEntry] = useState("");
  const [previewDirty, setPreviewDirty] = useState(true);
  const [logs, setLogs] = useState<PreviewLog[]>([]);
  const [networkRecords, setNetworkRecords] = useState<NetworkRecord[]>([]);

  const [networkFilter, setNetworkFilter] = useState<
    "all" | "success" | "error"
  >("all");

  const [networkSearch, setNetworkSearch] = useState("");

  const visibleNetworkRecords = networkRecords
    .filter((record) => {
      const matchesStatus =
        networkFilter === "all" ||
        (networkFilter === "success" &&
          record.status >= 200 &&
          record.status < 300) ||
        (networkFilter === "error" &&
          (record.status === 0 || record.status >= 400));

      const searchableText = [
        record.method ?? "",
        record.url ?? record.path,
        record.path,
        record.error ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(
        networkSearch.trim().toLowerCase(),
      );

      return matchesStatus && matchesSearch;
    })
    .reverse();

  const [outputFilter, setOutputFilter] = useState<"all" | LogLevel>("all");

  const [outputSearch, setOutputSearch] = useState("");

  const filteredLogs = logs.filter((item) => {
    const matchesLevel = outputFilter === "all" || item.level === outputFilter;

    const query = outputSearch.trim().toLowerCase();

    const searchableText = [item.level, item.text, item.source ?? ""]
      .join(" ")
      .toLowerCase();

    return matchesLevel && (!query || searchableText.includes(query));
  });

  const [notice, setNotice] = useState("");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [previewLimitsDismissed, setPreviewLimitsDismissed] = useState(false);
  const [previewSandboxTipDismissed, setPreviewSandboxTipDismissed] = useState(() => {
    try {
      return (
        localStorage.getItem("forgex-preview-sandbox-tip-dismissed-v1") === "1"
      );
    } catch {
      return false;
    }
  });

  function dismissPreviewSandboxTip() {
    setPreviewSandboxTipDismissed(true);

    try {
      localStorage.setItem("forgex-preview-sandbox-tip-dismissed-v1", "1");
    } catch {
      // The tip remains dismissed for this session.
    }
  }

  const [previewLimitFiles, setPreviewLimitFiles] =
    useState<PreviewLimitSignals>({
      environmentSecrets: false,
      serverCode: false,
    });

  const blockedRelativeApi = networkRecords.some((record) =>
    isBlockedRelativeApiRequest(record.url ?? record.path),
  );

  const showPreviewLimits =
    !previewLimitsDismissed &&
    (blockedRelativeApi ||
      previewLimitFiles.environmentSecrets ||
      previewLimitFiles.serverCode);

  const [jumpLine, setJumpLine] = useState<number | null>(null);
  const [touched, setTouched] = useState<string[]>([]);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState(218);
  const [explorerVisible, setExplorerVisible] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(345);

  const [previewViewport, setPreviewViewport] = useState<
    "fit" | "tablet" | "mobile"
  >("fit");

  const [previewFocused, setPreviewFocused] = useState(false);

  useEffect(() => {
    if (!previewFocused) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewFocused(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewFocused]);

  const [consoleHeight, setConsoleHeight] = useState(178);
  const [ideHeight, setIdeHeight] = useState(780);
  const [resizing, setResizing] = useState<
    null | "explorer" | "preview" | "console" | "height"
  >(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 12 });

  function positionMenu(button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect();
    setMenuPosition({ top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 220)), left: Math.max(12, Math.min(rect.left, window.innerWidth - 297)) });
  }

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault(); setNewMenuOpen(false); setSaveMenuOpen(false);
      (event.currentTarget.previousElementSibling as HTMLButtonElement | null)?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
      items[next]?.focus();
    }
  }
  const [livePreview, setLivePreview] = useState(false);

  const [consoleMode, setConsoleMode] = useState<
    "problems" | "output" | "terminal" | "network" | "api"
  >("problems");

  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "FORGEX Workspace Terminal · type help",
    "Local commands only. No OS shell, Node, Git or Python execution.",
  ]);
  const [diagnostics, setDiagnostics] = useState<IdeDiagnostic[]>([]);
  const [liveSignals, setLiveSignals] = useState<Finding[]>([]);

  const htmlWarnings = useMemo<IdeDiagnostic[]>(() => {
    const nonVoidTags = new Set([
      "html",
      "head",
      "body",
      "title",
      "div",
      "span",
      "button",
      "main",
      "section",
      "article",
      "header",
      "footer",
      "nav",
      "aside",
      "form",
      "label",
      "textarea",
      "select",
      "option",
      "p",
      "a",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "script",
      "style",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]);

    const warnings: IdeDiagnostic[] = [];
    const blank = (value: string) => value.replace(/[^\r\n]/g, " ");

    for (const file of files) {
      if (!/\.html?$/i.test(file.path)) continue;

      const source = file.content
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(
          /(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi,
          (_, open: string, body: string, close: string) =>
            open + blank(body) + close,
        )
        .replace(
          /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi,
          (_, open: string, body: string, close: string) =>
            open + blank(body) + close,
        );

      const pattern = /<([a-z][a-z0-9-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*\/>/gi;

      for (const match of source.matchAll(pattern)) {
        const tag = match[1].toLowerCase();
        if (!nonVoidTags.has(tag)) continue;

        const offset = match.index ?? 0;
        const before = source.slice(0, offset);

        const line = before.split("\n").length;
        const column = offset - before.lastIndexOf("\n");

        warnings.push({
          id: `html-self-close:${file.path}:${offset}`,
          path: file.path,
          line,
          column,
          severity: "warn",
          message:
            `HTML: <${tag}/> cannot self-close in HTML. ` +
            `Use an explicit closing </${tag}> tag.`,
        });

        if (warnings.length >= 40) return warnings;
      }
    }

    return warnings;
  }, [files]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<"commands" | "files" | "line">(
    "commands",
  );
  const [paletteQuery, setPaletteQuery] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<EditorRef | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mobileGutterRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previewChannel = useRef("");
  const previewPageRef = useRef("");

  const previewTrailRef = useRef<{
    pages: string[];
    index: number;
  }>({
    pages: [],
    index: -1,
  });

  const [previewTrailButtons, setPreviewTrailButtons] = useState({
    back: false,
    forward: false,
  });

  const logId = useRef(0);
  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const monacoDiagnosticsDisposable = useRef<{ dispose(): void } | null>(null);

  const activeAsset = editorClosed ? undefined : previewBinaryAssets.find(asset => asset.path === selectedPath);
  const active = editorClosed
    ? undefined
    : (files.find((file) => file.path === selectedPath) ?? (activeAsset ? undefined : files[0]));
  const activePath = activeAsset?.path ?? active?.path;
  const svgUrl = active && /\.svg$/i.test(active.path) ? svgPreviewUrl(active.content) : null;
  const imageAsset = activeAsset ?? (active && svgUrl && svgSourcePath !== active.path ? { path: active.path, dataUrl: svgUrl } : undefined);
  const lang = ideLanguage(active?.path ?? "");
  const stats = useMemo(() => languageTotals(files), [files]);

  const previewPages = useMemo(
    () =>
      files
        .filter((file) => /\.html?$/i.test(file.path))
        .map((file) => file.path),
    [files],
  );

  const tree = useMemo(() => makeTree([...files, ...previewBinaryAssets]), [files, previewBinaryAssets]);
  const filePathSignature = [...files, ...previewBinaryAssets].map((file) => file.path).join("\u0000");

  useEffect(() => {
    previewTrailRef.current = {
      pages: [],
      index: -1,
    };

    setPreviewTrailButtons({
      back: false,
      forward: false,
    });
  }, [filePathSignature]);

  const totalLines = useMemo(
    () =>
      files.reduce((sum, file) => sum + file.content.split(/\r?\n/).length, 0),
    [files],
  );
  const matches = useMemo(() => {
    if (codeSearch.trim().length < 2)
      return [] as { path: string; line: number; snippet: string }[];
    const result: { path: string; line: number; snippet: string }[] = [];
    const query = codeSearch.toLowerCase();
    for (const file of files) {
      const lines = file.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query)) {
          result.push({
            path: file.path,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 160),
          });
          if (result.length === 60) return result;
        }
      }
    }
    return result;
  }, [files, codeSearch]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");

    const sync = () => {
      setSmallScreen(media.matches);
    };

    sync();

    media.addEventListener("change", sync);

    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => {
      const width = root.clientWidth;
      const compact = width < 1100; const narrow = width < 330;
      setToolbarSize(previous => previous.compact === compact && previous.narrow === narrow ? previous : { compact, narrow });
    };
    sync();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", sync);
      return () => window.removeEventListener("resize", sync);
    }
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);

  useEffect(() => {
    if (!activePath || editorClosed) return;
    setOpenTabs((previous) => {
      const valid = previous.filter((path) =>
        [...files, ...previewBinaryAssets].some((file) => file.path === path),
      );
      if (!valid.includes(activePath)) valid.push(activePath);
      const next = valid.slice(-20);
      return next.length === previous.length &&
        next.every((item, index) => item === previous[index])
        ? previous
        : next;
    });
  }, [activePath, filePathSignature, editorClosed]);

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!newMenuRef.current?.contains(event.target)) setNewMenuOpen(false);
      if (!saveMenuRef.current?.contains(event.target)) setSaveMenuOpen(false);
    }
    function keys(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setNewMenuOpen(false);
        setSaveMenuOpen(false);
        setPaletteOpen(false);
        setNewFileOpen(false);
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        rootRef.current?.contains(document.activeElement)
      ) {
        const key = event.key.toLowerCase();

        if (key === "p" && event.shiftKey) {
          event.preventDefault();
          setPaletteMode("commands");
          setPaletteQuery("");
          setPaletteOpen(true);
        } else if (key === "p" && !event.shiftKey) {
          event.preventDefault();
          setPaletteMode("files");
          setPaletteQuery("");
          setPaletteOpen(true);
        } else if (key === "g" && !event.shiftKey) {
          event.preventDefault();
          setPaletteMode("line");
          setPaletteQuery("");
          setPaletteOpen(true);
        }
      }
    }
    document.addEventListener("pointerdown", closeMenus, true);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("pointerdown", closeMenus, true);
      document.removeEventListener("keydown", keys);
    };
  }, []);

  useEffect(() => {
    return () => {
      monacoDiagnosticsDisposable.current?.dispose();
    };
  }, []);

  const activePathRef = useRef("");
  activePathRef.current = active?.path ?? "";

  const updateDiagnostics = useCallback(() => {
    const monaco = monacoRef.current;
    const currentModel = editorRef.current?.getModel?.();
    const path = activePathRef.current;
    if (!monaco || !currentModel || !path) {
      setDiagnostics([]);
      return;
    }
    // Get the real Monaco text model so TypeScript retains the full URI type.
    const model = monaco.editor
      .getModels()
      .find(
        (candidate: { uri: { path: string } }) =>
          candidate.uri.path === currentModel.uri.path,
      );
    if (!model || !decodeURIComponent(model.uri.path).endsWith("/" + path)) {
      setDiagnostics([]);
      return;
    }
    const markers = monaco.editor.getModelMarkers({ resource: model.uri });
    setDiagnostics(
      markers.slice(0, 120).map(
        (
          marker: {
            startLineNumber: number;
            startColumn: number;
            severity: number;
            message: string;
          },
          index: number,
        ) => ({
          id: `${path}:${marker.startLineNumber}:${index}`,
          path,
          line: marker.startLineNumber,
          column: marker.startColumn,
          severity:
            marker.severity >= 8
              ? "error"
              : marker.severity >= 4
                ? "warn"
                : "info",
          message: marker.message,
        }),
      ),
    );
  }, []);

  useEffect(() => {
    updateDiagnostics();
  }, [active?.path, active?.content, updateDiagnostics]);

  useEffect(() => {
    // Advisory quick scan, debounced; no source execution and no health-score mutation.
    const timer = window.setTimeout(() => {
      const chars = files.reduce((sum, file) => sum + file.content.length, 0);
      if (chars > 1_500_000) {
        setLiveSignals([]);
        return;
      }
      try {
        setLiveSignals(
          analyzeProject(files, disabledRules).findings.slice(0, 20),
        );
      } catch {
        setLiveSignals([]);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [files, disabledRules]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setPreviewLimitFiles(detectPreviewLimits(files));
      } catch {
        setPreviewLimitFiles({ environmentSecrets: false, serverCode: false });
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [files]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      if (!("kind" in data) || data.kind !== "forgex-preview-log") return;
      if (!("channel" in data) || data.channel !== previewChannel.current)
        return;
      if (!("level" in data) || typeof data.level !== "string") return;
      if (!("text" in data) || typeof data.text !== "string") return;
      if (!["log", "info", "warn", "error"].includes(data.level)) return;
      const level = data.level as LogLevel;
      const source =
        "source" in data && typeof data.source === "string"
          ? data.source.slice(0, 260)
          : undefined;
      const line =
        "line" in data &&
        typeof data.line === "number" &&
        Number.isFinite(data.line)
          ? Math.max(1, Math.trunc(data.line))
          : undefined;
      const column =
        "column" in data &&
        typeof data.column === "number" &&
        Number.isFinite(data.column)
          ? Math.max(1, Math.trunc(data.column))
          : undefined;
      const entry: PreviewLog = {
        id: ++logId.current,
        level,
        text: data.text.slice(0, 1800),
        source,
        line,
        column,
      };
      setLogs((previous) => [...previous, entry].slice(-200));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    function onNetworkMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== "null") return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      if (!("kind" in data) || data.kind !== "forgex-preview-network") return;
      if (!("channel" in data) || data.channel !== previewChannel.current)
        return;
      if (
        !("id" in data) ||
        typeof data.id !== "number" ||
        !Number.isSafeInteger(data.id) ||
        data.id < 1
      )
        return;
      if (!("method" in data) || typeof data.method !== "string") return;
      if (!("url" in data) || typeof data.url !== "string") return;
      if (
        !("status" in data) ||
        typeof data.status !== "number" ||
        !Number.isFinite(data.status)
      )
        return;
      if (
        !("durationMs" in data) ||
        typeof data.durationMs !== "number" ||
        !Number.isFinite(data.durationMs)
      )
        return;
      if (!("via" in data) || (data.via !== "direct" && data.via !== "proxy"))
        return;
      if (
        "error" in data &&
        data.error !== undefined &&
        typeof data.error !== "string"
      )
        return;
      if ("ok" in data && typeof data.ok !== "boolean") return;

      const url = sanitizeNetworkUrl(data.url).slice(0, 300);
      const entry: NetworkRecord = {
        key: `${previewChannel.current}:net:${data.id}`,
        path: url,
        status: Math.max(0, Math.min(599, Math.trunc(data.status))),
        durationMs: Math.max(0, Math.round(data.durationMs)),
        method: data.method.slice(0, 16).toUpperCase(),
        url,
        via: data.via,
        error:
          "error" in data && typeof data.error === "string"
            ? data.error.slice(0, 180)
            : undefined,
      };
      setNetworkRecords((previous) => [...previous, entry].slice(-50));
    }
    window.addEventListener("message", onNetworkMessage);
    return () => window.removeEventListener("message", onNetworkMessage);
  }, []);

  useEffect(() => {
    let requestCount = 0;
    let activeChannel = "";
    let aiApprovalOpen = false;
    async function handlePreviewRequest(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== "null") return;

      const data: unknown = event.data;

      if (!data || typeof data !== "object") return;
      if (!("kind" in data) || data.kind !== "forgex-preview-request") return;
      if (
        !("channel" in data) ||
        typeof data.channel !== "string" ||
        data.channel !== previewChannel.current
      )
        return;
      if (
        !("id" in data) ||
        !Number.isSafeInteger(data.id) ||
        typeof data.id !== "number" ||
        data.id < 1
      )
        return;

      const channel = data.channel;
      const id = data.id;

      const requestStartedAt = performance.now();

      const requestPath =
        "path" in data && typeof data.path === "string"
          ? sanitizeNetworkUrl(data.path).slice(0, 120)
          : "(unknown endpoint)";

      function reply(status: number, body: unknown) {
        if (previewChannel.current !== channel) return;
        if (event.source !== iframeRef.current?.contentWindow) return;

        setNetworkRecords((previous) =>
          [
            ...previous,
            {
              key: `${channel}:${id}`,
              path: requestPath,
              status,
              durationMs: Math.round(performance.now() - requestStartedAt),
            },
          ].slice(-50),
        );

        iframeRef.current.contentWindow?.postMessage(
          {
            kind: "forgex-preview-response",
            channel,
            id,
            status,
            body: JSON.stringify(body),
          },
          "*",
        );
      }

      if (activeChannel !== channel) {
        activeChannel = channel;
        requestCount = 0;
      }

      requestCount++;

      if (requestCount > 20) {
        reply(429, { error: "Preview request limit reached." });
        return;
      }

      if ("path" in data && data.path === "/api/preview/ai") {
        if (process.env.NODE_ENV !== "development") {
          reply(404, { error: "AI Preview is unavailable." });
          return;
        }

        const rawPrompt =
          "prompt" in data && typeof data.prompt === "string"
            ? data.prompt
            : "";

        const prompt = rawPrompt.trim();

        if (!prompt || rawPrompt.length > 500) {
          reply(400, { error: "Prompt must be 1–500 characters." });
          return;
        }

        if (aiApprovalOpen) {
          reply(429, { error: "Another AI request is awaiting approval." });
          return;
        }

        aiApprovalOpen = true;

        try {
          const approved = await confirmAction({
            title: "Allow AI request from Preview?",
            message:
              "This preview wants to send the following prompt to Gemini:\n\n" +
              prompt +
              "\n\nThe request may consume provider quota. " +
              "Do not send secrets or private project data.",
            confirmText: "Send to AI",
            cancelText: "Block Request",
          });

          if (!approved) {
            reply(403, { error: "AI request was not approved." });
            return;
          }

          if (
            previewChannel.current !== channel ||
            event.source !== iframeRef.current?.contentWindow
          ) {
            return;
          }

          const response = await fetch("/api/preview/ai", {
            method: "POST",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(28000),
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt }),
          });

          const result: unknown = await response.json();
          reply(response.status, result);
        } catch {
          reply(502, { error: "Unable to complete AI request." });
        } finally {
          aiApprovalOpen = false;
        }

        return;
      }

      if ("path" in data && data.path === "/api/preview/gateway") {
        const provider = "provider" in data ? data.provider : null;

        const action = "action" in data ? data.action : null;

        const latitude = "latitude" in data ? data.latitude : null;

        const longitude = "longitude" in data ? data.longitude : null;

        if (
          provider !== "weather" ||
          action !== "current" ||
          typeof latitude !== "number" ||
          typeof longitude !== "number" ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          reply(400, { error: "Invalid gateway request." });
          return;
        }

        // Reuse the existing permission-dialog lock.
        if (aiApprovalOpen) {
          reply(429, {
            error: "Another request is awaiting approval.",
          });
          return;
        }

        aiApprovalOpen = true;

        try {
          const approved = await confirmAction({
            title: "Allow Weather API request?",
            message:
              "This preview wants to request current weather " +
              "from Open-Meteo.\n\n" +
              `Latitude: ${latitude}\n` +
              `Longitude: ${longitude}\n\n` +
              "These coordinates will be sent to the weather provider.",
            confirmText: "Allow Request",
            cancelText: "Block Request",
          });

          if (!approved) {
            reply(403, { error: "Request denied." });
            return;
          }

          if (
            previewChannel.current !== channel ||
            event.source !== iframeRef.current?.contentWindow
          ) {
            return;
          }

          const response = await fetch("/api/preview/gateway", {
            method: "POST",
            credentials: "omit",
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider,
              action,
              latitude,
              longitude,
            }),
          });

          const result: unknown = await response.json();
          reply(response.status, result);
        } catch {
          reply(502, {
            error: "Weather request failed.",
          });
        } finally {
          aiApprovalOpen = false;
        }

        return;
      }

      if (
        !("path" in data) ||
        data.path !== "/api/preview/health" ||
        !("message" in data) ||
        typeof data.message !== "string" ||
        !data.message.trim() ||
        data.message.length > 160
      ) {
        reply(400, { error: "Invalid preview request." });
        return;
      }

      if (process.env.NODE_ENV !== "development") {
        reply(404, { error: "Preview API unavailable." });
        return;
      }

      try {
        const response = await fetch("/api/preview/health", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: data.message.trim(),
          }),
        });

        const result: unknown = await response.json();
        reply(response.status, result);
      } catch {
        reply(502, { error: "Preview backend unavailable." });
      }
    }

    window.addEventListener("message", handlePreviewRequest);

    return () => {
      window.removeEventListener("message", handlePreviewRequest);
    };
  }, [confirmAction]);

  useEffect(() => {
    if (!resizing) return;
    const previous = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor =
      resizing === "console" || resizing === "height"
        ? "row-resize"
        : "col-resize";
    document.body.style.userSelect = "none";
    function onMove(event: PointerEvent) {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (resizing === "height") {
        const root = rootRef.current?.getBoundingClientRect();
        if (root)
          setIdeHeight(Math.max(430, Math.min(1100, event.clientY - root.top)));
      } else if (resizing === "explorer") {
        setExplorerWidth(
          Math.max(155, Math.min(350, event.clientX - rect.left - 44)),
        );
      } else if (resizing === "preview") {
        // Protect at least 260px for the source editor.
        const max = Math.max(240, rect.width - 44 - 260);
        setPreviewWidth(
          Math.max(240, Math.min(max, rect.right - event.clientX)),
        );
      } else {
        setConsoleHeight(
          Math.max(
            100,
            Math.min(rect.height - 120, rect.bottom - event.clientY),
          ),
        );
      }
    }
    const end = () => setResizing(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      document.body.style.cursor = previous;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [resizing, explorerVisible, explorerWidth]);

  useEffect(() => {
    if (!jumpLine || !active || !smallScreen || mobileView !== "editor") return;
    if (textareaRef.current) {
      const text = active.content;
      let index = 0;
      for (let n = 1; n < jumpLine; n++) {
        const newline = text.indexOf("\n", index);
        if (newline === -1) break;
        index = newline + 1;
      }
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index);
    }
    setJumpLine(null);
  }, [active?.path, jumpLine, mobileView, smallScreen]);

  // External imports do not automatically execute a prior project's preview.
  useEffect(() => {
    if (externalImportKey === undefined || externalImportKey === 0) return;
    setPreviewAiEnabled(false);
    setLivePreview(false);
    setPreviewHtml(null);
    previewChannel.current = "";
    setLogs([]);
    setPreviewDirty(true);
    setEditorClosed(false);
  }, [externalImportKey]);

  // Parent navigation can reopen a closed tab and jump to a finding.
  // The id changes for repeated clicks on the same file/line.
  useEffect(() => {
    if (!focusRequest || !files.some((file) => file.path === focusRequest.path))
      return;
    setEditorClosed(false);
    setMobileView("editor");
    if (focusRequest.line) {
      const line = Math.max(1, Math.trunc(focusRequest.line));
      setJumpLine(line);
    }
  }, [focusRequest?.id]);

  // If Monaco is already mounted for the requested file, focus the actual line.
  // For a newly selected file, the Monaco onMount callback handles jumpLine.
  useEffect(() => {
    if (!jumpLine || smallScreen || !active || mobileView !== "editor") return;
    const editor = editorRef.current;
    const modelPath = editor?.getModel?.()?.uri.path;
    if (
      !editor ||
      !modelPath ||
      !decodeURIComponent(modelPath).endsWith("/" + active.path)
    )
      return;
    editor.revealLineInCenter(jumpLine);
    editor.setPosition({ lineNumber: jumpLine, column: 1 });
    editor.focus();
    setJumpLine(null);
  }, [jumpLine, active?.path, smallScreen, mobileView]);

  function selectFile(path: string, line?: number) {
    setEditorClosed(false);
    onSelectFile(path);
    setMobileView("editor");
    if (line && path === active?.path && !smallScreen && editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    } else if (line) setJumpLine(line);
  }

  function closeTab(path: string) {
    const remaining = openTabs.filter((item) => item !== path);
    setOpenTabs(remaining);
    if (activePath === path) {
      if (remaining.length) onSelectFile(remaining[remaining.length - 1]);
      else setEditorClosed(true);
    }
  }

  async function deleteFile(path: string) {
    if (!onDeleteFile) {
      setNotice("File deletion is not connected to the workspace.");
      return;
    }

    const approved = await confirmAction({
      title: "Delete file from workspace?",
      message:
        `File: ${path}\n\n` +
        "This file will be removed from the current workspace.\n\n" +
        "Files saved on your computer and your GitHub repository " +
        "will remain unchanged.\n\n" +
        "Export a project backup if you want to keep a copy.",
      confirmText: "Delete File",
      cancelText: "Keep File",
      destructive: true,
    });

    if (!approved) return;

    const remaining = files.filter((file) => file.path !== path);
    setOpenTabs((previous) => previous.filter((item) => item !== path));
    setTouched((previous) => previous.filter((item) => item !== path));
    if (!remaining.length && !previewBinaryAssets.length) setEditorClosed(true);
    else if (active?.path === path) onSelectFile(remaining[0]?.path ?? previewBinaryAssets[0].path);
    onDeleteFile(path);
    setPreviewDirty(true);
    setNotice(
      `${path} deleted from memory. Saved disk and remote repositories are unchanged.`,
    );
  }

  function changeCode(content: string) {
    if (!active) return;
    onChangeFile(active.path, content);
    setTouched((previous) =>
      previous.includes(active.path) ? previous : [...previous, active.path],
    );
    setPreviewDirty(true);
  }

  async function openDeviceFolder(selected: File[]) {
    if (!selected.length) return;

    const supported =
      /\.(js|mjs|cjs|ts|tsx|jsx|py|json|html|htm|css|md|txt|yml|yaml|xml|svg|go|rs|java|c|h|cpp|hpp|cs|php|sql|sh)$/i;

    const ignoredFolders = new Set([
      "node_modules",
      ".git",
      ".next",
      ".turbo",
      ".venv",
      "venv",
      "dist",
      "build",
      "coverage",
    ]);

    const imported: SourceFile[] = [];
    const nextBinaryAssets: PreviewBinaryAsset[] = [];
    const seen = new Set<string>();

    let binaryBytes = 0;

    let totalChars = 0;
    let skipped = 0;

    for (const file of selected) {
      const parts = file.webkitRelativePath.replace(/\\/g, "/").split("/");

      // Remove the selected folder's root name.
      const relativePath = parts.slice(1).join("/");
      const path = safeIdePath(relativePath);

      const ignored = parts
        .slice(1, -1)
        .some((part) => ignoredFolders.has(part.toLowerCase()));

      const isBinaryImage =
        path !== null && /\.(png|jpe?g|webp|gif|ico)$/i.test(path);

      if (isBinaryImage && path) {
        if (
          ignored ||
          seen.has(path.toLowerCase()) ||
          file.size > MAX_PREVIEW_IMAGE_BYTES ||
          binaryBytes + file.size > MAX_PREVIEW_IMAGE_TOTAL_BYTES ||
          nextBinaryAssets.length >= MAX_PREVIEW_IMAGES
        ) {
          skipped++;
          continue;
        }

        try {
          const image = await readPreviewBinaryAsset(file, path);

          if (image) {
            nextBinaryAssets.push(image);
            binaryBytes += file.size;
            seen.add(path.toLowerCase());
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }

        continue;
      }

      if (
        !path ||
        ignored ||
        !supported.test(path) ||
        seen.has(path.toLowerCase()) ||
        file.size > 400_000 ||
        imported.length >= IDE_MAX_FILES
      ) {
        skipped++;
        continue;
      }

      try {
        const content = await file.text();

        if (
          content.length > 400_000 ||
          totalChars + content.length > 2_000_000
        ) {
          skipped++;
          continue;
        }

        imported.push({ path, content });

        seen.add(path.toLowerCase());
        totalChars += content.length;
      } catch {
        skipped++;
      }
    }

    if (!imported.length && !nextBinaryAssets.length) {
      setNotice("No supported files were found in this folder.");
      return;
    }

    try {
      const valid = imported.length ? validateWorkspace(imported) : [];

      if (files.length > 0 || previewBinaryAssets.length > 0) {
        const approved = await confirmAction({
          title: "Open local folder?",
          message:
            `Selected folder contains ${valid.length} source files and ` +
            `${nextBinaryAssets.length} images.\n\n` +
            `Skipped files: ${skipped}.\n\n` +
            "Opening this folder will replace your current in-memory workspace. " +
            "Export a backup first if you need to keep your changes.\n\n" +
            "The current GitHub repository association will be cleared. " +
            "Files on your device and GitHub will not be modified.",
          confirmText: "Open Folder",
          cancelText: "Keep Workspace",
          destructive: true,
        });

        if (!approved) return;
      }

      // Parent resets repository identity and establishes a new baseline.
      onNewProject(valid, nextBinaryAssets);
      setPreviewAiEnabled(false);
        const rootName = selected[0]?.webkitRelativePath.split("/")[0]?.trim();

      rememberFolderName(rootName || null);
      setOpenTabs([valid[0]?.path ?? nextBinaryAssets[0].path]);
      setEditorClosed(false);
      setTouched([]);

      // Imported code must not execute automatically.
      setLivePreview(false);
      setPreviewHtml(null);
      setPreviewVisible(false);
      setPreviewFocused(false);
      setPreviewDirty(true);

      setLogs([]);
      setNetworkRecords([]);

      setNewMenuOpen(false);
      setSaveMenuOpen(false);

      setSideView("files");
      setExplorerVisible(true);
      setMobileView("editor");

      setNotice(
        `Opened ${valid.length} source files and ` +
          `${nextBinaryAssets.length} images. ` +
          `${skipped} skipped. Images are preview-only for this session.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to open this folder.",
      );
    }
  }

  function onMobileTab(tab: MobileView) {
    if (tab === "files") setSideView("files");
    if (tab === "changes") setSideView("changes");

    if (tab === "preview" && !previewHtml && livePreview) {
      refreshPreview(false);
    }

    setMobileView(tab);
  }

  const refreshPreview = useCallback(
    (reveal = true) => {
      previewChannel.current = `fx-${crypto.randomUUID()}`;

      const output = buildPreview(
        files,
        previewChannel.current,
        previewPageRef.current,
        previewBinaryAssets,
        previewAiEnabled ? previewAiRoute.trim() : "",
      );

      previewPageRef.current = output?.entry ?? "";

      setLogs([]);
      setNetworkRecords([]);
      setPreviewHtml(output?.html ?? null);
      setPreviewEntry(output?.entry ?? "");
      setPreviewDirty(false);
      if (reveal) {
        setPreviewVisible(true);
        setMobileView("preview");
      }
      if (!output && reveal)
        setNotice(
          "Preview needs an HTML entry. Static HTML/CSS/JS only; no build server or network.",
        );
    },
    [files, previewBinaryAssets, previewAiEnabled, previewAiRoute],
  );

  const navigatePreview = useCallback(
    (requested: string, action: "push" | "back" | "forward" = "push") => {
      const history = previewTrailRef.current;
      let nextPage = requested;

      if (action === "push") {
        if (!previewPages.includes(requested)) return;

        if (history.index === -1) {
          const initialPage = previewPageRef.current;

          if (previewPages.includes(initialPage)) {
            history.pages = [initialPage];
            history.index = 0;
          }
        }

        if (history.pages[history.index] !== requested) {
          history.pages = [
            ...history.pages.slice(0, history.index + 1),
            requested,
          ];

          history.index = history.pages.length - 1;
        }
      } else {
        const nextIndex = history.index + (action === "back" ? -1 : 1);

        const target = history.pages[nextIndex];

        if (!target || !previewPages.includes(target)) {
          return;
        }

        history.index = nextIndex;
        nextPage = target;
      }

      previewPageRef.current = nextPage;

      setPreviewTrailButtons({
        back: history.index > 0,
        forward: history.index < history.pages.length - 1,
      });

      refreshPreview(true);
    },
    [previewPages, refreshPreview],
  );

  useEffect(() => {
    function handlePreviewNavigation(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.origin !== "null") return;

      const data: unknown = event.data;

      if (!data || typeof data !== "object") return;

      if (
        !("kind" in data) ||
        data.kind !== "forgex-preview-navigation" ||
        !("channel" in data) ||
        data.channel !== previewChannel.current ||
        !("href" in data) ||
        typeof data.href !== "string" ||
        data.href.length > 512
      )
        return;

      try {
        const base = new URL(
          "https://preview.forgex.invalid/" +
            (previewPageRef.current || "index.html"),
        );

        const target = new URL(data.href, base);

        if (target.origin !== base.origin) return;

        const path = decodeURIComponent(target.pathname.slice(1));

        const candidates =
          path === ""
            ? ["index.html"]
            : [
                path,
                path.endsWith("/") ? `${path}index.html` : `${path}/index.html`,
                `${path}.html`,
              ];

        const page = files.find(
          (file) =>
            candidates.includes(file.path) && /\.html?$/i.test(file.path),
        );

        if (!page) {
          setNotice(
            "Preview navigation unavailable: " +
              "the linked HTML page is not loaded in this workspace.",
          );
          return;
        }

        navigatePreview(page.path);
      } catch {
        setNotice("Invalid local preview link.");
      }
    }

    window.addEventListener("message", handlePreviewNavigation);

    return () => window.removeEventListener("message", handlePreviewNavigation);
  }, [files, navigatePreview]);
  useEffect(() => {
    if (!livePreview) return;
    const timer = window.setTimeout(() => refreshPreview(false), 650);
    return () => window.clearTimeout(timer);
  }, [files, livePreview, refreshPreview]);

  // Only a user-created template enables automatic script execution. Imported repositories need Run Preview first.
  function runPreview() {
    setLivePreview(true);
    refreshPreview(true);
  }

  async function createWorkspace(template: "blank" | "web") {
    if (files.length > 0 || previewBinaryAssets.length > 0) {
      const approved = await confirmAction({
        title: "Replace current workspace?",
        message:
          `Your current workspace contains ${files.length + previewBinaryAssets.length} file(s), including ${previewBinaryAssets.length} image(s).\n\n` +
          "Replacing it will discard the current working files. " +
          "Export a project backup before continuing.\n\n" +
          "Your GitHub repository will not be modified.",
        confirmText: "Replace Workspace",
        cancelText: "Keep Workspace",
        destructive: true,
      });

      if (!approved) return;
    }

    const next =
      template === "web"
        ? starterProject()
        : [{ path: "untitled.txt", content: "" }];
    onNewProject(next);
    setPreviewAiEnabled(false);
    rememberFolderName(null);
    setTouched([]);
    setPreviewHtml(null);
    setLogs([]);
    setPreviewDirty(true);
    setOpenTabs([next[0].path]);
    setMobileView("editor");
    setNewMenuOpen(false);
    setEditorClosed(false);
    setLivePreview(template === "web");
    setPreviewVisible(template === "web");
    setNotice(
      template === "web"
        ? "Web template opened. Files remain local until you save."
        : "Blank workspace opened. Create or import files to begin.",
    );
  }

  function newDocument() {
    if (files.length >= IDE_MAX_FILES)
      return setNotice(`Limit: ${IDE_MAX_FILES} files.`);
    let n = 1;
    while (
      files.some((file) => file.path.toLowerCase() === `untitled-${n}.txt`)
    )
      n++;
    const path = `untitled-${n}.txt`;
    onCreateFile(path);
    setEditorClosed(false);
    setOpenTabs((previous) =>
      [...previous.filter((item) => item !== path), path].slice(-20),
    );
    setMobileView("editor");
    setNewMenuOpen(false);
  }

  function createFile() {
    const path = safeIdePath(newFileName.trim());
    if (!path || !path.split("/").pop()?.includes(".")) {
      setNotice("Use a safe relative filename such as src/main.ts.");
      return;
    }
    if (files.length >= IDE_MAX_FILES) {
      setNotice(`This workspace supports up to ${IDE_MAX_FILES} files.`);
      return;
    }
    if (files.some((file) => file.path.toLowerCase() === path.toLowerCase())) {
      setNotice("A file with this name already exists.");
      return;
    }
    onCreateFile(path);
    setEditorClosed(false);
    setOpenTabs((previous) =>
      [...previous.filter((item) => item !== path), path].slice(-20),
    );
    setNewFileOpen(false);
    setNewFileName("");
    setMobileView("editor");
    setPreviewDirty(true);
    setNotice(`${path} created in memory. Save to keep it.`);
  }

  function downloadFile() {
    if (!active) return;
    downloadText(
      active.path.split("/").pop() ?? "source.txt",
      active.content,
      "text/plain;charset=utf-8",
    );
    setNotice(`Downloaded ${active.path}.`);
    setSaveMenuOpen(false);
  }

  function workspaceSnapshot(): WorkspaceDraft {
    return { savedAt: Date.now(), files, assets: previewBinaryAssets, baselineFiles, githubBaselineFiles, selectedPath, repoUrl, repoIdentity };
  }

  function downloadBackup() {
    if (!files.length && !previewBinaryAssets.length) return;
    try {
      downloadText(
        "forgex-project.forgex.json",
        exportWorkspaceBackup(workspaceSnapshot()),
        "application/json;charset=utf-8",
      );
      setNotice(
        "Project backup downloaded. It includes your source code; store it privately.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    }
    setSaveMenuOpen(false);
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup is too large.");
      const draft = parseWorkspaceBackup(await file.text());
      const restored = draft.files;

      if (files.length > 0 || previewBinaryAssets.length > 0) {
        const approved = await confirmAction({
          title: "Restore project backup?",
          message:
            `Backup contains ${restored.length + (draft.assets?.length ?? 0)} file(s), including ${draft.assets?.length ?? 0} image(s).\n\n` +
            `Your current workspace contains ${files.length + previewBinaryAssets.length} file(s).\n\n` +
            "Restoring this backup will replace your current working files. " +
            "Export your current workspace first if you need to keep it.\n\n" +
            "Your GitHub repository will not be modified.",
          confirmText: "Restore Backup",
          cancelText: "Keep Workspace",
          destructive: true,
        });

        if (!approved) return;
      }

      onRestoreWorkspace(draft);
      setPreviewAiEnabled(false);
      rememberFolderName(null);
      setPreviewHtml(null);
      setLogs([]);
      setPreviewDirty(true);
      setOpenTabs(draft.selectedPath ? [draft.selectedPath] : []);
      setEditorClosed(false);
      setLivePreview(false);
      setTouched([]);
      setMobileView("editor");
      setNotice(`Restored ${restored.length + (draft.assets?.length ?? 0)} files, including ${draft.assets?.length ?? 0} images, from backup.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not import backup.",
      );
    }
  }

  function saveBrowserDraft() {
    if (!files.length && !previewBinaryAssets.length) return;
    try {
      localStorage.setItem(DRAFT_KEY, exportWorkspaceBackup(workspaceSnapshot()));
      setNotice(
        "Saved explicitly to this browser. Clear browser data to remove it.",
      );
    } catch {
      setNotice(
        "Browser storage is full or blocked. Download a project backup instead.",
      );
    }
    setSaveMenuOpen(false);
  }

  async function restoreBrowserDraft() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return setNotice("No saved browser draft found.");
      const draft = parseWorkspaceBackup(saved);
      const restored = draft.files;

      if (files.length > 0 || previewBinaryAssets.length > 0) {
        const approved = await confirmAction({
          title: "Restore saved workspace?",
          message:
            `Saved draft contains ${restored.length + (draft.assets?.length ?? 0)} file(s), including ${draft.assets?.length ?? 0} image(s).\n\n` +
            `Your current workspace contains ${files.length + previewBinaryAssets.length} file(s).\n\n` +
            "Restoring this draft will replace your current working files. " +
            "Export a project backup first if you need to keep them.\n\n" +
            "Your GitHub repository will remain unchanged.",
          confirmText: "Restore Workspace",
          cancelText: "Keep Workspace",
          destructive: true,
        });

        if (!approved) return;
      }

      onRestoreWorkspace(draft);
      setPreviewAiEnabled(false);
      rememberFolderName(null);
      setPreviewHtml(null);
      setLogs([]);
      setTouched([]);
      setPreviewDirty(true);
      setOpenTabs(draft.selectedPath ? [draft.selectedPath] : []);
      setEditorClosed(false);
      setLivePreview(false);
      setMobileView("editor");
      setNotice(`Restored ${restored.length + (draft.assets?.length ?? 0)} locally saved files, including ${draft.assets?.length ?? 0} images.`);
    } catch {
      setNotice("Saved browser draft is invalid or inaccessible.");
    }
    setSaveMenuOpen(false);
  }

  async function saveFolder() {
    setSaveMenuOpen(false);
    if (!files.length && !previewBinaryAssets.length) return;
    const picker = (window as DirectoryPicker).showDirectoryPicker;
    if (!picker) { setNotice("Folder save is unavailable here. Export a project backup instead."); return; }
    let written = 0;
    try {
      const root = await picker.call(window, { mode: "readwrite" });
      const valid = files.length ? validateWorkspace(files) : [];
      const entries = [
        ...valid.map(file => ({ path: file.path, bytes: new TextEncoder().encode(file.content) })),
        ...previewBinaryAssets.map(asset => ({ path: asset.path, bytes: Uint8Array.from(atob(asset.dataUrl.split(",")[1]), char => char.charCodeAt(0)) })),
      ];
      const changes = await prepareFolderWrites(root, entries);
      if (!changes.length) { setNotice("The selected folder already contains these files."); return; }
      const approved = await confirmAction({
        title: "Save changed files to selected folder?",
        message: `FORGEX will write ${changes.length} changed or new file(s), including images.\n\n` +
          changes.slice(0, 20).map(file => file.path).join("\n") +
          (changes.length > 20 ? `\n… and ${changes.length - 20} more.` : "") +
          "\n\nMatching files will be replaced. Other files are preserved; files removed in FORGEX are not deleted from disk. If a target changes while you review, saving stops.",
        confirmText: "Save Files", cancelText: "Cancel", destructive: true,
      });
      if (!approved) return;
      written = await writeFolderChanges(root, changes);
      setTouched([]); setNotice(`${written} changed file(s), including images, saved to the selected folder.`);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice((error instanceof Error ? error.message : "Folder save failed.") + (written ? ` ${written} file(s) were saved before stopping.` : ""));
    }
  }

  function showDestination(destination: Destination) {
    setExpanded(false);
    setExplorerVisible(false);
    onNavigate?.(destination);
    // parent owns navigation and result-anchor scrolling, not this editor
  }

  function analyzeAndOpen() {
    if (!files.length || analyzing) return;
    setSideView("insights");
    setExplorerVisible(true);
    setMobileView("insights");
    onAnalyze();
  }

  function runTerminal(raw: string) {
    const command = raw.trim();
    if (!command) return;
    const [verb, ...args] = command.split(/\s+/);
    const arg = args.join(" ");
    let output: string[] = [];
    switch (verb.toLowerCase()) {
      case "help":
        output = [
          "Commands: help, ls, pwd, cat <path>, open <path>, status, preview, analyze, files, clear, echo <text>",
          "Read-only local workspace commands. This is not your machine's shell.",
        ];
        break;
      case "pwd":
        output = ["/workspace (virtual)"];
        break;
      case "status":
        output = [
          `${files.length} source files · ${totalLines} lines · ${liveSignals.length} live FORGEX signals`,
        ];
        break;
      case "ls":
      case "files":
        output = files.length
          ? files.map((f) => f.path).slice(0, 100)
          : ["(no files)"];
        break;
      case "cat": {
        const file = files.find((f) => f.path === arg);
        output = file
          ? file.content
              .split("\n")
              .slice(0, 60)
              .map((l) => l.slice(0, 240))
          : [`File not found: ${arg}`];
        if (file && file.content.split("\n").length > 60)
          output.push("... output truncated at 60 lines");
        break;
      }
      case "open":
        if (files.some((f) => f.path === arg)) {
          selectFile(arg);
          output = [`Opened ${arg}`];
        } else output = [`File not found: ${arg}`];
        break;
      case "preview":
        runPreview();
        output = ["Preview requested (HTML/CSS/JS only)."];
        break;
      case "analyze":
        analyzeAndOpen();
        output = ["Analyzer requested."];
        break;
      case "echo":
        output = [arg.slice(0, 500)];
        break;
      case "clear":
        setTerminalLines([]);
        setTerminalInput("");
        return;
      default:
        output = [
          `Unknown command: ${verb}. Try help.`,
          "OS shell commands, package installs and Git operations are not supported here.",
        ];
    }
    setTerminalLines((prev) =>
      [...prev, `> ${command}`, ...output].slice(-220),
    );
    setTerminalInput("");
  }

  function mobileTextareaKeys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab" || !active) return;
    event.preventDefault();
    const field = event.currentTarget;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const updated =
      active.content.slice(0, start) + "  " + active.content.slice(end);
    changeCode(updated);
    requestAnimationFrame(() => field.setSelectionRange(start + 2, start + 2));
  }

  function renderTree(node: FolderNode, depth = 0): ReactNode {
    return (
      <>
        {node.children.map((child) => {
          const closed = collapsed.includes(child.path);
          return (
            <div key={child.path}>
              <button
                type="button"
                className="fxide-folder"
                style={{ paddingLeft: 10 + depth * 12 }}
                onClick={() =>
                  setCollapsed((previous) =>
                    closed
                      ? previous.filter((item) => item !== child.path)
                      : [...previous, child.path],
                  )
                }
                aria-expanded={!closed}
                title={child.path}
              >
                {closed ? (
                  <ChevronRight size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
                <Folder size={14} /> {child.name}
              </button>
              {!closed && renderTree(child, depth + 1)}
            </div>
          );
        })}
        {node.files.map((path) => (
          <button
            type="button"
            key={path}
            className={`fxide-file ${activePath === path ? "current" : ""}`}
            style={{ paddingLeft: 29 + depth * 12 }}
            title={path}
            onClick={() => selectFile(path)}
          >
            {previewBinaryAssets.some(asset => asset.path === path) ? <img src={previewBinaryAssets.find(asset => asset.path === path)!.dataUrl} alt="" width={18} height={18} style={{ objectFit: "contain" }} /> : <FileCode2 size={14} style={{ color: languageColor(path) }} />}
            <span>{path.split("/").pop()}</span>
            {touched.includes(path) && <i title="Modified in this session" />}
          </button>
        ))}
      </>
    );
  }

  const paletteItems = [
    {
      label: "Set Workspace Name",
      run: () => {
        setWorkspaceNameDraft(localFolderName ?? "");
        setWorkspaceNameOpen(true);
      },
    },

    {
      label: "Open Local Folder",
      run: () => folderInputRef.current?.click(),
    },
    {
      label: "Quick Open File",
      run: () => {
        setPaletteMode("files");
        setPaletteQuery("");
        setPaletteOpen(true);
      },
    },
    {
      label: "Go to Line",
      run: () => {
        setPaletteMode("line");
        setPaletteQuery("");
        setPaletteOpen(true);
      },
    },

    { label: "New file", run: () => setNewFileOpen(true) },
    { label: "Blank document", run: newDocument },
    { label: "New web project", run: () => createWorkspace("web") },
    {
      label: "Open explorer",
      run: () => {
        setSideView("files");
        setExplorerVisible(true);
      },
    },
    {
      label: "Open search",
      run: () => {
        setSideView("search");
        setExplorerVisible(true);
      },
    },
    {
      label: "Open terminal",
      run: () => {
        setConsoleVisible(true);
        setConsoleMode("terminal");
      },
    },
    { label: "Run preview", run: runPreview },
    {
      label: "Open API Tester",
      run: () => {
        setConsoleVisible(true);
        setConsoleMode("api");
        setMobileView("console");
      },
    },
    { label: "Analyze project", run: analyzeAndOpen },
    ...(onImportFiles
      ? [{ label: "Add files from PC", run: onImportFiles }]
      : []),
    ...(onImportRepository
      ? [{ label: "Import GitHub repository", run: onImportRepository }]
      : []),
    { label: "Save browser draft", run: saveBrowserDraft },
  ];

  const view: SideView =
    smallScreen && (mobileView === "insights" || mobileView === "changes")
      ? mobileView
      : sideView;

  return (
    <section
      ref={rootRef}
      id="forgex-mini-ide"
      className={`fxide fxide-v09 fxide-v10 fxide-v11 fxide-v12 ${compactToolbar ? "fxide-compact-toolbar" : ""} ${toolbarSize.narrow ? "fxide-narrow-toolbar" : ""} ${expanded ? "fxide-expanded" : ""}  ${previewFocused ? "fxide-preview-focused" : ""} ${explorerVisible ? "" : "fxide-no-explorer"} ${previewVisible ? "" : "fxide-hide-preview"} ${consoleVisible ? "" : "fxide-hide-console"}`}
      style={
        {
          "--fxide-explorer-width": `${explorerWidth}px`,
          "--fxide-preview-width": `${previewWidth}px`,
          "--fxide-console-height": `${consoleHeight}px`,
          "--fxide-height": `${ideHeight}px`,
          "--fxide-menu-top": `${menuPosition.top}px`,
          "--fxide-menu-left": `${menuPosition.left}px`,
        } as CSSProperties
      }
      aria-label="FORGEX IDE workspace"
    >
      <header className="fxide-toolbar">
        <div className="fxide-identity">
          <span className="fxide-identity-mark">
            <img src="/brand/mark-96.png" alt="" width={32} height={32} />
          </span>
          <div>
            <strong>FORGEX IDE</strong>
            <small>
              {files.length || previewBinaryAssets.length
                ? `${files.length + previewBinaryAssets.length} files · local workspace`
                : "Empty workspace"}
            </small>
          </div>
        </div>
        {!isOnline && (
          <span className="fxide-offline-badge" role="status">
            Offline
          </span>
        )}
        <div className="fxide-primary-actions">
          <button
            type="button"
            className="fxide-action-secondary"
            onClick={() => {
              setPaletteMode("commands");
              setPaletteQuery("");
              setPaletteOpen(true);
            }}
            title="Command palette (Ctrl+Shift+P)"
            aria-label="Open command palette"
          >
            <Command size={16} />
            <span>Commands</span>
          </button>
          <div className="fxide-menu-container" ref={newMenuRef}>
            <button
              type="button"
              onClick={(event) => {
                positionMenu(event.currentTarget);
                setNewMenuOpen((v) => !v);
                setSaveMenuOpen(false);
              }}
              title="Create a workspace"
              aria-label="New workspace"
              aria-expanded={newMenuOpen}
              aria-haspopup="menu"
            >
              <Plus size={16} />
              <span>New</span>
              <ChevronDown size={13} />
            </button>
            {newMenuOpen && (
              <div className="fxide-save-menu" role="menu" onKeyDown={menuKeys}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setNewMenuOpen(false);
                    setNewFileOpen(true);
                  }}
                >
                  <FilePlus2 size={15} /> New file...
                </button>
                <button type="button" role="menuitem" onClick={newDocument}>
                  <FileCode2 size={15} /> Blank document
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createWorkspace("web")}
                >
                  <MonitorPlay size={15} /> New web project
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => createWorkspace("blank")}
                >
                  <Files size={15} /> New blank workspace (replace)
                </button>
              </div>
            )}
          </div>
          {onImportFiles && (
            <button
              type="button"
              className="fxide-action-secondary"
              onClick={onImportFiles}
              title="Add source files to IDE"
              aria-label="Add files"
            >
              <Upload size={16} />
              <span>Add files</span>
            </button>
          )}

          <button
            type="button"
            className="fxide-action-secondary"
            onClick={() => folderInputRef.current?.click()}
            title="Open a local folder in FORGEX IDE"
            aria-label="Open folder from device"
          >
            <FolderDown size={16} />
            <span>Open folder</span>
          </button>

          {onImportRepository && (
            <button
              type="button"
              className="fxide-action-secondary"
              onClick={onImportRepository}
              title="Import GitHub repository"
              aria-label="Import GitHub repository"
            >
              <GitBranch size={16} />
              <span>Repository</span>
            </button>
          )}
          <button
            type="button"
            onClick={runPreview}
            title="Run HTML preview"
            aria-label="Run preview"
          >
            <Play size={16} />
            <span>{compactToolbar ? "Run" : "Run preview"}</span>
          </button>
          <button
            type="button"
            onClick={analyzeAndOpen}
            disabled={!files.length || analyzing}
            aria-label="Analyze project"
          >
            <Activity size={16} />
            <span>{analyzing ? "Analyzing" : "Analyze"}</span>
          </button>
          <div className="fxide-menu-container" ref={saveMenuRef}>
            <button
              type="button"
              onClick={(event) => {
                positionMenu(event.currentTarget);
                setSaveMenuOpen((current) => !current);
                setNewMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={saveMenuOpen}
              title={compactToolbar ? "More workspace actions" : "Save and import options"}
              aria-label={compactToolbar ? "More workspace actions" : "Save and import options"}
            >
              {compactToolbar ? <Ellipsis size={16} /> : <Save size={16} />}
              <span>{compactToolbar ? "More" : "Save"}</span>
              <ChevronDown size={13} />
            </button>
            {saveMenuOpen && (
              <div className="fxide-save-menu" role="menu" onKeyDown={menuKeys}>
                {compactToolbar && (
                  <>
                    {onImportFiles && <button type="button" role="menuitem" onClick={() => { setSaveMenuOpen(false); onImportFiles(); }}><Upload size={15} /> Add files</button>}
                    <button type="button" role="menuitem" onClick={() => { setSaveMenuOpen(false); folderInputRef.current?.click(); }}><FolderDown size={15} /> Open folder</button>
                    {onImportRepository && <button type="button" role="menuitem" onClick={() => { setSaveMenuOpen(false); onImportRepository(); }}><GitBranch size={15} /> Import repository</button>}
                    <button type="button" role="menuitem" onClick={() => { setSaveMenuOpen(false); setPaletteMode("commands"); setPaletteQuery(""); setPaletteOpen(true); }}><Command size={15} /> Command palette</button>
                    <div role="separator" className="fxide-menu-separator" />
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={downloadFile}
                  disabled={!active}
                >
                  <Download size={15} /> Download current file
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void saveFolder()}
                  disabled={!files.length && !previewBinaryAssets.length}
                >
                  <FolderDown size={15} /> Save folder (desktop)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={downloadBackup}
                  disabled={!files.length && !previewBinaryAssets.length}
                >
                  <HardDriveDownload size={15} /> Export project backup
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={saveBrowserDraft}
                  disabled={!files.length && !previewBinaryAssets.length}
                >
                  <Save size={15} /> Save browser draft
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={restoreBrowserDraft}
                >
                  <RefreshCw size={15} /> Restore browser draft
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSaveMenuOpen(false);
                    importRef.current?.click();
                  }}
                >
                  <Upload size={15} /> Import FORGEX backup
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="fxide-expand-button"
            onClick={() => setExpanded((value) => !value)}
            title={expanded ? "Exit full screen" : "Expand IDE"}
            aria-label={expanded ? "Exit full screen" : "Expand IDE"}
          >
            {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </header>

      {!expanded && showExpandTip && (
        <div className="fxide-top-guidance" role="note">
          <div className="fxide-top-guidance-text">
            <Maximize2 size={17} />

            <span>
              <strong>Get the best editing experience.</strong>{" "}
              {smallScreen
                ? "On a phone, rotate to landscape or use Expanded Mode for more space and easier debugging."
                : "Use Expanded Mode for more space, smoother navigation, and easier debugging."}
            </span>
          </div>

          <div className="fxide-top-guidance-actions">
            <button
              type="button"
              className="fxide-top-guidance-close"
              onClick={dismissExpandTip}
              aria-label="Dismiss recommendation"
              title="Dismiss recommendation"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="fxide-body" ref={bodyRef}>
        <nav className="fxide-activity" aria-label="IDE panels">
          {(
            ["files", "search", "languages", "insights", "changes"] as const
          ).map((item) => {
            const Icon =
              item === "files"
                ? Files
                : item === "search"
                  ? Search
                  : item === "languages"
                    ? Languages
                    : item === "changes"
                      ? GitBranch
                      : ShieldCheck;

            return (
              <button
                type="button"
                key={item}
                aria-label={`${item} panel`}
                className={sideView === item && explorerVisible ? "active" : ""}
                onClick={() => {
                  if (smallScreen) {
                    setMobileView(
                      item === "insights"
                        ? "insights"
                        : item === "changes"
                          ? "changes"
                          : "files",
                    );
                    setSideView(item);
                  } else if (explorerVisible && sideView === item)
                    setExplorerVisible(false);
                  else {
                    setSideView(item);
                    setExplorerVisible(true);
                  }
                }}
              >
                <Icon size={19} />
              </button>
            );
          })}
          <div className="fxide-activity-spacer" />
          <button
            type="button"
            title="Toggle preview pane"
            aria-label="Toggle preview pane"
            aria-pressed={previewVisible}
            onClick={() => setPreviewVisible((v) => !v)}
          >
            <PanelRight size={18} />
          </button>
          <button
            type="button"
            title="Toggle console pane"
            aria-label="Toggle console pane"
            aria-pressed={consoleVisible}
            onClick={() => setConsoleVisible((v) => !v)}
          >
            <PanelBottom size={18} />
          </button>
        </nav>

        <aside
          className={`fxide-sidebar ${
            mobileView === "files" ||
            mobileView === "insights" ||
            mobileView === "changes"
              ? "fxide-mobile-active"
              : ""
          }`}
          aria-label="IDE Explorer and tools"
        >
          <div className="fxide-sidebar-header">
            <strong>
              {view === "files"
                ? "EXPLORER"
                : view === "search"
                  ? "SEARCH IN FILES"
                  : view === "languages"
                    ? "LANGUAGES"
                    : view === "changes"
                      ? "SOURCE CONTROL"
                      : "FORGEX INSIGHTS"}
            </strong>

            {view === "files" && (
              <button
                type="button"
                title="Add source file"
                aria-label="Add source file"
                onClick={() => setNewFileOpen(true)}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          {smallScreen &&
            mobileView !== "insights" &&
            mobileView !== "changes" && (
              <div className="fxide-mobile-side-modes">
                <button
                  type="button"
                  className={view === "files" ? "active" : ""}
                  onClick={() => setSideView("files")}
                >
                  Files
                </button>
                <button
                  type="button"
                  className={view === "search" ? "active" : ""}
                  onClick={() => setSideView("search")}
                >
                  Search
                </button>
                <button
                  type="button"
                  className={view === "languages" ? "active" : ""}
                  onClick={() => setSideView("languages")}
                >
                  Languages
                </button>
              </div>
            )}

          {view === "changes" && (
            <div className="fxide-scroll">
              <SourceControlPanel
                baselineFiles={baselineFiles}
                currentFiles={files}
                assets={previewBinaryAssets}
                selectedPath={selectedPath}
                githubBaselineFiles={githubBaselineFiles}
                repoIdentity={repoIdentity}
                repoUrl={repoUrl}
                onOpenFile={selectFile}
                onCaptureBaseline={onCaptureBaseline}
              />
            </div>
          )}

          {view === "files" && (
            <>
              <div className="fxide-sidebar-search">
                <Search size={14} />
                <input
                  value={fileSearch}
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Filter files"
                  aria-label="Filter files"
                />
              </div>
              <div className="fxide-scroll">
                {(files.length > 0 || previewBinaryAssets.length > 0) && (
                  <div className="fxide-workspace-root">
                    <Folder size={15} />
                    <strong>
                      {repoIdentity?.fullName.split("/").pop() ||
                        localFolderName ||
                        "LOCAL WORKSPACE"}
                    </strong>
                  </div>
                )}

                {!files.length && !previewBinaryAssets.length && (
                  <p className="fxide-muted">
                    No files yet. Create a project or import source using FORGEX
                    Workbench.
                  </p>
                )}
                {fileSearch.trim()
                  ? [...files, ...previewBinaryAssets]
                      .filter((file) =>
                        file.path
                          .toLowerCase()
                          .includes(fileSearch.trim().toLowerCase()),
                      )
                      .map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          title={file.path}
                          className="fxide-search-file"
                          onClick={() => selectFile(file.path)}
                        >
                          <FileCode2 size={14} />
                          {file.path}
                        </button>
                      ))
                  : renderTree(tree)}
              </div>
            </>
          )}
          {view === "search" && (
            <>
              <div className="fxide-sidebar-search">
                <Search size={14} />
                <input
                  autoFocus
                  value={codeSearch}
                  onChange={(event) => setCodeSearch(event.target.value)}
                  placeholder="Search text in loaded files"
                  aria-label="Search file contents"
                />
              </div>
              <div className="fxide-scroll fxide-search-results">
                {codeSearch.trim().length < 2 && (
                  <p className="fxide-muted">
                    Enter at least two characters to search file contents.
                  </p>
                )}
                {codeSearch.trim().length >= 2 && matches.length === 0 && (
                  <p className="fxide-muted">
                    No matches in loaded source files.
                  </p>
                )}
                {matches.map((match, index) => (
                  <button
                    type="button"
                    key={`${match.path}:${match.line}:${index}`}
                    onClick={() => selectFile(match.path, match.line)}
                  >
                    <b>
                      {match.path}:{match.line}
                    </b>
                    <span>{match.snippet}</span>
                  </button>
                ))}
                {matches.length >= 60 && (
                  <small>Showing first 60 results.</small>
                )}
              </div>
            </>
          )}
          {view === "languages" && (
            <div className="fxide-scroll fxide-language-list">
              <p className="fxide-muted">
                Estimated from nonempty lines by file extension, not compiler
                analysis.
              </p>
              {stats.map((item) => (
                <div key={item.name} className="fxide-language-item">
                  <div>
                    <b>{item.name}</b>
                    <span>
                      {item.percent.toFixed(1)}% · {item.lines} lines
                    </span>
                  </div>
                  <div className="fxide-language-track">
                    <i style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
              {!stats.length && (
                <p className="fxide-muted">No language statistics yet.</p>
              )}
            </div>
          )}
          {view === "insights" && (
            <div className="fxide-scroll fxide-insights">
              <div className="fxide-insight-score">
                <span>Health score</span>
                <strong>
                  {healthScore === null || healthScore === undefined
                    ? "Not scanned"
                    : `${healthScore}/100`}
                </strong>
              </div>
              <button
                type="button"
                onClick={analyzeAndOpen}
                disabled={!files.length || analyzing}
              >
                <Activity size={16} /> Analyze source files{" "}
                <ArrowRight size={14} />
              </button>
              {onNavigate && (
                <>
                  <button
                    type="button"
                    onClick={() => showDestination("health")}
                  >
                    <Activity size={16} /> Project Health{" "}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showDestination("security")}
                  >
                    <ShieldCheck size={16} /> Security Center{" "}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showDestination("rules")}
                  >
                    <Code2 size={16} /> Rulebook <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showDestination("release")}
                  >
                    <GitBranch size={16} /> Release Gate{" "}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => showDestination("history")}
                  >
                    <RefreshCw size={16} /> Scan History{" "}
                    <ArrowRight size={14} />
                  </button>
                </>
              )}
              <p className="fxide-muted">
                Review changes in Source Control before publishing a pull request.
              </p>
            </div>
          )}
          <div
            className="fxide-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize explorer"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setResizing("explorer");
            }}
          />
        </aside>

        <main
          className={`fxide-editor ${mobileView === "editor" ? "fxide-mobile-active" : ""}`}
          aria-label="Code editor"
        >
          <div
            className="fxide-tabbar"
            role="tablist"
            aria-label="Open editor tabs"
          >
            {openTabs
              .filter((path) => [...files, ...previewBinaryAssets].some((file) => file.path === path))
              .map((path) => (
                <div
                  className={`fxide-editor-tab ${activePath === path ? "current" : ""}`}
                  key={path}
                  role="presentation"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activePath === path}
                    title={path}
                    onClick={() => selectFile(path)}
                  >
                    <FileCode2
                      size={14}
                      style={{ color: languageColor(path) }}
                    />
                    <span>{path.split("/").pop()}</span>
                    {touched.includes(path) && <i aria-label="Modified" />}
                  </button>
                  <button
                    type="button"
                    aria-label={`Close ${path} tab`}
                    title={`Close ${path}`}
                    className="fxide-tab-x"
                    onClick={() => closeTab(path)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            {!openTabs.length && (
              <span className="fxide-tab-empty">No editors open</span>
            )}
            <span className="fxide-tab-spacer" />
            <span className="fxide-tab-language">
              {activeAsset ? "Image" : active ? lang.name : "Text"}
            </span>
            {active && svgUrl && svgSourcePath === active.path ? <button type="button" onClick={() => setSvgSourcePath("")}>View image</button> : null}
            {active && onDeleteFile && (
              <button
                type="button"
                className="fxide-delete-file"
                onClick={() => deleteFile(active.path)}
                aria-label={`Delete ${active.path} from workspace`}
                title="Delete current file (confirm)"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="fxide-edit-area">
            {imageAsset ? <ImageViewer key={imageAsset.path} asset={imageAsset} onViewSource={svgUrl && active ? () => setSvgSourcePath(active.path) : undefined} /> : active ? (
              smallScreen ? (
                <div className="fxide-mobile-editor">
                  <div
                    className="fxide-mobile-gutter"
                    ref={mobileGutterRef}
                    aria-hidden="true"
                  >
                    {Array.from(
                      {
                        length: Math.min(
                          2500,
                          active.content.split(/\r?\n/).length,
                        ),
                      },
                      (_, index) => (
                        <span key={index}>{index + 1}</span>
                      ),
                    )}
                    {active.content.split(/\r?\n/).length > 2500 && (
                      <span>…</span>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="fxide-mobile-code"
                    value={active.content}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label={`Edit ${active.path}`}
                    onChange={(event) => changeCode(event.target.value)}
                    onKeyDown={mobileTextareaKeys}
                    wrap="off"
                    onScroll={(event) => {
                      if (mobileGutterRef.current)
                        mobileGutterRef.current.scrollTop =
                          event.currentTarget.scrollTop;
                    }}
                  />
                </div>
              ) : (
                <Monaco
                  key={active.path}
                  path={active.path}
                  language={lang.monaco}
                  value={active.content}
                  theme="forgex-dark"
                  height="100%"
                  beforeMount={(monaco) => {
                    monaco.editor.defineTheme("forgex-dark", {
                      base: "vs-dark",
                      inherit: true,
                      rules: [],
                      colors: {
                        "editor.background": "#0e1419",
                        "editor.foreground": "#e5edf0",
                        "editorGutter.background": "#0e1419",
                        "editorLineNumber.foreground": "#91a7b3",
                        "editorLineNumber.activeForeground": "#b9fa77",
                        "editorCursor.foreground": "#b9fa77",
                        "editor.lineHighlightBackground": "#1a272e",
                        "editor.lineHighlightBorder": "#00000000",
                        "editor.selectionBackground": "#31594988",
                      },
                    });
                  }}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    monacoRef.current = monaco;

                    // Working clipboard paste for the FORGEX context menu.
                    editor.addAction({
                      id: "forgex.paste-from-clipboard",
                      label: "Paste from clipboard (FORGEX)",
                      contextMenuGroupId: "9_cutcopypaste",
                      contextMenuOrder: 4,

                      run: async (currentEditor) => {
                        try {
                          if (!navigator.clipboard?.readText) {
                            setNotice(
                              "Clipboard access is unavailable. Try Ctrl+V.",
                            );
                            return;
                          }

                          const text = await navigator.clipboard.readText();
                          const selection = currentEditor.getSelection();

                          if (!selection || !text) return;

                          currentEditor.pushUndoStop();

                          currentEditor.executeEdits("forgex-clipboard", [
                            {
                              range: selection,
                              text,
                              forceMoveMarkers: true,
                            },
                          ]);

                          currentEditor.pushUndoStop();
                          currentEditor.focus();
                        } catch {
                          setNotice(
                            "Clipboard permission was blocked. " +
                              "Click inside the editor and press Ctrl+V.",
                          );
                        }
                      },
                    });

                    monacoDiagnosticsDisposable.current?.dispose();
                    monacoDiagnosticsDisposable.current =
                      monaco.editor.onDidChangeMarkers(() =>
                        updateDiagnostics(),
                      );

                    updateDiagnostics();

                    requestAnimationFrame(() => {
                      editor.layout();

                      if (!jumpLine) {
                        editor.setScrollTop(0);
                      }
                    });

                    if (jumpLine) {
                      editor.revealLineInCenter(jumpLine);
                      editor.setPosition({
                        lineNumber: jumpLine,
                        column: 1,
                      });
                      editor.focus();
                      setJumpLine(null);
                    }
                  }}
                  onChange={(value) => changeCode(value ?? "")}
                  options={{
                    // Keep line 1 visible directly beneath the tab bar, without a second fake gutter.
                    fontSize: 13,
                    lineHeight: 21,
                    fontFamily: "Cascadia Code, Consolas, monospace",
                    fontLigatures: true,
                    automaticLayout: true,

                    minimap: {
                      enabled: true,
                      side: "right",
                      size: "proportional",
                      showSlider: "mouseover",
                      renderCharacters: false,
                      maxColumn: 80,
                    },

                    lineNumbers: "on",
                    lineNumbersMinChars: 3,
                    glyphMargin: true,
                    lineDecorationsWidth: 12,
                    folding: true,
                    showFoldingControls: "mouseover",
                    renderLineHighlight: "line",
                    renderLineHighlightOnlyWhenFocus: false,
                    smoothScrolling: true,

                    scrollbar: {
                      vertical: "auto",
                      horizontal: "auto",
                      verticalScrollbarSize: 11,
                      horizontalScrollbarSize: 11,
                      useShadows: false,
                    },

                    wordWrap: "off",
                    scrollBeyondLastLine: false,
                    stickyScroll: { enabled: false },
                    tabSize: 2,
                    insertSpaces: true,
                    cursorBlinking: "smooth",
                    padding: { top: 16, bottom: 12 },
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false,
                    },
                    quickSuggestionsDelay: 180,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: "smart",

                    suggestFontSize: expanded ? 12 : 11,
                    suggestLineHeight: expanded ? 18 : 16,

                    fixedOverflowWidgets: false,

                    suggest: {
                      preview: false,
                      showWords: true,
                      showSnippets: true,
                      showIcons: true,
                      showStatusBar: false,
                    },

                    formatOnPaste: true,
                  }}
                />
              )
            ) : (
              <div className="fxide-blank">
                <Code2 size={30} />
                <strong>Start with a blank document</strong>
                <p>
                  Create a file or open the web template. Your work remains
                  local until saved.
                </p>
                <button type="button" onClick={newDocument}>
                  New document
                </button>
              </div>
            )}
          </div>
        </main>

        <section
          className={`fxide-preview ${mobileView === "preview" ? "fxide-mobile-active" : ""}`}
          aria-label="HTML preview"
        >
          <div
            className="fxide-preview-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview"
            title="Drag to resize preview"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizing("preview");
            }}
          />
          {previewVisible && !previewSandboxTipDismissed && (
            <div
              className="fxide-preview-limits fxide-preview-limits--compact"
              role="note"
              aria-label="Preview sandbox notice"
            >
              <div>
                <strong>Preview sandbox</strong>
                <p>
                  Preview runs in a browser sandbox: backend code and .env
                  secrets are not available. Public HTTPS APIs work.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissPreviewSandboxTip}
                aria-label="Dismiss preview sandbox notice"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {showPreviewLimits && (
            <div
              className="fxide-preview-limits"
              role="note"
              aria-label="Preview limits"
            >
              <div>
                <strong>Preview limits</strong>
                <p>
                  {PREVIEW_LIMITS_MESSAGE}
                  {previewLimitFiles.environmentSecrets
                    ? ` ${PREVIEW_LIMITS_ENV_MESSAGE}`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewLimitsDismissed(true)}
                aria-label="Dismiss preview limits notice"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <div className="fxide-pane-header">
            <strong>
              <MonitorPlay size={15} /> PREVIEW
            </strong>
            <span>
              {livePreview
                ? "Live · 650ms"
                : previewDirty
                  ? "Manual preview"
                  : previewEntry || "HTML / CSS / JS"}
            </span>
          </div>

          <div className="fxide-preview-toolbar">
            <select
              className="fxide-preview-device"
              aria-label="Preview viewport"
              title="Choose preview width"
              value={previewViewport}
              onChange={(event) =>
                setPreviewViewport(
                  event.target.value as "fit" | "tablet" | "mobile",
                )
              }
            >
              <option value="fit">Fit panel</option>
              <option value="tablet">Tablet · 768</option>
              <option value="mobile">Mobile · 320</option>
            </select>
            <button
              type="button"
              aria-pressed={livePreview}
              title="Toggle live preview (browser sandbox)"
              onClick={() => setLivePreview((v) => !v)}
            >
              {livePreview ? "Live On" : "Live Off"}
            </button>
            <button
              type="button"
              onClick={() => refreshPreview(true)}
              title="Refresh preview"
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              aria-label={
                previewFocused ? "Exit preview focus mode" : "Focus preview"
              }
              title={
                previewFocused
                  ? "Exit preview focus mode (Esc)"
                  : "Focus preview"
              }
              aria-pressed={previewFocused}
              onClick={() => {
                if (!previewFocused) {
                  setPreviewVisible(true);
                  setMobileView("preview");
                }

                setPreviewFocused((value) => !value);
              }}
            >
              {previewFocused ? (
                <Minimize2 size={16} />
              ) : (
                <Maximize2 size={16} />
              )}
            </button>
          </div>

<div className="fxide-ai-connect">
  <label htmlFor="fxide-ai-route">Preview AI endpoint</label>

  <input
    id="fxide-ai-route"
    type="text"
    value={previewAiRoute}
    placeholder="/api/chat"
    spellCheck={false}
    maxLength={85}
    onChange={(event) => {
      setPreviewAiRoute(event.target.value);
      setPreviewAiEnabled(false);
    }}
  />

  <button
    type="button"
    aria-pressed={previewAiEnabled}
    disabled={process.env.NODE_ENV !== "development"}
    aria-describedby="fxide-ai-policy"
    onClick={() => {
      if (previewAiEnabled) {
        setPreviewAiEnabled(false);
        setNotice("Preview AI connection disabled.");
        return;
      }

      const route = previewAiRoute.trim();

      if (!/^\/api\/[a-z0-9/_-]{1,80}$/i.test(route)) {
        setNotice("Enter a valid local /api/... endpoint.");
        return;
      }

      setPreviewAiEnabled(true);
      setNotice(
        `Gemini bridge mapped to ${route}. Refresh Preview to apply.`
      );
    }}
  >
    {previewAiEnabled ? "Disconnect" : "Connect Gemini"}
  </button>
  <p id="fxide-ai-policy" className="fxide-muted">
    {process.env.NODE_ENV === "development" ? "Each AI request requires your approval and configured server credentials." : "AI connections are unavailable on this deployment. Static Preview remains available."}
  </p>
</div>

          {previewPages.length > 1 && (

            <div className="fxide-preview-pages">
              <button
                type="button"
                aria-label="Preview back"
                title="Go back"
                disabled={!previewTrailButtons.back}
                onClick={() => navigatePreview(previewPageRef.current, "back")}
              >
                <ArrowLeft size={15} />
              </button>

              <button
                type="button"
                aria-label="Preview forward"
                title="Go forward"
                disabled={!previewTrailButtons.forward}
                onClick={() =>
                  navigatePreview(previewPageRef.current, "forward")
                }
              >
                <ArrowRight size={15} />
              </button>

              <code className="fxide-preview-path" title={previewEntry}>
                /{previewEntry || "index.html"}
              </code>

              <label htmlFor="fxide-preview-page">Page</label>

              <select
                id="fxide-preview-page"
                value={
                  previewPages.includes(previewEntry)
                    ? previewEntry
                    : previewPages[0]
                }
                onChange={(event) => {
                  navigatePreview(event.target.value);
                }}
              >
                {previewPages.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
            </div>
          )}

          {previewHtml ? (
            <iframe
              ref={iframeRef}
              title="FORGEX sandboxed web preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              style={{
                width:
                  previewViewport === "mobile"
                    ? "min(100%, 320px)"
                    : previewViewport === "tablet"
                      ? "min(100%, 768px)"
                      : "100%",
                alignSelf: "center",
              }}
            />
          ) : (
            <div className="fxide-blank">
              <MonitorPlay size={27} />
              <strong>Web preview</strong>
              <p>
                Open an HTML project and click Run Preview. Python, React
                builds, and Node servers are not executed here.
              </p>
              <button type="button" onClick={runPreview}>
                Run HTML preview
              </button>
            </div>
          )}
        </section>

        <section
          className={`fxide-console ${mobileView === "console" ? "fxide-mobile-active" : ""}`}
          aria-label="Preview console"
        >
          <div
            className="fxide-console-resizer"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize console"
            title="Drag to resize console"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizing("console");
            }}
          />

          <div className="fxide-pane-header fxide-console-header">
            <div
              className="fxide-console-modes"
              role="group"
              aria-label="IDE bottom panels"
            >
              <button
                type="button"
                className={consoleMode === "problems" ? "active" : ""}
                aria-pressed={consoleMode === "problems"}
                onClick={() => setConsoleMode("problems")}
              >
                Problems (
                {diagnostics.length + liveSignals.length + htmlWarnings.length})
              </button>

              <button
                type="button"
                className={consoleMode === "output" ? "active" : ""}
                aria-pressed={consoleMode === "output"}
                onClick={() => setConsoleMode("output")}
              >
                Output ({logs.length})
              </button>

              <button
                type="button"
                className={consoleMode === "terminal" ? "active" : ""}
                aria-pressed={consoleMode === "terminal"}
                onClick={() => setConsoleMode("terminal")}
              >
                Terminal
              </button>

              <button
                type="button"
                className={consoleMode === "network" ? "active" : ""}
                aria-pressed={consoleMode === "network"}
                onClick={() => setConsoleMode("network")}
              >
                Network ({networkRecords.length})
              </button>

              <button
                type="button"
                className={consoleMode === "api" ? "active" : ""}
                aria-pressed={consoleMode === "api"}
                onClick={() => setConsoleMode("api")}
              >
                API Tester
              </button>
            </div>

            {consoleMode !== "problems" && consoleMode !== "api" && (
              <button
                type="button"
                onClick={() => {
                  if (consoleMode === "terminal") {
                    setTerminalLines([]);
                  } else if (consoleMode === "network") {
                    setNetworkRecords([]);
                  } else {
                    setLogs([]);
                  }
                }}
                title="Clear current panel"
                aria-label="Clear current panel"
              >
                <X size={15} />
                <span>Clear</span>
              </button>
            )}
          </div>
          <div
            style={{
              display: consoleMode === "api" ? "flex" : "none",
              flex: 1,
              minHeight: 0,
            }}
            aria-hidden={consoleMode !== "api"}
          >
            <ApiRequestTester active={consoleMode === "api"} />
          </div>

          {consoleMode !== "terminal" && consoleMode !== "api" ? (
            <div className="fxide-console-list" role="log" aria-live="off">
              {consoleMode === "network" && (
                <div className="fxide-network-list">
                  <div className="fxide-network-tools">
                    <select
                      value={networkFilter}
                      aria-label="Filter network status"
                      onChange={(event) =>
                        setNetworkFilter(
                          event.target.value as "all" | "success" | "error",
                        )
                      }
                    >
                      <option value="all">All requests</option>
                      <option value="success">Success (2xx)</option>
                      <option value="error">Errors (0/4xx/5xx)</option>
                    </select>

                    <input
                      type="search"
                      value={networkSearch}
                      onChange={(event) => setNetworkSearch(event.target.value)}
                      placeholder="Search requests..."
                      aria-label="Search network requests"
                    />

                    <small>
                      {visibleNetworkRecords.length}/{networkRecords.length}
                    </small>
                  </div>

                  <p className="fxide-muted">
                    Preview fetch/XHR requests plus bridge calls. Credential-like
                    query values are redacted.
                  </p>

                  {visibleNetworkRecords.map((record) => (
                    <details key={record.key} className="fxide-network-item">
                      <summary className="fxide-network-row">
                        <code>
                          <span
                            style={{
                              color: "#9fd8e6",
                              fontWeight: 700,
                              marginRight: 6,
                            }}
                          >
                            {record.method ?? "POST"}
                          </span>
                          {record.url ?? record.path}
                          {record.via === "proxy" && (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: "1px 5px",
                                border: "1px solid #4f7d8b",
                                borderRadius: 4,
                                color: "#9fd8e6",
                                fontSize: 10,
                                fontWeight: 600,
                                textTransform: "uppercase",
                              }}
                            >
                              proxy
                            </span>
                          )}
                        </code>

                        <span
                          className={
                            record.status === 0 || record.status >= 400
                              ? "fxide-network-error"
                              : "fxide-network-ok"
                          }
                        >
                          {record.status}
                        </span>

                        <small>{record.durationMs} ms</small>
                      </summary>

                      <div className="fxide-network-details">
                        <p>Method: {record.method ?? "POST"}</p>
                        <p>
                          {record.url ? "URL" : "Endpoint"}:{" "}
                          {record.url ?? record.path}
                        </p>
                        <p>Status: {record.status}</p>
                        {record.via && <p>Transport: {record.via}</p>}
                        {record.error && <p>Error: {record.error}</p>}
                        <p>Elapsed: {record.durationMs} ms</p>
                        {!record.via && (
                          <p>
                            Duration includes time spent awaiting user
                            permission.
                          </p>
                        )}
                      </div>
                    </details>
                  ))}

                  {visibleNetworkRecords.length === 0 && (
                    <div className="fxide-muted">
                      {networkRecords.length === 0
                        ? "No preview API requests recorded yet."
                        : "No requests match the selected filters."}
                    </div>
                  )}
                </div>
              )}

              {consoleMode === "output" && (
                <div
                  className="fxide-output-tools"
                  role="group"
                  aria-label="Output filtering"
                >
                  <select
                    aria-label="Filter output level"
                    value={outputFilter}
                    onChange={(event) =>
                      setOutputFilter(event.target.value as "all" | LogLevel)
                    }
                  >
                    <option value="all">All levels</option>
                    <option value="error">Errors</option>
                    <option value="warn">Warnings</option>
                    <option value="info">Info</option>
                    <option value="log">Logs</option>
                  </select>

                  <input
                    type="search"
                    value={outputSearch}
                    onChange={(event) => setOutputSearch(event.target.value)}
                    placeholder="Search output..."
                    aria-label="Search output messages"
                  />

                  <span aria-live="off">
                    {filteredLogs.length}/{logs.length}
                  </span>
                </div>
              )}

              {consoleMode === "problems" &&
                htmlWarnings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="fxide-problem fxide-log-warn"
                    onClick={() => selectFile(item.path, item.line)}
                    title="Open HTML issue"
                  >
                    <AlertCircle size={14} />
                    <span>WARN</span>

                    <div>
                      <code>{item.message}</code>

                      <small>
                        {item.path}:{item.line}:{item.column}
                        {" · "}HTML structure check
                      </small>

                      <small>Click to open the affected source line.</small>
                    </div>
                  </button>
                ))}

              {consoleMode === "problems" &&
                liveSignals.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="fxide-problem fxide-signal"
                    onClick={() => selectFile(item.file, item.line)}
                    title="Open FORGEX finding"
                  >
                    <ShieldCheck size={14} />
                    <span>{item.severity.toUpperCase()}</span>
                    <div>
                      <code>{item.title}</code>
                      <small>
                        {item.file}:{item.line} · {item.ruleId} · heuristic
                        signal
                      </small>
                      <small>Suggestion: {item.fix}</small>
                    </div>
                  </button>
                ))}
              {consoleMode === "problems" &&
                diagnostics.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`fxide-problem fxide-log-${item.severity}`}
                    onClick={() => selectFile(item.path, item.line)}
                    title="Open code location"
                  >
                    <AlertCircle size={14} />
                    <span>{item.severity.toUpperCase()}</span>
                    <div>
                      <code>{item.message}</code>
                      <small>
                        {item.path}:{item.line}:{item.column} · click to open
                      </small>
                      <small>
                        Suggestion:{" "}
                        {explainDiagnostic(
                          item.message,
                          ideLanguage(item.path).name,
                        )}
                      </small>
                    </div>
                  </button>
                ))}

              {consoleMode === "problems" &&
                diagnostics.length === 0 &&
                liveSignals.length === 0 &&
                htmlWarnings.length === 0 && (
                  <div className="fxide-muted" role="status">
                    No reported problems. Edit a supported file or run Analyze
                    to check the workspace.
                  </div>
                )}

              {consoleMode === "output" && filteredLogs.length === 0 && (
                <div className="fxide-muted" role="status">
                  {logs.length === 0
                    ? "No preview output yet. Run an HTML preview."
                    : "No messages match the selected filters."}
                </div>
              )}

              {consoleMode === "output" &&
                filteredLogs.map((item) => (
                  <div
                    key={item.id}
                    className={`fxide-log fxide-log-${item.level}`}
                  >
                    <span>{item.level.toUpperCase()}</span>
                    <div className="fxide-log-detail">
                      <code>{item.text}</code>
                      {item.source && (
                        <small>
                          Source:{" "}
                          {item.source.includes("about:srcdoc")
                            ? "HTML preview (inline)"
                            : item.source}
                          {item.line ? `:${item.line}` : ""}
                          {item.column ? `:${item.column}` : ""}
                        </small>
                      )}
                      {item.level === "error" && (
                        <p>Suggestion: {explainRuntimeError(item.text)}</p>
                      )}
                      {item.source &&
                        item.line &&
                        (() => {
                          const hintPath = item
                            .source!.replace(/^.*forgex-preview:\/\//, "")
                            .replace(/^\//, "");
                          const known = files.find((f) => f.path === hintPath);
                          return known ? (
                            <button
                              type="button"
                              className="fxide-source-link"
                              onClick={() => selectFile(known.path)}
                            >
                              Open {known.path}
                            </button>
                          ) : null;
                        })()}
                    </div>
                  </div>
                ))}
            </div>
          ) : consoleMode === "terminal" ? (
            <div
              className="fxide-terminal"
              aria-label="Local workspace terminal"
            >
              <div className="fxide-terminal-history" role="log">
                {terminalLines.map((line, index) => (
                  <pre key={index}>{line}</pre>
                ))}
              </div>
              <form
                className="fxide-terminal-prompt"
                onSubmit={(event) => {
                  event.preventDefault();
                  runTerminal(terminalInput);
                }}
              >
                <label htmlFor="fxide-terminal-input">
                  forgex /workspace $
                </label>
                <input
                  id="fxide-terminal-input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  placeholder="help"
                  aria-label="Workspace terminal command"
                />
              </form>
            </div>
          ) : null}
        </section>
      </div>

      <nav
        className="fxide-mobile-nav"
        aria-label="Mini IDE mobile navigation"
      >
        {(
          [
            "files",
            "editor",
            "preview",
            "console",
            "insights",
            "changes",
          ] as const
        ).map((tab) => {
          const Icon =
            tab === "files"
              ? Files
              : tab === "editor"
                ? Code2
                : tab === "preview"
                  ? MonitorPlay
                  : tab === "console"
                    ? Terminal
                    : tab === "changes"
                      ? GitBranch
                      : Activity;
          return (
            <button
              type="button"
              key={tab}
              aria-pressed={mobileView === tab}
              onClick={() => onMobileTab(tab)}
              className={mobileView === tab ? "active" : ""}
            >
              <Icon size={18} />
              <span>{tab}</span>
            </button>
          );
        })}
      </nav>

      <div
        className="fxide-height-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize IDE height"
        title="Drag to resize IDE height"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing("height");
        }}
      />
      <footer className="fxide-statusbar">
        <span>
          <Check size={13} /> FORGEX LOCAL
        </span>
        <span>
          {lang.name}
          {active ? ` · ${active.content.split(/\r?\n/).length} lines` : ""}
        </span>
        <span>
          {files.length + previewBinaryAssets.length} files · {totalLines.toLocaleString()} lines
        </span>
        {previewDirty && (
          <span className="fxide-status-note">Preview may be outdated</span>
        )}
        <span className="fxide-status-spacer" />

        <button
          type="button"
          onClick={() => {
            setSideView("languages");
            setExplorerVisible(true);
            setMobileView("files");
          }}
          title="Language statistics"
        >
          <Languages size={13} /> Languages
        </button>
      </footer>
      {repositoryPanel}
      {newFileOpen && (
        <div
          className="fxide-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNewFileOpen(false);
          }}
        >
          <form
            className="fxide-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              createFile();
            }}
            aria-label="Create file"
          >
            <h3>New source file</h3>
            <p>Enter a relative project path.</p>
            <input
              autoFocus
              value={newFileName}
              onChange={(event) => setNewFileName(event.target.value)}
              placeholder="src/components/Button.tsx"
              aria-label="New file path"
            />
            <div>
              <button type="button" onClick={() => setNewFileOpen(false)}>
                Cancel
              </button>
              <button type="submit">Create file</button>
            </div>
          </form>
        </div>
      )}

      {paletteOpen && (
        <div
          className="fxide-command-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPaletteOpen(false);
            }
          }}
        >
          <div
            className="fxide-command-box"
            role="dialog"
            aria-label={
              paletteMode === "files"
                ? "Quick Open"
                : paletteMode === "line"
                  ? "Go to Line"
                  : "Command palette"
            }
            aria-modal="true"
          >
            <div className="fxide-command-search">
              <Command size={17} />

              <input
                autoFocus
                type="text"
                inputMode={paletteMode === "line" ? "numeric" : "text"}
                placeholder={
                  paletteMode === "files"
                    ? "Search workspace files..."
                    : paletteMode === "line"
                      ? "Enter line number..."
                      : "Type a command..."
                }
                aria-label={
                  paletteMode === "files"
                    ? "Search files"
                    : paletteMode === "line"
                      ? "Line number"
                      : "Search commands"
                }
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;

                  if (paletteMode === "line") {
                    const line = Number(paletteQuery);
                    const maxLine = active
                      ? active.content.split(/\r?\n/).length
                      : 0;

                    if (
                      !Number.isSafeInteger(line) ||
                      line < 1 ||
                      line > maxLine ||
                      !active
                    ) {
                      setNotice(
                        `Enter a line number between 1 and ${maxLine}.`,
                      );
                      return;
                    }

                    setPaletteOpen(false);
                    setPaletteQuery("");
                    selectFile(active.path, line);
                    return;
                  }

                  if (paletteMode === "files") {
                    const query = paletteQuery.trim().toLowerCase();

                    const file = files.find((item) =>
                      item.path.toLowerCase().includes(query),
                    );

                    if (file) {
                      setPaletteOpen(false);
                      setPaletteQuery("");
                      selectFile(file.path);
                    }

                    return;
                  }

                  const item = paletteItems.find((item) =>
                    item.label
                      .toLowerCase()
                      .includes(paletteQuery.trim().toLowerCase()),
                  );

                  if (item) {
                    setPaletteOpen(false);
                    setPaletteQuery("");
                    item.run();
                  }
                }}
              />
            </div>

            {paletteMode === "files" &&
              files
                .filter((file) =>
                  file.path
                    .toLowerCase()
                    .includes(paletteQuery.trim().toLowerCase()),
                )
                .map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => {
                      setPaletteOpen(false);
                      setPaletteQuery("");
                      selectFile(file.path);
                    }}
                  >
                    <FileCode2 size={14} />
                    {file.path}
                  </button>
                ))}

            {paletteMode === "line" && (
              <p style={{ padding: "8px 14px", fontSize: 12 }}>
                {active
                  ? `Current file: ${active.path} · ${active.content.split(/\r?\n/).length} lines`
                  : "Open a file first."}
              </p>
            )}

            {paletteMode === "commands" &&
              paletteItems
                .filter((item) =>
                  item.label
                    .toLowerCase()
                    .includes(paletteQuery.trim().toLowerCase()),
                )
                .map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setPaletteOpen(false);
                      setPaletteQuery("");
                      item.run();
                    }}
                  >
                    {item.label}
                    <ArrowRight size={14} />
                  </button>
                ))}
          </div>
        </div>
      )}

      <AppNotice message={notice} tone="info" onDismiss={() => setNotice("")} />

      <dialog
        ref={workspaceNameDialogRef}
        className="fxide-name-dialog"
        aria-labelledby="fxide-name-title"
        onClose={() => setWorkspaceNameOpen(false)}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();

            const name = workspaceNameDraft.trim();

            if (!name || name.length > 80) {
              setNotice("Workspace name must contain 1–80 characters.");
              return;
            }

            rememberFolderName(name);
            setWorkspaceNameOpen(false);
            setNotice(`Workspace renamed to ${name}.`);
          }}
        >
          <h2 id="fxide-name-title">Workspace Name</h2>

          <p>
            Set a display name for your workspace. This does not rename files or
            folders on your device.
          </p>

          <label htmlFor="fxide-workspace-name">Project name</label>

          <input
            id="fxide-workspace-name"
            type="text"
            value={workspaceNameDraft}
            onChange={(event) => setWorkspaceNameDraft(event.target.value)}
            maxLength={80}
            autoFocus
            required
            spellCheck={false}
            placeholder="My Project"
          />

          <div className="fxide-name-actions">
            <button type="button" onClick={() => setWorkspaceNameOpen(false)}>
              Cancel
            </button>

            <button type="submit">Save Name</button>
          </div>
        </form>
      </dialog>

      <input
        ref={importRef}
        type="file"
        accept=".json,.forgex.json,application/json"
        hidden
        onChange={(event) => {
          void importBackup(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <input
        type="file"
        multiple
        hidden
        ref={(node) => {
          folderInputRef.current = node;

          if (node) {
            node.setAttribute("webkitdirectory", "");
          }
        }}
        onChange={(event) => {
          const selected = Array.from(event.currentTarget.files ?? []);

          event.currentTarget.value = "";

          void openDeviceFolder(selected);
        }}
      />
    </section>
  );
}
