# Patch notes — Insights health score + first-run welcome

Two requested improvements live inside `src/components/MiniIDE.tsx` and
`src/app/studio/Workbench.tsx`. These files are too large to rewrite
safely through the current editing tooling without a byte-complete read,
so they are documented here as exact, minimal patches. Apply each patch,
then run the standard checks:

```bash
npm run typecheck
node --test tests/*.test.cjs
npm run build
```

No behavior outside the described areas changes.

---

## Patch 1 — Real health score in the Insights panel immediately

**Problem:** the Insights panel shows `Not scanned` until the user visits
Project Health. The IDE already computes advisory findings in the
background (`liveSignals`), so a score can be shown right away.

**File:** `src/components/MiniIDE.tsx`

### 1a. Compute a live score next to the existing live scan

Find the effect that sets `liveSignals` (search for `setLiveSignals(`):

```tsx
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
```

Replace it with a version that also stores the score:

```tsx
  const [liveScore, setLiveScore] = useState<number | null>(null);

  useEffect(() => {
    // Advisory quick scan, debounced; no source execution.
    const timer = window.setTimeout(() => {
      const chars = files.reduce((sum, file) => sum + file.content.length, 0);
      if (chars > 1_500_000) {
        setLiveSignals([]);
        setLiveScore(null);
        return;
      }
      try {
        const scan = analyzeProject(files, disabledRules);
        setLiveSignals(scan.findings.slice(0, 20));
        setLiveScore(scan.score);
      } catch {
        setLiveSignals([]);
        setLiveScore(null);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [files, disabledRules]);
```

Note: declare `liveScore` with the other state hooks; keep the comment
updated — the score IS now surfaced, but it is still advisory and does
not mutate the authoritative `healthScore` prop.

### 1b. Show the live score when the parent has not run a full scan

Find the Insights score block (search for `fxide-insight-score`):

```tsx
              <div className="fxide-insight-score">
                <span>Health score</span>
                <strong>
                  {healthScore === null || healthScore === undefined
                    ? "Not scanned"
                    : `${healthScore}/100`}
                </strong>
              </div>
```

Replace with:

```tsx
              <div className="fxide-insight-score">
                <span>Health score</span>
                <strong>
                  {healthScore === null || healthScore === undefined
                    ? liveScore === null
                      ? "Not scanned"
                      : `${liveScore}/100 · preview`
                    : `${healthScore}/100`}
                </strong>
              </div>
```

`· preview` marks it as the quick background scan result; a full
Project Health visit still replaces it with the authoritative score.

---

## Patch 2 — First-run welcome inside the workbench

**Problem:** opening the IDE for the first time shows an empty workspace
with no guidance.

**File:** `src/app/studio/Workbench.tsx`

### 2a. Add a dismissible welcome state

Next to the other `useState` declarations in the `Home()` component:

```tsx
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useEffect(() => {
    try {
      setWelcomeDismissed(
        localStorage.getItem("forgex-welcome-dismissed-v1") === "1",
      );
    } catch {
      setWelcomeDismissed(false);
    }
  }, []);

  function dismissWelcome() {
    setWelcomeDismissed(true);
    try {
      localStorage.setItem("forgex-welcome-dismissed-v1", "1");
    } catch {
      // Stays dismissed for this session.
    }
  }
```

### 2b. Render the strip above the MiniIDE

Find the workbench screen (search for `fx-workbench-screen`) and insert
this block immediately after that `<div>` opens, so it appears only when
the workspace is empty and the welcome was not dismissed:

```tsx
            {!welcomeDismissed && files.length === 0 && assets.length === 0 && (
              <section
                className="fx-get-started"
                aria-label="Getting started"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  margin: "0 0 12px",
                  padding: "12px 14px",
                  border: "1px solid #42684b",
                  borderRadius: 10,
                  background: "#16241c",
                  color: "#dbe9d6",
                  fontSize: 13,
                }}
              >
                <strong style={{ color: "#b9fa77" }}>Get started</strong>
                <span>
                  Create a new project, open a folder, or import a GitHub
                  repository. Press Run to preview, Analyze to scan.
                </span>
                <button
                  type="button"
                  onClick={dismissWelcome}
                  style={{
                    marginLeft: "auto",
                    border: 0,
                    background: "transparent",
                    color: "#9fb5ae",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Dismiss
                </button>
              </section>
            )}
```

The copy is deliberately short and factual; no emoji, no gradients, and
it disappears once the user has any file loaded.

---

## Acceptance checks after applying

- Insights panel shows a `NN/100 · preview` score immediately after the
  background scan finishes (empty workspace still shows `Not scanned`)
- Full score from Project Health still overrides the preview score
- First visit to `/studio` shows the Get started strip; Dismiss removes
  it and it does not return on reload
- `npm run typecheck`, `node --test tests/*.test.cjs`, `npm run build`
  all pass at the applied commit
