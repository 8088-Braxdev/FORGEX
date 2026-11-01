
import * as vscode from "vscode";
import {
  analyze,
  inferLanguage,
  type Finding
} from "../../src/lib/analyzer";

const SUPPORTED_LANGUAGES = new Set([
  "javascript",
  "javascriptreact",
  "typescript",
  "typescriptreact",
  "python",
  "html",
  "css",
  "json"
]);

const MAX_FILES = 120;
const MAX_FILE_CHARS = 400_000;
const MAX_TOTAL_CHARS = 2_000_000;

const FILE_GLOB =
  "**/*.{js,jsx,mjs,cjs,ts,tsx,py,html,htm,css,json}";

const EXCLUDE_GLOB =
  "**/{node_modules,.git,.next,dist,build,coverage,out,vendor}/**";

const priority: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export function activate(context: vscode.ExtensionContext) {
  const diagnostics =
    vscode.languages.createDiagnosticCollection("FORGEX");

  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50
  );

  status.command = "forgex.showFindings";
  status.tooltip = "FORGEX: local code inspection";
  status.show();

  let enabled = true;

  const timers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  function eligible(doc: vscode.TextDocument): boolean {
    return (
      doc.uri.scheme === "file" &&
      SUPPORTED_LANGUAGES.has(doc.languageId)
    );
  }

  function getFindings(
    doc: vscode.TextDocument
  ): Finding[] {
    if (
      !eligible(doc) ||
      doc.getText().length > MAX_FILE_CHARS
    ) {
      return [];
    }

    return analyze(
      doc.getText(),
      inferLanguage(doc.fileName),
      doc.fileName
    );
  }

  function toDiagnostics(
    doc: vscode.TextDocument,
    findings: Finding[]
  ): vscode.Diagnostic[] {
    return findings.map(f => {
      const line = Math.max(
        0,
        Math.min(doc.lineCount - 1, f.line - 1)
      );

      const text = doc.lineAt(line).text;

      const col = Math.max(
        0,
        Math.min(text.length, f.column - 1)
      );

      const end = Math.min(text.length, col + 1);

      const severity =
        f.severity === "critical" ||
        f.severity === "high"
          ? vscode.DiagnosticSeverity.Error
          : f.severity === "medium"
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(line, col, line, end),
        `${f.title}\n${f.detail}\nAction: ${f.fix}\nConfidence: ${f.confidence}`,
        severity
      );

      diagnostic.source = "FORGEX";
      diagnostic.code = f.ruleId;

      return diagnostic;
    });
  }

  function refreshStatus() {
    const doc =
      vscode.window.activeTextEditor?.document;

    if (!enabled) {
      status.text = "$(circle-slash) FORGEX paused";
    } else if (!doc || !eligible(doc)) {
      status.text = "$(shield) FORGEX ready";
    } else if (
      doc.getText().length > MAX_FILE_CHARS
    ) {
      status.text = "$(shield) FORGEX file too large";
    } else {
      const count =
        diagnostics.get(doc.uri)?.length ?? 0;

      status.text =
        `$(shield) FORGEX: ${count} signals`;
    }
  }

  function inspect(doc: vscode.TextDocument) {
    if (
      !enabled ||
      !eligible(doc) ||
      doc.getText().length > MAX_FILE_CHARS
    ) {
      diagnostics.delete(doc.uri);
    } else {
      diagnostics.set(
        doc.uri,
        toDiagnostics(doc, getFindings(doc))
      );
    }

    refreshStatus();
  }

  function schedule(doc: vscode.TextDocument) {
    if (!eligible(doc)) return;

    const key = doc.uri.toString();
    const previous = timers.get(key);

    if (previous) clearTimeout(previous);

    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        inspect(doc);
      }, 350)
    );
  }

  // Project-wide inspection
  const scanWorkspace =
    vscode.commands.registerCommand(
      "forgex.scanWorkspace",
      async () => {
        if (!enabled) {
          vscode.window.showWarningMessage(
            "FORGEX is paused. Enable it first."
          );
          return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
          vscode.window.showInformationMessage(
            "Open a folder in VS Code first."
          );
          return;
        }

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "FORGEX: Scanning workspace",
            cancellable: true
          },
          async (progress, token) => {
            try {
              const uris =
                await vscode.workspace.findFiles(
                  FILE_GLOB,
                  EXCLUDE_GLOB,
                  MAX_FILES + 1,
                  token
                );

              const candidates = uris.filter(
                uri =>
                  uri.scheme === "file" &&
                  !/(^|\/)(package-lock\.json|tsconfig\.tsbuildinfo)$/i.test(
                    uri.path
                  ) &&
                  !/(^|\/)\.env(?:\.|$)/i.test(
                    uri.path
                  )
              );

              const selected =
                candidates.slice(0, MAX_FILES);

              let scanned = 0;
              let signals = 0;
              let skipped = 0;
              let totalChars = 0;

              diagnostics.clear();

              for (const uri of selected) {
                if (token.isCancellationRequested) {
                  break;
                }

                try {
                  const doc =
                    await vscode.workspace.openTextDocument(
                      uri
                    );

                  const length = doc.getText().length;

                  if (
                    !eligible(doc) ||
                    length > MAX_FILE_CHARS ||
                    totalChars + length > MAX_TOTAL_CHARS
                  ) {
                    skipped++;
                    continue;
                  }

                  totalChars += length;

                  const items = getFindings(doc);

                  diagnostics.set(
                    uri,
                    toDiagnostics(doc, items)
                  );

                  scanned++;
                  signals += items.length;

                  progress.report({
                    message: `${scanned} files checked`
                  });
                } catch {
                  skipped++;
                }
              }

              vscode.workspace.textDocuments
                .filter(doc => doc.isDirty)
                .forEach(schedule);

              refreshStatus();

              const partial =
                uris.length > MAX_FILES ||
                skipped > 0 ||
                token.isCancellationRequested;

              const summary =
                `FORGEX: ${scanned} files, ` +
                `${signals} signals` +
                (partial ? " (partial scan)" : "");

              vscode.window.showInformationMessage(
                summary
              );

              await vscode.commands.executeCommand(
                "workbench.actions.view.problems"
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                "FORGEX scan failed: " +
                  (error instanceof Error
                    ? error.message
                    : String(error))
              );
            }
          }
        );
      }
    );

  // Navigate findings in active file
  const showFindings =
    vscode.commands.registerCommand(
      "forgex.showFindings",
      async () => {
        const editor =
          vscode.window.activeTextEditor;

        if (!editor || !eligible(editor.document)) {
          vscode.window.showInformationMessage(
            "Open a supported source file."
          );
          return;
        }

        if (!enabled) {
          vscode.window.showInformationMessage(
            "FORGEX is paused."
          );
          return;
        }

        const findings = getFindings(
          editor.document
        ).sort(
          (a, b) =>
            priority[a.severity] -
              priority[b.severity] ||
            a.line - b.line
        );

        if (!findings.length) {
          vscode.window.showInformationMessage(
            "No FORGEX patterns flagged in this file."
          );
          return;
        }

        const selected =
          await vscode.window.showQuickPick(
            findings.map(f => ({
              label:
                `${f.severity.toUpperCase()} • ${f.title}`,
              description:
                `Line ${f.line} · ${f.ruleId}`,
              detail: f.fix,
              finding: f
            })),
            {
              placeHolder:
                `${findings.length} findings · Select to inspect`
            }
          );

        if (!selected) return;

        const line = Math.max(
          0,
          Math.min(
            editor.document.lineCount - 1,
            selected.finding.line - 1
          )
        );

        const col = Math.max(
          0,
          selected.finding.column - 1
        );

        const pos = new vscode.Position(
          line,
          Math.min(
            col,
            editor.document.lineAt(line).text.length
          )
        );

        editor.selection =
          new vscode.Selection(pos, pos);

        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
      }
    );

  // Pause and resume
  const toggle =
    vscode.commands.registerCommand(
      "forgex.toggle",
      () => {
        enabled = !enabled;

        if (!enabled) {
          diagnostics.clear();
        } else {
          vscode.workspace.textDocuments.forEach(
            schedule
          );
        }

        refreshStatus();

        vscode.window.showInformationMessage(
          enabled
            ? "FORGEX live scanning enabled."
            : "FORGEX live scanning paused."
        );
      }
    );

  // Quick Fix integration
  const quickFixes =
    vscode.languages.registerCodeActionsProvider(
      [...SUPPORTED_LANGUAGES],
      {
        provideCodeActions(
          doc,
          range
        ): vscode.CodeAction[] {
          if (!enabled || !eligible(doc)) {
            return [];
          }

          return getFindings(doc)
            .filter(
              f =>
                f.line - 1 === range.start.line &&
                f.replacement !== undefined
            )
            .filter(
              f =>
                doc.lineAt(f.line - 1)
                  .text.trim()
                  .slice(0, 240) === f.evidence
            )
            .map(f => {
              const action =
                new vscode.CodeAction(
                  `FORGEX: ${f.title} (review fix)`,
                  vscode.CodeActionKind.QuickFix
                );

              const edit =
                new vscode.WorkspaceEdit();

              edit.replace(
                doc.uri,
                doc.lineAt(f.line - 1).range,
                f.replacement!
              );

              action.edit = edit;
              action.isPreferred = false;

              return action;
            });
        }
      },
      {
        providedCodeActionKinds: [
          vscode.CodeActionKind.QuickFix
        ]
      }
    );

  context.subscriptions.push(
    diagnostics,
    status,
    showFindings,
    toggle,
    scanWorkspace,
    quickFixes,

    vscode.workspace.onDidOpenTextDocument(
      schedule
    ),

    vscode.workspace.onDidChangeTextDocument(
      e => schedule(e.document)
    ),

    vscode.workspace.onDidSaveTextDocument(
      schedule
    ),

    vscode.workspace.onDidCloseTextDocument(
      doc => {
        const key = doc.uri.toString();
        const timer = timers.get(key);

        if (timer) clearTimeout(timer);

        timers.delete(key);
        refreshStatus();
      }
    ),

    vscode.window.onDidChangeActiveTextEditor(
      editor => {
        if (editor) schedule(editor.document);
        refreshStatus();
      }
    ),

    new vscode.Disposable(() => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    })
  );

  vscode.workspace.textDocuments.forEach(
    schedule
  );

  refreshStatus();
}

export function deactivate() {}
