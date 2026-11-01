"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  FileCode2,
  FilePlus2,
  Files,
  FileSearch,
  GitCompareArrows,
  GitMerge,
  History,
  LockKeyhole,
  Menu,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  WandSparkles,
  X,
  Check,
  Info,
} from "lucide-react";
import {
  analyzeProject,
  RULE_CATALOG,
  type Finding,
  type ProjectResult,
  type Severity,
  type SourceFile,
} from "@/lib/analyzer";
import ImpactPanel from "@/components/ImpactPanel";
import TraceInspector from "@/components/TraceInspector";
import ChangeSimulation from "@/components/ChangeSimulation";
import MiniIDE from "@/components/MiniIDE";
import GitHubPublish from "../../components/GitHubPublish";
import ChangeIntelligencePanel from "../../components/ChangeIntelligencePanel";
import {
  readWorkspaceDraft,
  saveWorkspaceDraft,
  clearWorkspaceDraft,
  type RepoIdentity,
} from "../../lib/workspaceDraft";
import { useAppConfirm } from "@/components/AppConfirmProvider";
import GitHubRepositoryPicker from "../../components/GitHubRepositoryPicker";
import { buildIntelligenceV2 } from "../../lib/intelligence";
import IntelligencePanel from "../../components/IntelligencePanel";
import { validateWorkspace } from "../../lib/ideCore";
import AppNotice from "@/components/AppNotice";
type Section =
  | "workbench"
  | "security"
  | "health"
  | "release"
  | "rules"
  | "history";
type Snapshot = {
  id: string;
  time: string;
  score: number;
  risk: string;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  files: number;
};
type Baseline = { score: number; findings: number; high: number; date: string };
const SEVS: Severity[] = ["critical", "high", "medium", "low"];
const timeFormat = (s: string) => {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
};
const counts = (fs: Finding[]) => ({
  critical: fs.filter((f) => f.severity === "critical").length,
  high: fs.filter((f) => f.severity === "high").length,
  medium: fs.filter((f) => f.severity === "medium").length,
  low: fs.filter((f) => f.severity === "low").length,
});
function download(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function navTitle(s: Section) {
  return {
    workbench: "Code Workbench",
    security: "Security Center",
    health: "Project Health",
    release: "Release Gate",
    rules: "Rulebook",
    history: "Local History",
  }[s];
}
function scoreLabel(score: number) {
  return score >= 85
    ? "Healthy"
    : score >= 65
      ? "Needs attention"
      : score >= 40
        ? "At risk"
        : "High exposure";
}
function reportMarkdown(result: ProjectResult) {
  return `# FORGEX Diagnostic Report\n\nGenerated: ${result.generatedAt}\nEngine: ${result.engine}\nScore: ${result.score}/100 (heuristic)\nRisk: ${result.risk}\nFiles: ${result.scannedFiles}\nFindings: ${result.findings.length}\n\n## Findings\n\n${result.findings.map((f) => `### ${f.severity.toUpperCase()} — ${f.title}\n- Rule: ${f.ruleId}\n- Location: ${f.file}:${f.line}:${f.column}\n- Confidence: ${f.confidence}\n- Evidence: \`${f.evidence.replace(/`/g, "'")}\`\n- Reason: ${f.detail}\n- Impact: ${f.impact}\n- Action: ${f.fix}\n`).join("\n")}\n\nThis is a pattern-based review, NOT a complete security audit or proof of safety.\n`;
}
function sarifReport(result: ProjectResult) {
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "FORGEX",
            version: "0.2.0",
            informationUri: "https://github.com",
            rules: RULE_CATALOG.map((r) => ({
              id: r.id,
              name: r.title,
              shortDescription: { text: r.title },
              fullDescription: { text: r.description },
              properties: { tags: [r.category] },
            })),
          },
        },
        results: result.findings.map((f) => ({
          ruleId: f.ruleId,
          level:
            f.severity === "critical" || f.severity === "high"
              ? "error"
              : f.severity === "medium"
                ? "warning"
                : "note",
          message: { text: `${f.detail} ${f.fix}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file, uriBaseId: "%SRCROOT%" },
                region: { startLine: f.line, startColumn: f.column },
              },
            },
          ],
        })),
      },
    ],
  };
}
export default function Home() {
  const confirmAction = useAppConfirm();
  const [section, setSection] = useState<Section>("workbench");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [sourceBaseline, setSourceBaseline] = useState<SourceFile[]>([]);
  const [githubBaseline, setGithubBaseline] = useState<SourceFile[] | null>(
    null,
  );
  const [workspaceDraftLoaded, setWorkspaceDraftLoaded] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoIsPrivate, setRepoIsPrivate] = useState(false);
  const [repoIdentity, setRepoIdentity] = useState<RepoIdentity | null>(null);
  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [result, setResult] = useState<ProjectResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [query, setQuery] = useState("");
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [undoState, setUndoState] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [reportMenu, setReportMenu] = useState(false);

  function closeRepoDialog() {
    if (busy) return;

    setRepoDialogOpen(false);
    setError("");
  }

  const reportMenuRef = useRef<HTMLDivElement>(null);

  const intelligenceV2 = useMemo(
    () => buildIntelligenceV2(files, result, disabled),
    [files, result, disabled],
  );

  useEffect(() => {
    const closeReportMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !reportMenuRef.current?.contains(event.target)
      ) {
        setReportMenu(false);
      }
    };
    document.addEventListener("pointerdown", closeReportMenu, true);
    return () =>
      document.removeEventListener("pointerdown", closeReportMenu, true);
  }, []);

  const pendingHealthJump = useRef(false);

  useEffect(() => {
    if (!pendingHealthJump.current || section !== "health" || busy || !result)
      return;

    const frame = requestAnimationFrame(() => {
      document.getElementById("forgex-health-results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      pendingHealthJump.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [section, busy, result]);

  useEffect(() => {
    if (!pendingHealthJump.current || section !== "health" || busy || !error)
      return;
    pendingHealthJump.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section, busy, error]);

  const pendingSourceJump = useRef(false);
  const focusSerial = useRef(0);
  const [focusRequest, setFocusRequest] = useState<
    { path: string; line?: number; id: number } | undefined
  >();
  const [externalImportKey, setExternalImportKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const oauthRecoveryChecked = useRef(false);

  useEffect(() => {
    if (oauthRecoveryChecked.current) return;
    oauthRecoveryChecked.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);

      if (!params.has("github")) return;

      const key = "forgex-oauth-recovery-v1";

      let raw: string | null = null;

      try {
        raw = sessionStorage.getItem(key);
      } catch {
        return;
      }

      if (!raw) return;

      try {
        const saved = JSON.parse(raw) as {
          savedAt: number;
          files: SourceFile[];
          baseline: SourceFile[];
          githubBaseline?: SourceFile[] | null;
          repoIdentity?: RepoIdentity | null;
          repoUrl?: string;
        };

        if (
          !Number.isFinite(saved.savedAt) ||
          Date.now() - saved.savedAt > 86_400_000
        ) {
          throw new Error("Temporary workspace recovery expired.");
        }

        const restored = validateWorkspace(saved.files);

        const restoredBaseline = saved.baseline?.length
          ? validateWorkspace(saved.baseline)
          : [];

        const restoredGithubBaseline =
          Array.isArray(saved.githubBaseline) && saved.githubBaseline.length > 0
            ? validateWorkspace(saved.githubBaseline)
            : null;

        const candidate = saved.repoIdentity;

        const validRepoIdentity =
          candidate &&
          restoredGithubBaseline &&
          typeof candidate.fullName === "string" &&
          /^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(candidate.fullName) &&
          typeof candidate.branch === "string" &&
          candidate.branch.length > 0 &&
          typeof candidate.commitSha === "string" &&
          /^[a-f0-9]{40,64}$/i.test(candidate.commitSha) &&
          Array.isArray(candidate.importedPaths) &&
          candidate.importedPaths.length === restoredGithubBaseline.length &&
          new Set(candidate.importedPaths).size ===
            restoredGithubBaseline.length &&
          restoredGithubBaseline.every((file) =>
            candidate.importedPaths.includes(file.path),
          );

        const recoveredIdentity: RepoIdentity | null = validRepoIdentity
          ? candidate
          : null;

        const confirmed = await confirmAction({
          title: "Restore GitHub workspace?",
          message:
            `FORGEX found ${restored.length} file(s) saved before GitHub authorization.\n\n` +
            "Restoring will recover your workspace and available repository information.\n\n" +
            "Your remote GitHub repository will remain unchanged.",
          confirmText: "Restore Workspace",
          cancelText: "Skip Recovery",
        });

        if (confirmed) {
          setFiles(restored);
          setSourceBaseline(restoredBaseline);
          setGithubBaseline(recoveredIdentity ? restoredGithubBaseline : null);
          setRepoIdentity(recoveredIdentity);
          setRepoUrl(typeof saved.repoUrl === "string" ? saved.repoUrl : "");
          setSelectedPath(restored[0]?.path ?? "");

          setExternalImportKey((value) => value + 1);

          setResult(null);

          setNotice(
            `Restored ${restored.length} files after GitHub authorization. ` +
              "Run Analyze to refresh results.",
          );
        }
      } catch {
        setNotice(
          "Temporary recovery failed. " +
            "Restore your exported FORGEX project backup.",
        );
      } finally {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      }
    })();
  }, [confirmAction]);

  useEffect(() => {
    let active = true;

    const returnedFromGitHub = new URLSearchParams(window.location.search).has(
      "github",
    );

    // The existing OAuth recovery handles this redirect.
    if (returnedFromGitHub) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );

      setWorkspaceDraftLoaded(true);
      return;
    }

    void readWorkspaceDraft()
      .then(async (saved) => {
        if (!active || !saved) return;

        const dismissKey = "forgex:dismissed-recovery-v1";

        try {
          const dismissed = sessionStorage.getItem(dismissKey);

          if (dismissed === String(saved.savedAt)) {
            return;
          }
        } catch {
          // Continue when session storage is unavailable.
        }

        const restore = await confirmAction({
          title: "Restore previous workspace?",
          message:
            `FORGEX found ${saved.files.length} locally saved file(s).\n\n` +
            "You can restore this workspace or start a new session.\n\n" +
            "Choosing Not Now will preserve the saved draft " +
            "without asking again about this same version " +
            "during the current browser session.",
          confirmText: "Restore Workspace",
          cancelText: "Not Now",
        });

        if (!active) return;

        if (!restore) {
          try {
            sessionStorage.setItem(dismissKey, String(saved.savedAt));
          } catch {
            // The draft remains available in IndexedDB.
          }

          return;
        }

        try {
          sessionStorage.removeItem(dismissKey);
        } catch {
          // No action required.
        }

        setFiles(saved.files);
        setSourceBaseline(saved.baselineFiles);
        setGithubBaseline(saved.githubBaselineFiles ?? null);
        setSelectedPath(saved.selectedPath);
        setRepoUrl(saved.repoUrl);
        setRepoIdentity(saved.repoIdentity);
        setExternalImportKey((value) => value + 1);
        setResult(null);

        setNotice(`Restored ${saved.files.length} files from browser storage.`);
      })
      .catch(() => {
        if (active) {
          setNotice(
            "Local recovery is unavailable. " +
              "You can still import a project backup.",
          );
        }
      })
      .finally(() => {
        if (active) setWorkspaceDraftLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [confirmAction]);

  const everHadWorkspace = useRef(false);

  useEffect(() => {
    if (!workspaceDraftLoaded) return;

    if (
      files.length > 0 ||
      sourceBaseline.length > 0 ||
      githubBaseline !== null ||
      repoIdentity !== null
    ) {
      everHadWorkspace.current = true;
    }

    if (!everHadWorkspace.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      const shouldSaveDraft =
        files.length > 0 ||
        sourceBaseline.length > 0 ||
        githubBaseline !== null ||
        repoIdentity !== null;

      const operation = shouldSaveDraft
        ? saveWorkspaceDraft({
            savedAt: Date.now(),
            files,
            baselineFiles: sourceBaseline,
            githubBaselineFiles: githubBaseline,
            selectedPath,
            repoUrl,
            repoIdentity,
          })
        : clearWorkspaceDraft();

      void operation.catch(() => {
        setNotice(
          "Browser recovery could not save. " +
            "Use Save > Export project backup.",
        );
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    workspaceDraftLoaded,
    files,
    sourceBaseline,
    githubBaseline,
    selectedPath,
    repoUrl,
    repoIdentity,
  ]);

  // Section switches always reveal the selected destination. Source links
  // reveal the IDE; Analyze waits for its report before scrolling.
  useEffect(() => {
    if (section === "health" && pendingHealthJump.current) return;
    if (section === "workbench" && pendingSourceJump.current) {
      const frame = requestAnimationFrame(() => {
        document.getElementById("forgex-mini-ide")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        pendingSourceJump.current = false;
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);

  function goTo(destination: Section) {
    pendingHealthJump.current = false;
    pendingSourceJump.current = false;
    setSection(destination);
    setShowMobileNav(false);
    setReportMenu(false);
    if (section === destination)
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSource(path: string, line?: number) {
    setFocusRequest({ path, line, id: ++focusSerial.current });
    pendingHealthJump.current = false;
    pendingSourceJump.current = true;
    setSelectedPath(path);
    setSection("workbench");
    setShowMobileNav(false);
    // If already in Workbench, section does not change and needs an explicit jump.
    if (section === "workbench") {
      requestAnimationFrame(() => {
        document.getElementById("forgex-mini-ide")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        pendingSourceJump.current = false;
      });
    }
  }

  const currentFindings = result?.findings || [];
  const breakdown = counts(currentFindings);
  const filteredFindings = useMemo(
    () =>
      currentFindings.filter(
        (f) =>
          (filter === "all" || f.severity === filter) &&
          (!query ||
            `${f.file} ${f.title} ${f.ruleId} ${f.detail}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [currentFindings, filter, query],
  );
  const securityFindings = currentFindings.filter(
    (f) => f.category === "security" || f.category === "dependencies",
  );
  const fileCount = files.length;
  const totalLines = files.reduce(
    (s, f) => s + f.content.split(/\r?\n/).length,
    0,
  );
  const hasTest = files.some((f) =>
    /(^|\/)(__tests__|tests?|specs?)(\/|\.|$)|\.(test|spec)\./i.test(f.path),
  );
  const hasReadme = files.some((f) =>
    /(^|\/)readme(\.md|\.txt)?$/i.test(f.path),
  );
  const gate = [
    {
      name: "No critical findings",
      good: !!result && breakdown.critical === 0,
      detail: "Critical patterns require investigation.",
    },
    {
      name: "No high severity findings",
      good: !!result && breakdown.high === 0,
      detail: "Review suspected injection, secrets and command execution.",
    },
    {
      name: "Health score ≥ 80",
      good: !!result && result.score >= 80,
      detail: "A heuristic threshold, not a security certification.",
    },
    {
      name: "Test files detected",
      good: hasTest,
      detail: "File naming only; tests are not executed.",
    },
    {
      name: "README detected",
      good: hasReadme,
      detail: "Basic project documentation.",
    },
    {
      name: "No pending TODO markers",
      good: !!result && !currentFindings.some((f) => f.ruleId === "GEN001"),
      detail: "Review work markers before publishing.",
    },
  ];
  const passed = gate.filter((g) => g.good).length;
  useEffect(() => {
    try {
      const h = localStorage.getItem("forgex-history-v2");
      if (h) {
        const parsed = JSON.parse(h);
        if (Array.isArray(parsed)) setSnapshots(parsed.slice(0, 30));
      }
      const b = localStorage.getItem("forgex-baseline-v2");
      if (b) setBaseline(JSON.parse(b));
      const d = localStorage.getItem("forgex-rules-v2");
      if (d) {
        const parsed = JSON.parse(d);
        if (Array.isArray(parsed)) setDisabled(parsed);
      }
    } catch {}
  }, []);
  useEffect(() => {
    function keyboard(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void runScan();
      }
      if (e.key === "Escape") setReportMenu(false);
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });
  function persistHistory(items: Snapshot[]) {
    const trimmed = items.slice(0, 30);
    setSnapshots(trimmed);
    try {
      localStorage.setItem("forgex-history-v2", JSON.stringify(trimmed));
    } catch {
      setNotice(
        "Browser storage unavailable: history only lasts this session.",
      );
    }
  }
  function persistRules(items: string[]) {
    setDisabled(items);
    try {
      localStorage.setItem("forgex-rules-v2", JSON.stringify(items));
    } catch {}
  }
  function saveBaseline() {
    if (!result) return;
    const base = {
      score: result.score,
      findings: result.findings.length,
      high: breakdown.critical + breakdown.high,
      date: result.generatedAt,
    };
    setBaseline(base);
    try {
      localStorage.setItem("forgex-baseline-v2", JSON.stringify(base));
    } catch {}
    setNotice("Baseline saved locally. Future scans can be compared.");
  }
  async function runScan(targetFiles: SourceFile[] = files): Promise<boolean> {
    if (targetFiles.length === 0) {
      setError("Add source files or import a repository before scanning.");
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        targetFiles.length > 120 ||
        targetFiles.some((f) => f.content.length > 400000) ||
        targetFiles.reduce((n, f) => n + f.content.length, 0) > 2000000
      )
        throw new Error(
          "Limit: 120 files, 400 KB each, 2 million total characters.",
        );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const next = analyzeProject(targetFiles, disabled);
      setResult(next);
      setFilter("all");
      setSelectedFinding(null);
      const c = counts(next.findings);
      persistHistory([
        {
          id: next.generatedAt,
          time: next.generatedAt,
          score: next.score,
          risk: next.risk,
          findings: next.findings.length,
          critical: c.critical,
          high: c.high,
          medium: c.medium,
          low: c.low,
          files: next.scannedFiles,
        },
        ...snapshots,
      ]);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function updateFile(path: string, content: string) {
    setFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content } : f)),
    );
    setResult(null);
    setSelectedFinding(null);
  }
  async function importFiles(list: FileList | null) {
    if (!list?.length) return;

    // Add files to the existing IDE workspace. Never silently replace source.
    const supported =
      /\.(js|mjs|cjs|ts|tsx|jsx|py|json|html|htm|css|md|txt|yml|yaml|xml|svg|go|rs|java|c|h|cpp|hpp|cs|php|sql|sh)$/i;
    const seen = new Set(files.map((file) => file.path.toLowerCase()));
    const additions: SourceFile[] = [];
    let skipped = 0;
    let totalChars = files.reduce((sum, file) => sum + file.content.length, 0);

    for (const entry of Array.from(list)) {
      const path = entry.name.replace(/\\/g, "/");
      // The file picker gives a base name; reject empty/unsafe inputs.
      if (
        !supported.test(path) ||
        !path ||
        path === "." ||
        path === ".." ||
        path.includes("/") ||
        /[\u0000-\u001f]/.test(path) ||
        seen.has(path.toLowerCase()) ||
        entry.size > 400000 ||
        files.length + additions.length >= 120
      ) {
        skipped++;
        continue;
      }
      try {
        const content = await entry.text();
        if (totalChars + content.length > 2000000) {
          skipped++;
          continue;
        }
        additions.push({ path, content });
        seen.add(path.toLowerCase());
        totalChars += content.length;
      } catch {
        skipped++;
      }
    }

    if (!additions.length) {
      setNotice(
        `No new supported files added. ${skipped} duplicate, unsupported, oversized or unreadable file(s) skipped.`,
      );
      return;
    }
    setFiles((previous) => [...previous, ...additions]);
    if (files.length === 0) {
      setSourceBaseline(additions.map((file) => ({ ...file })));
    }
    setExternalImportKey((current) => current + 1);
    setSelectedPath(additions[0].path);
    setFocusRequest({ path: additions[0].path, id: ++focusSerial.current });
    setResult(null);
    setUndoState(null);
    setSelectedFinding(null);
    setError("");
    setNotice(
      `Added ${additions.length} file(s) to the IDE.${skipped ? ` ${skipped} skipped (duplicate, unsupported or size limit).` : ""} Run Analyze when ready.`,
    );
    pendingSourceJump.current = true;
    setSection("workbench");
    if (section === "workbench") {
      requestAnimationFrame(() => {
        document
          .getElementById("forgex-mini-ide")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        pendingSourceJump.current = false;
      });
    }
  }

  function scanAndShowHealth() {
    if (!files.length || busy) return;
    pendingHealthJump.current = true;
    pendingSourceJump.current = false;
    setSection("health");
    void runScan();
  }

  async function importRepository() {
    if (!repoUrl.trim() || busy) return;

    if (files.length > 0 || repoIdentity !== null) {
      const approved = await confirmAction({
        title: "Import another repository?",
        message:
          `Current workspace: ${files.length} file(s).\n\n` +
          "Importing this repository will replace the current " +
          "working workspace and its repository connection.\n\n" +
          "Export a project backup before continuing if you " +
          "need to preserve your current changes.\n\n" +
          "Your existing GitHub repository will not be modified.",
        confirmText: "Import Repository",
        cancelText: "Keep Workspace",
        destructive: true,
      });

      if (!approved) return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        repoIsPrivate ? "/api/github/private-import" : "/api/github-import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: repoUrl.trim() }),
        },
      );

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          `GitHub import API returned HTTP ${response.status} ` +
            "instead of JSON. Check the Next.js terminal for errors.",
        );
      }

      const data: {
        error?: string;
        files: SourceFile[];
        repository: string;
        branch: string;
        skipped: number;
        partial: boolean;
      } = await response.json();

      if (!response.ok) throw new Error(data.error || "GitHub import failed.");
      if (!Array.isArray(data.files) || !data.files.length)
        throw new Error("No source files returned from repository.");
      setFiles(data.files);

      const metadata = data as typeof data & {
        repository?: string;
        branch?: string;
        commitSha?: string;
        partial?: boolean;
      };

      if (
        typeof metadata.repository === "string" &&
        typeof metadata.branch === "string" &&
        typeof metadata.commitSha === "string" &&
        /^[a-f0-9]{40,64}$/i.test(metadata.commitSha)
      ) {
        setRepoIdentity({
          fullName: metadata.repository,
          branch: metadata.branch,
          commitSha: metadata.commitSha,
          partial: metadata.partial === true,
          importedPaths: data.files.map((file: SourceFile) => file.path),
        });
        setGithubBaseline(data.files.map((file) => ({ ...file })));
      } else {
        setRepoIdentity(null);
        setGithubBaseline(null);
      }

      setSourceBaseline(data.files.map((file) => ({ ...file })));
      setRepoDialogOpen(false);
      setExternalImportKey((current) => current + 1);
      setSelectedPath(data.files[0].path);
      setFocusRequest({ path: data.files[0].path, id: ++focusSerial.current });
      setResult(null);
      setUndoState(null);
      setSelectedFinding(null);
      pendingSourceJump.current = true;
      setSection("workbench");
      const scanned = await runScan(data.files);
      if (section === "workbench") {
        requestAnimationFrame(() => {
          document
            .getElementById("forgex-mini-ide")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
          pendingSourceJump.current = false;
        });
      }
      if (scanned)
        setNotice(
          `${data.repository} (${data.branch}): ${data.files.length} real files scanned${data.partial ? `, ${data.skipped} eligible files skipped · PARTIAL SCAN` : ""}.`,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load repository");
    } finally {
      setBusy(false);
    }
  }

  function applySimulatedChange(
    finding: Finding,
    replacement: string,
    expectedLine: string,
  ) {
    const file = files.find((f) => f.path === finding.file);

    if (!file) {
      setError("Source file is no longer available.");
      return;
    }

    const lines = file.content.split(/\r?\n/);

    if (lines[finding.line - 1] !== expectedLine) {
      setError("Source changed. Run analysis again.");
      return;
    }

    const newline = file.content.includes("\r\n") ? "\r\n" : "\n";

    lines[finding.line - 1] = replacement;

    setUndoState({
      path: file.path,
      content: file.content,
    });

    updateFile(file.path, lines.join(newline));
    openSource(file.path);

    setNotice(
      "Change applied locally. Analyze again to verify. " +
        "Nothing has been pushed to GitHub.",
    );
  }

  function applyFix(f: Finding) {
    if (f.replacement === undefined) return;
    const file = files.find((v) => v.path === f.file);
    if (!file) return;
    const lines = file.content.split(/\r?\n/);
    if (!lines[f.line - 1] || lines[f.line - 1].trim() !== f.evidence) {
      setError("File changed since scan. Scan again before applying a patch.");
      return;
    }
    setUndoState({ path: file.path, content: file.content });
    lines[f.line - 1] = f.replacement;
    updateFile(file.path, lines.join("\n"));
    openSource(file.path);
    setNotice(
      `Patch applied to ${file.path}:${f.line}. Review the code and run analysis again.`,
    );
  }
  function undoFix() {
    if (!undoState) return;
    updateFile(undoState.path, undoState.content);
    setSelectedPath(undoState.path);
    setUndoState(null);
    setNotice("Last patch undone.");
  }
  function exportResult(type: "json" | "markdown" | "sarif") {
    if (!result) return;
    setReportMenu(false);
    if (type === "json")
      download(
        "forgex-report.json",
        JSON.stringify(result, null, 2),
        "application/json",
      );
    if (type === "markdown")
      download("forgex-report.md", reportMarkdown(result), "text/markdown");
    if (type === "sarif")
      download(
        "forgex-report.sarif",
        JSON.stringify(sarifReport(result), null, 2),
        "application/json",
      );
  }
  function renderFinding(f: Finding) {
    return (
      <article
        className={`finding ${selectedFinding === f.id ? "selected" : ""}`}
        key={f.id}
      >
        <div className="finding-head">
          <span className={`severity ${f.severity}`}>
            <span className="severity-dot" />
            {f.severity} <span className="finding-kind">/ {f.category}</span>
          </span>
          <span className="file-ref" title={`${f.file}:${f.line}`}>
            {f.file.split("/").pop()}:{f.line}
          </span>
        </div>
        <h3>{f.title}</h3>
        <p>{f.detail}</p>
        <button
          className="finding-link"
          onClick={() =>
            setSelectedFinding(selectedFinding === f.id ? null : f.id)
          }
        >
          {selectedFinding === f.id ? "Close inspection" : "Inspect finding"}{" "}
          <ArrowUpRight size={14} />
        </button>
        {selectedFinding === f.id && (
          <div className="finding-detail">
            <div className="detail-block">
              <small>WHY IT MATTERS</small>
              <p>{f.impact}</p>
            </div>
            <div className="detail-block">
              <small>RECOMMENDED ACTION</small>
              <p>{f.fix}</p>
            </div>
            <div className="code-evidence">{f.evidence}</div>
            <div className="inspect-foot">
              <span>
                Rule {f.ruleId} · {f.confidence} confidence
              </span>

              <button
                className="plain small"
                onClick={() => openSource(f.file, f.line)}
              >
                Open source
              </button>
            </div>
            {f.replacement !== undefined && (
              <div className="patch-box">
                <small>
                  PROPOSED LINE REPLACEMENT · REVIEW BEFORE APPLYING
                </small>
                <pre className="removed">
                  −{" "}
                  {
                    files
                      .find((v) => v.path === f.file)
                      ?.content.split(/\r?\n/)[f.line - 1]
                  }
                </pre>
                <pre className="added">
                  + {f.replacement || "(remove line content)"}
                </pre>
                <button className="subtle" onClick={() => applyFix(f)}>
                  <WandSparkles size={14} /> Apply suggested edit
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  }
  const menu: [Section, typeof ScanSearch, string][] = [
    ["workbench", ScanSearch, "01"],
    ["security", ShieldCheck, "02"],
    ["health", Activity, "03"],
    ["release", GitMerge, "04"],
    ["rules", BookOpen, "05"],
    ["history", History, "06"],
  ];
  return (
    <main className="app-shell nav-collapsed">
      <aside
        id="forgex-workspace-navigation"
        className={`sidebar ${showMobileNav ? "mobile-open" : ""}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") setShowMobileNav(false);
        }}
      >
        <button
          type="button"
          className="sidebar-dismiss"
          aria-label="Close navigation"
          onClick={() => setShowMobileNav(false)}
        >
          <X size={20} />
        </button>

        <button
          className="brand"
          onClick={() => {
            goTo("workbench");
          }}
        >
          <span className="brandmark">
            <Code2 size={21} strokeWidth={2.3} />
          </span>
          <span className="brandword">
            FORGEX<small>DEVELOPER INTELLIGENCE</small>
          </span>
        </button>
        <div className="sidebar-kicker">
          WORKSPACE <span>V 0.2</span>
        </div>
        <nav className="side-nav">
          {menu.map(([key, Icon, num]) => (
            <button
              type="button"
              className={`nav-item ${section === key ? "active" : ""}`}
              key={key}
              aria-label={navTitle(key)}
              onClick={() => {
                goTo(key);
              }}
            >
              <Icon size={17} />
              <span>{navTitle(key)}</span>
              <small>{num}</small>
            </button>
          ))}
        </nav>
        <div className="side-spacer" />
        <div className="sidebar-project">
          <div className="side-project-head">
            <span className="project-glow" /> LOCAL WORKSPACE{" "}
          </div>
          <strong>
            {fileCount} source {fileCount === 1 ? "file" : "files"}
          </strong>
          <small>{totalLines.toLocaleString()} lines in memory</small>
          <div className="privacy-caption">
            <LockKeyhole size={13} /> On-device analysis · GitHub import via
            server
          </div>
        </div>
        <div className="sidebar-bottom">
          <div>AN INDEPENDENT PROJECT BY</div>
          <strong>BRAXCODE DIGITALS FOUNDATION</strong>
          <p>Built with intent. Made for builders.</p>
        </div>
      </aside>
      {showMobileNav && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setShowMobileNav(false)}
        />
      )}
      <section className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-only mobile-menu"
              aria-label={showMobileNav ? "Close menu" : "Open menu"}
              aria-expanded={showMobileNav}
              onClick={() => setShowMobileNav((open) => !open)}
            >
              <Menu size={20} />
            </button>

            <span className="breadcrumbs">
              Workspace <ChevronRight size={13} /> <b>{navTitle(section)}</b>
            </span>
          </div>
          <div className="topbar-right">
            <span className="top-status" aria-label="Analysis runs in your browser">
              Browser analysis
            </span>
          </div>
        </header>
        <div className="page-body">
          <div className="fx-workbench-screen" hidden={section !== "workbench"}>
            <section
              className="fx-workspace-heading"
              aria-labelledby="fx-workspace-title"
            >
              <div>
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> CODE WORKSPACE / 001
                </div>
                <h1 id="fx-workspace-title">FORGEX DevStudio</h1>
                <p>
                  Write, import, preview and analyze in one workspace. Local
                  analysis runs in your browser. GitHub import and pull-request
                  publishing use the FORGEX server.
                </p>
              </div>
            </section>

            <div className="fx-workspace-status" role="status">
              <span>
                <Files size={15} /> {fileCount}{" "}
                {fileCount === 1 ? "file" : "files"} ·{" "}
                {totalLines.toLocaleString()} lines
              </span>
              <span>
                <CheckCircle2 size={15} />{" "}
                {result
                  ? `${result.findings.length} findings · ${result.score}/100 heuristic score`
                  : "Ready for analysis"}
              </span>
              {result && (
                <button type="button" onClick={() => goTo("health")}>
                  View results <ArrowRight size={14} />
                </button>
              )}
              {undoState && (
                <button type="button" onClick={undoFix}>
                  <RotateCcw size={14} /> Undo last fix
                </button>
              )}
            </div>

            {repoIdentity && (
              <div
                role="status"
                style={{
                  marginBottom: 12,
                  fontSize: 12,
                  color: "#a9c5cc",
                  lineHeight: 1.6,
                  overflowWrap: "anywhere",
                }}
              >
                GitHub source: {repoIdentity.fullName}
                {" · "}
                Branch: {repoIdentity.branch}
                {" · "}
                Commit: {repoIdentity.commitSha.slice(0, 8)}
                {" · "}
                {repoIdentity.partial ? "Partial import" : "Import completed"}
              </div>
            )}

            <ChangeIntelligencePanel
              baselineFiles={sourceBaseline}
              currentFiles={files}
              disabledRules={disabled}
              repositoryPartial={repoIdentity?.partial ?? false}
              onOpenSource={(path, line) => openSource(path, line)}
            />

            {repoIdentity && githubBaseline && (
              <GitHubPublish
                key={`${repoIdentity.fullName}:${repoIdentity.commitSha}`}
                identity={repoIdentity}
                files={files}
                baselineFiles={githubBaseline}
              />
            )}

            <MiniIDE
              files={files}
              selectedPath={selectedPath}
              onSelectFile={setSelectedPath}
              focusRequest={focusRequest}
              baselineFiles={sourceBaseline}
              githubBaselineFiles={githubBaseline}
              repoIdentity={repoIdentity}
              repoUrl={repoUrl}
              onCaptureBaseline={() =>
                setSourceBaseline(files.map((file) => ({ ...file })))
              }
              externalImportKey={externalImportKey}
              onChangeFile={updateFile}
              onCreateFile={(path) => {
                if (
                  files.some(
                    (file) => file.path.toLowerCase() === path.toLowerCase(),
                  )
                )
                  return;
                setFiles((previous) => [...previous, { path, content: "" }]);
                setSelectedPath(path);
                setResult(null);
                setUndoState(null);
                setSelectedFinding(null);
              }}
              onDeleteFile={(path) => {
                const remaining = files.filter((file) => file.path !== path);
                setFiles(remaining);
                setFocusRequest(undefined);
                setSelectedPath((current) =>
                  current === path ? (remaining[0]?.path ?? "") : current,
                );
                setResult(null);
                setUndoState(null);
                setSelectedFinding(null);
              }}
              onNewProject={(projectFiles) => {
                setSourceBaseline(projectFiles.map((file) => ({ ...file })));
                setRepoIdentity(null);
                setGithubBaseline(null);
                setFiles(projectFiles);
                setSelectedPath(projectFiles[0]?.path ?? "");
                setFocusRequest(
                  projectFiles[0]
                    ? { path: projectFiles[0].path, id: ++focusSerial.current }
                    : undefined,
                );
                setResult(null);
                setUndoState(null);
                setSelectedFinding(null);
                setRepoUrl("");
              }}
              onAnalyze={scanAndShowHealth}
              analyzing={busy}
              healthScore={result?.score ?? null}
              disabledRules={disabled}
              onNavigate={(destination) => {
                if (destination === "health") {
                  pendingHealthJump.current =
                    pendingHealthJump.current || Boolean(result);
                  pendingSourceJump.current = false;
                } else {
                  pendingHealthJump.current = false;
                }
                setSection(destination);
                setShowMobileNav(false);
              }}
              onImportFiles={() => inputRef.current?.click()}

onImportRepository={() => {
  setError("");
  setRepoDialogOpen(true);
}}

              repositoryPanel={
                repoDialogOpen ? (
                  <div
                    className="fxide-dialog-backdrop"
                    role="presentation"
             
onMouseDown={(event) => {
  if (event.target === event.currentTarget) {
    closeRepoDialog();
  }
}}

                  >
                    <form
                      className="fxide-dialog fxide-repo-dialog"
                      aria-label="Import GitHub repository"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void importRepository();
                      }}
                    >
                      <h3>Import GitHub repository</h3>

                      <p>
                        Import replaces the current in-memory workspace after
                        confirmation. Save your changes first.
                      </p>

                      <GitHubRepositoryPicker
                        onChoose={(url, isPrivate) => {
                          setRepoUrl(url);
                          setRepoIsPrivate(isPrivate);
                        }}
                      />

                      <input
                        id="forgex-repo-url"
                        type="url"
                        required
                        autoFocus
                        value={repoUrl}
                        placeholder="https://github.com/owner/repository"
                        onChange={(event) => {
                          setRepoUrl(event.target.value);
                          setRepoIsPrivate(false);
                        }}
                      />

                      <div>
                        <button
                          type="button"
                          disabled={busy}
                     onClick={closeRepoDialog}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={busy || !repoUrl.trim()}
                        >
                          {busy ? "Importing..." : "Import & scan"}
                        </button>
                      </div>

                      {error && <p role="alert">{error}</p>}
                    </form>
                  </div>
                ) : null
              }
            />

            <p className="fx-workspace-privacy">
              <LockKeyhole size={14} />
              Local analysis runs in your browser. Browser recovery saves
              workspace files on this device. Static HTML/CSS/JS preview runs in
              a restricted sandbox; other languages are not executed. GitHub
              import and pull-request publishing use the FORGEX server.
            </p>
          </div>
          {section === "security" && (
            <>
              <section className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> SECURITY LENS / 002
                </div>
                <h1>
                  Find the weak points.
                  <br />
                  <span>Keep the context.</span>
                </h1>
                <p>
                  Security-first triage with evidence, impact, confidence and
                  recommended action. No false claims of exploit verification.
                </p>
              </section>
              <div className="three-stats">
                <div>
                  <small>SECURITY SIGNALS</small>
                  <strong>{result ? securityFindings.length : "—"}</strong>
                  <span>Potential risks</span>
                </div>
                <div>
                  <small>CRITICAL + HIGH</small>
                  <strong>
                    {result ? breakdown.critical + breakdown.high : "—"}
                  </strong>
                  <span>Require immediate review</span>
                </div>
                <div>
                  <small>SCANNED FILES</small>
                  <strong>{result ? result.scannedFiles : "—"}</strong>
                  <span>Within current workspace</span>
                </div>
              </div>
              {!result ? (
                <NoScan
                  hasFiles={files.length > 0}
                  onScan={() => {
                    if (files.length > 0) {
                      void runScan();
                    } else {
                      goTo("workbench");
                    }
                  }}
                />
              ) : (
                <div className="section-grid">
                  <div className="section-panel">
                    <div className="section-title">
                      <ShieldAlert size={18} /> Security findings{" "}
                      <span>{securityFindings.length}</span>
                    </div>
                    {securityFindings.length ? (
                      securityFindings.map(renderFinding)
                    ) : (
                      <div className="generic-empty">
                        <CheckCircle2 size={25} />
                        <h3>No security patterns flagged</h3>
                        <p>
                          Only enabled rules were checked. Scan is not a
                          penetration test.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="section-panel sidebar-card">
                    <div className="section-title">
                      <LockKeyhole size={18} /> Threat context
                    </div>
                    <h3>Signals, not verdicts.</h3>
                    <p>
                      FORGEX identifies patterns that merit investigation. It
                      cannot determine whether an input is attacker-controlled
                      without program context.
                    </p>
                    <div className="signal-item">
                      <span>01</span>
                      <div>
                        <strong>Locate</strong>
                        <p>See the exact file and line.</p>
                      </div>
                    </div>
                    <div className="signal-item">
                      <span>02</span>
                      <div>
                        <strong>Understand</strong>
                        <p>Read impact and confidence.</p>
                      </div>
                    </div>
                    <div className="signal-item">
                      <span>03</span>
                      <div>
                        <strong>Verify</strong>
                        <p>Test proposed fixes in your environment.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          {section === "health" && (
            <>
              <section className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> CODE HEALTH / 003
                </div>
                <h1>
                  Quality you can
                  <br />
                  <span>actually track.</span>
                </h1>
                <p>
                  A transparent heuristic score, per-file breakdown and a saved
                  local baseline to compare progress over time.
                </p>
              </section>
              {!result ? (
                <NoScan
                  hasFiles={files.length > 0}
                  onScan={() => {
                    if (files.length > 0) {
                      void runScan();
                    } else {
                      goTo("workbench");
                    }
                  }}
                />
              ) : (
                <>
                  <div
                    id="forgex-health-results"
                    style={{ scrollMarginTop: 24 }}
                  />

                  <IntelligencePanel
                    report={intelligenceV2}
                    onOpenSource={(path, line) => openSource(path, line)}
                  />

                  <section
                    className="section-panel fx-findings-panel"
                    aria-label="Project analysis results"
                  >
                    <div className="section-title">
                      <ScanSearch size={18} /> Analysis results{" "}
                      <span>{result.findings.length} findings</span>
                    </div>
                    <div className="report-tools" ref={reportMenuRef}>
                      <div className="severity-counts">
                        {SEVS.map((severity) => (
                          <button
                            type="button"
                            key={severity}
                            className={`count-chip ${severity} ${filter === severity ? "on" : ""}`}
                            onClick={() =>
                              setFilter((current) =>
                                current === severity ? "all" : severity,
                              )
                            }
                          >
                            <i />
                            {breakdown[severity]} {severity}
                          </button>
                        ))}
                      </div>
                      <div className="report-actions">
                        <input
                          className="fx-findings-search"
                          type="search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search findings"
                          aria-label="Search findings"
                        />
                        <button
                          type="button"
                          className="plain small"
                          onClick={() => {
                            setFilter("all");
                            setQuery("");
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className="plain small"
                          aria-expanded={reportMenu}
                          onClick={() => setReportMenu((current) => !current)}
                        >
                          <ArrowDownToLine size={15} /> Export report
                        </button>
                      </div>
                      {reportMenu && (
                        <div className="export-menu">
                          <button
                            type="button"
                            onClick={() => exportResult("markdown")}
                          >
                            Markdown report
                          </button>
                          <button
                            type="button"
                            onClick={() => exportResult("json")}
                          >
                            JSON findings
                          </button>
                          <button
                            type="button"
                            onClick={() => exportResult("sarif")}
                          >
                            SARIF 2.1.0
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="fx-findings-list">
                      {filteredFindings.length ? (
                        filteredFindings.slice(0, 100).map(renderFinding)
                      ) : (
                        <div className="no-matches">
                          <CheckCircle2 size={24} />
                          <h3>
                            {result.findings.length
                              ? "No findings in this filter"
                              : "No patterns flagged"}
                          </h3>
                          <p>
                            {result.findings.length
                              ? "Choose another severity."
                              : "This heuristic result does not prove the project is secure."}
                          </p>
                        </div>
                      )}
                    </div>
                    {filteredFindings.length > 100 && (
                      <p className="fx-workspace-privacy">
                        Showing the first 100 findings. Export the report for
                        the complete list.
                      </p>
                    )}
                  </section>
                  <ImpactPanel files={files} onOpenFile={openSource} />

                  <ChangeSimulation
                    files={files}
                    result={result}
                    disabled={disabled}
                    onApply={applySimulatedChange}
                  />

                  <TraceInspector
                    files={files}
                    result={result}
                    onOpenSource={(finding) => {
                      setSelectedFinding(finding.id);
                      openSource(finding.file, finding.line);
                    }}
                  />

                  <div className="health-top">
                    <div className="score-card">
                      <div
                        className="score-orbit"
                        style={{
                          background: `conic-gradient(#bbfa77 ${result.score}%,#27343b 0)`,
                        }}
                      >
                        <div>
                          <strong>{result.score}</strong>
                          <small>/ 100</small>
                        </div>
                      </div>
                      <div>
                        <small className="eyebrow">CURRENT HEALTH</small>
                        <h2>{scoreLabel(result.score)}</h2>
                        <p>
                          Formula: 100 minus a weighted penalty for each flagged
                          pattern. A score is not a security rating.
                        </p>
                      </div>
                    </div>
                    <div className="health-summary">
                      <div>
                        <small>TOTAL LINES</small>
                        <strong>{result.totalLines.toLocaleString()}</strong>
                      </div>
                      <div>
                        <small>RISK CLASS</small>
                        <strong>{result.risk}</strong>
                      </div>
                      <div>
                        <small>ACTIVE CHECKS</small>
                        <strong>{result.checks}</strong>
                      </div>
                      <div>
                        <small>BASELINE CHANGE</small>
                        <strong>
                          {baseline
                            ? (result.score - baseline.score >= 0 ? "+" : "") +
                              (result.score - baseline.score) +
                              " pts"
                            : "Not set"}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="section-grid">
                    <div className="section-panel">
                      <div className="section-title">
                        <Files size={18} /> File-by-file inspection{" "}
                        <span>{result.files.length}</span>
                      </div>
                      <div className="file-summary-head">
                        <span>FILE</span>
                        <span>LINES</span>
                        <span>ISSUES</span>
                      </div>
                      {[...result.files]
                        .sort((a, b) => b.findings - a.findings)
                        .map((f) => (
                          <button
                            className="file-summary"
                            key={f.path}
                            onClick={() => {
                              openSource(f.path);
                            }}
                          >
                            <span>
                              <FileCode2 size={15} />
                              {f.path}
                            </span>
                            <b>{f.lines}</b>
                            <em
                              className={
                                f.high + f.critical ? "risk-number" : ""
                              }
                            >
                              {f.findings}
                            </em>
                          </button>
                        ))}
                    </div>
                    <div className="section-panel sidebar-card">
                      <div className="section-title">
                        <GitCompareArrows size={18} /> Before / after
                      </div>
                      <h3>Make progress visible.</h3>
                      {baseline ? (
                        <>
                          <p>Saved {timeFormat(baseline.date)}</p>
                          <div className="compare-row">
                            <span>Health</span>
                            <b>
                              {baseline.score} → {result.score}
                            </b>
                          </div>
                          <div className="compare-row">
                            <span>Total signals</span>
                            <b>
                              {baseline.findings} → {result.findings.length}
                            </b>
                          </div>
                          <div className="compare-row">
                            <span>High + critical</span>
                            <b>
                              {baseline.high} →{" "}
                              {breakdown.high + breakdown.critical}
                            </b>
                          </div>
                        </>
                      ) : (
                        <p>
                          No baseline recorded yet. Save the current scan to
                          compare future changes.
                        </p>
                      )}
                      <button className="subtle wide" onClick={saveBaseline}>
                        <GitCompareArrows size={16} />{" "}
                        {baseline ? "Update baseline" : "Save as baseline"}
                      </button>
                      <p className="foot-note">
                        Only summary counts are stored in this browser. Source
                        code is never saved to history.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {section === "release" && (
            <>
              <section className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> RELEASE GATE / 004
                </div>
                <h1>
                  Ship with your
                  <br />
                  <span>eyes open.</span>
                </h1>
                <p>
                  A practical pre-release checklist based on the imported files
                  and current rule scan. Advisory only.
                </p>
              </section>
              <div className="gate-header">
                <div>
                  <small>GATE PROGRESS</small>
                  <strong>
                    {passed} <span>/ {gate.length} checks passed</span>
                  </strong>
                </div>
                <span
                  className={`gate-badge ${passed === gate.length ? "pass" : "warn"}`}
                >
                  {!result
                    ? "SCAN REQUIRED"
                    : passed === gate.length
                      ? "READY FOR REVIEW"
                      : "REVIEW NEEDED"}
                </span>
              </div>
              <div className="gate-progress">
                <div style={{ width: `${(passed / gate.length) * 100}%` }} />
              </div>
              <div className="gate-list">
                {gate.map((g, i) => (
                  <div key={g.name} className="gate-item">
                    <span className={`gate-icon ${g.good ? "pass" : "fail"}`}>
                      {g.good ? <Check size={18} /> : <CircleAlert size={18} />}
                    </span>
                    <div>
                      <h3>{g.name}</h3>
                      <p>{g.detail}</p>
                    </div>
                    <small>CHECK {String(i + 1).padStart(2, "0")}</small>
                  </div>
                ))}
              </div>
              <div className="gate-foot">
                <Info size={18} />
                <span>
                  Passing these checks does not guarantee production readiness.
                  Still run actual tests, dependency audits, builds and human
                  security review.
                </span>
                <button
                  className="subtle"
                  onClick={() => void runScan()}
                  disabled={busy}
                >
                  <ScanSearch size={15} /> {busy ? "Scanning" : "Re-scan"}
                </button>
              </div>
            </>
          )}
          {section === "rules" && (
            <>
              <section className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> RULEBOOK / 005
                </div>
                <h1>
                  No black box.
                  <br />
                  <span>Every rule is visible.</span>
                </h1>
                <p>
                  Review, understand or disable any heuristic. Disabled rules
                  are excluded from the next scan.
                </p>
              </section>
              <div className="rules-head">
                <div>
                  <strong>
                    {RULE_CATALOG.length - disabled.length} rules active
                  </strong>
                  <p>
                    {disabled.length} disabled · changes saved in this browser
                  </p>
                </div>
                <button
                  className="subtle"
                  onClick={() => {
                    persistRules([]);
                    setResult(null);
                    setNotice("All rules enabled. Run a fresh scan.");
                  }}
                >
                  <RotateCcw size={15} /> Reset all rules
                </button>
              </div>
              <div className="rule-grid">
                {RULE_CATALOG.map((r) => (
                  <div className="rule-card" key={r.id}>
                    <div className="rule-line">
                      <span className={`severity ${r.severity}`}>
                        <span className="severity-dot" />
                        {r.severity}
                      </span>
                      <span className="rule-id">{r.id}</span>
                    </div>
                    <h3>{r.title}</h3>
                    <p>{r.description}</p>
                    <div className="rule-bottom">
                      <span>{r.languages.join(" / ")}</span>
                      <button
                        className={`toggle ${disabled.includes(r.id) ? "off" : "on"}`}
                        aria-label={`${disabled.includes(r.id) ? "Enable" : "Disable"} ${r.id}`}
                        aria-pressed={!disabled.includes(r.id)}
                        onClick={() => {
                          persistRules(
                            disabled.includes(r.id)
                              ? disabled.filter((v) => v !== r.id)
                              : [...disabled, r.id],
                          );
                          setResult(null);
                        }}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {section === "history" && (
            <>
              <section className="page-heading">
                <div className="eyebrow">
                  <span className="eyebrow-bar" /> LOCAL HISTORY / 006
                </div>
                <h1>
                  Remember the work.
                  <br />
                  <span>Not your source.</span>
                </h1>
                <p>
                  Recent scan scores stay in your browser. Source code and
                  secrets are not persisted to this history.
                </p>
              </section>
              <div className="history-top">
                <div>
                  <strong>{snapshots.length} scan snapshots</strong>
                  <p>Summary metadata only · last 30 scans</p>
                </div>
                <button
                  className="subtle"
                  onClick={() => {
                    persistHistory([]);
                    setNotice("Local history cleared.");
                  }}
                  disabled={!snapshots.length}
                >
                  <Trash2 size={15} /> Clear history
                </button>
              </div>
              {snapshots.length ? (
                <div className="history-list">
                  {snapshots.map((s, i) => (
                    <div className="history-row" key={`${s.id}-${i}`}>
                      <div className="history-icon">
                        <Clock3 size={18} />
                      </div>
                      <div>
                        <strong>{timeFormat(s.time)}</strong>
                        <p>
                          {s.files} files · {s.findings} findings ·{" "}
                          {s.critical + s.high} urgent
                        </p>
                      </div>
                      <span className="history-score">
                        {s.score}
                        <small>/100</small>
                      </span>
                      <span className={`risk-pill ${s.risk.toLowerCase()}`}>
                        {s.risk}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="generic-empty tall">
                  <History size={28} />
                  <h3>There’s no history yet.</h3>
                  <p>Scan a project and the score will appear here.</p>
                  <button className="subtle" onClick={() => goTo("workbench")}>
                    Open workbench <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}

          <AppNotice
            message={repoDialogOpen && error ? "" : error || notice}
            tone={error ? "error" : "info"}
            onDismiss={() => {
              if (error) {
                setError("");
              } else {
                setNotice("");
              }
            }}
          />

          <footer className="site-footer">
            <span>
              © 2026 BRAXCODE DIGITALS FOUNDATION{" "}
              <span className="footer-divider">/</span> FORGEX STUDIO
            </span>
            
<nav
  aria-label="Product and legal information"
  style={{
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    fontSize: 11,
  }}
>
  <a
    href="/welcome"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: "#b9fa77" }}
  >
    About FORGEX
  </a>
  <a
    href="/privacy"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: "#b9fa77" }}
  >
    Privacy
  </a>
  <a
    href="/terms"
    target="_blank"
    rel="noopener noreferrer"
    style={{ color: "#b9fa77" }}
  >
    Terms
  </a>
</nav>

            <span>
              YOUR CODE. YOUR CONTROL. <span className="footer-divider">/</span>{" "}
              V0.2
            </span>
          </footer>
        </div>
      </section>
      <input
        className="hidden-input"
        type="file"
        multiple
        ref={inputRef}
        accept=".js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.json,.html,.htm,.css,.md,.txt,.yml,.yaml,.xml,.svg,.go,.rs,.java,.c,.h,.cpp,.hpp,.cs,.php,.sql,.sh"
        onChange={(e) => {
          void importFiles(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
      />
    </main>
  );
}

function NoScan({
  onScan,
  hasFiles,
}: {
  onScan: () => void;
  hasFiles: boolean;
}) {
  return (
    <div className="no-scan">
      <span className="empty-mark">
        <FileSearch size={30} />
      </span>

      <h2>{hasFiles ? "Ready for analysis." : "No project loaded yet."}</h2>

      <p>
        {hasFiles
          ? "Run analysis to populate this section with real findings."
          : "Import a repository or add your source files to begin."}
      </p>

      <button type="button" className="scan-btn" onClick={onScan}>
        {hasFiles ? <ScanSearch size={16} /> : <FilePlus2 size={16} />}

        {hasFiles ? "Analyze project" : "Go to Workbench"}

        <ArrowRight size={16} />
      </button>
    </div>
  );
}
