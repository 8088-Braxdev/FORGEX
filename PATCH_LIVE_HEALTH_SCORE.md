# Patch notes — Live health score (background scan)

Status: the health score currently reads "Not scanned" on first load and
looks disabled. Root cause and exact fix below.

**Why this is documented, not applied:** `Workbench.tsx` is 78 KB. The
available editing path cannot write a file of that size in one atomic
operation (a truncation would corrupt the studio). The patch is small
and exact; apply it with a local editor and run the standard checks.

## Problem

`MiniIDE` receives `healthScore={result?.score ?? null}`, and `result`
stays `null` until the user presses Analyze or visits Project Health.
So the Insights panel shows "Not scanned" on every fresh session — the
score appears dead even though the analyzer works.

## Patch — `src/app/studio/Workbench.tsx`

### 1. Add a background-scan effect (after the workspace-draft effect)

Find the effect that saves the workspace draft (search for
`everHadWorkspace`) and add this block immediately after its closing
`}, [...]);`:

```tsx
  // Background health scan: populate the score once files exist so the
  // Insights panel is alive on first load instead of "Not scanned".
  // Advisory only — no history snapshot is recorded for this scan.
  const backgroundScanDone = useRef(false);

  useEffect(() => {
    if (backgroundScanDone.current) return;
    if (!workspaceDraftLoaded) return;
    if (files.length === 0) return;
    if (result !== null) { backgroundScanDone.current = true; return; }

    const totalChars = files.reduce(
      (sum, file) => sum + file.content.length,
      0,
    );
    if (totalChars > 1_500_000) { backgroundScanDone.current = true; return; }

    const timer = window.setTimeout(() => {
      backgroundScanDone.current = true;
      try {
        setResult(analyzeProject(files, disabled));
      } catch {
        // Score stays unavailable; the user can run Analyze manually.
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [workspaceDraftLoaded, files, disabled, result]);
```

### 2. (Optional) Remove the unused rail index codes

The `menu` tuples carry `"01"`..`"06"` strings that are never rendered:

```tsx
  const menu: [Section, typeof ScanSearch, string][] = [
    ["workbench", ScanSearch, "01"],
    ...
  ];
```

Simplify to `[Section, typeof ScanSearch][]` and drop the codes. Pure
dead-data cleanup; no visual change.

## After applying

```bash
npm run typecheck
node --test tests/*.test.cjs
npm run build
```

## Acceptance

- Open `/studio` with files loaded: the Insights health score shows a
  real `NN/100` within ~1s, with no user action
- Local History does NOT gain an entry from the background scan
  (only manual Analyze/import scans record history)
- Pressing Analyze still runs the full scan and records history as before