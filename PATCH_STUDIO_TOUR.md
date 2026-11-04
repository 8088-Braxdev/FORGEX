# Patch notes — Studio product tour (first-run and on-demand)

The owner wants a lightweight guided tour: when someone downloads and opens
FORGEX for the first time, dialogs/steps walk them through the platform;
if they get stuck they can reopen the tour from where they left it and
continue. This document specifies an exact, minimal implementation.

All UI text below is final — human tone, no marketing filler, no emoji,
no machine-style numbering.

## Design principles

- Small, quiet dialogs — VS Code "Get Started" energy, not a modal wall
- Steps are one-line explanations of what is already on screen
- Progress is remembered; reopening resumes where the user stopped
- A visible, permanent "Tour" entry point so users can always return
- No new routes; the tour lives in the workbench layout

## Files to touch

- `src/app/studio/Workbench.tsx` — state, resume logic, tour entry point
- `src/app/style.css` — dialog styling (one small block)

## Implementation

### 1. Tour step definitions (add near the top of Workbench.tsx)

```tsx
type TourStep = {
  id: string;
  title: string;
  body: string;
  anchorId?: string; // element the dialog points to; optional
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to FORGEX",
    body: "This is your workspace. Everything runs in your browser — import code, edit it, preview it. This quick tour shows where things are; you can reopen it any time from the Help section in the footer.",
  },
  {
    id: "workspace",
    title: "Create or import",
    body: "Use New to start a project, Open folder to load files from your device, or Repository to import from GitHub. Nothing is sent anywhere until you choose to publish.",
  },
  {
    id: "run",
    title: "Run and preview",
    body: "Press Run to render your HTML/CSS/JS in the preview pane. Live preview updates as you type. Static projects only — FORGEX does not run servers.",
  },
  {
    id: "analyze",
    title: "Analyze your code",
    body: "Analyze scans your files locally and lists findings in the panels below: Problems for issues in your code, Output for preview messages. Findings are advisory hints, not a security audit.",
  },
  {
    id: "preview-notes",
    title: "About the preview",
    body: "Your project can call public HTTPS APIs from the preview, and the response renders right here. But sign-in flows like Google or email/password popups will not work inside the sandbox — they need a real browser window. Test those in a new tab.",
  },
  {
    id: "publish",
    title: "Publish to GitHub",
    body: "Connect GitHub, import your repository, review your changes in Source Control, then publish a pull request. FORGEX never pushes to your main branch directly.",
  },
  {
    id: "done",
    title: "That's the layout",
    body: "The rail on the left switches between Workbench, Security, Health, Release Gate, Rulebook and History. Get stuck anywhere? Reopen this tour from the footer's Help link and continue from where you stopped.",
  },
];
```

### 2. State and resume logic (inside `Home()`)

```tsx
const [tourIndex, setTourIndex] = useState<number | null>(null);

// Resume where the user stopped. Persisted per browser.
useEffect(() => {
  try {
    const saved = localStorage.getItem("forgex-tour-progress-v1");
    if (saved === "done") return; // completed; entry point still available
    const index = saved === null ? 0 : Number(saved);
    if (saved === null) {
      setTourIndex(0);
      localStorage.setItem("forgex-tour-progress-v1", "0");
    } else if (Number.isInteger(index) && index >= 0 && index < TOUR_STEPS.length) {
      setTourIndex(index);
    }
  } catch {
    // localStorage unavailable: show the tour once for this session only
    setTourIndex(0);
  }
}, []);

function tourNext() {
  const next = (tourIndex ?? 0) + 1;
  if (next >= TOUR_STEPS.length) {
    finishTour();
    return;
  }
  setTourIndex(next);
  try { localStorage.setItem("forgex-tour-progress-v1", String(next)); } catch {}
}

function finishTour() {
  setTourIndex(null);
  try { localStorage.setItem("forgex-tour-progress-v1", "done"); } catch {}
}

function reopenTour() {
  // Resume from the last unfinished step; if finished, start fresh.
  let start = 0;
  try {
    const saved = localStorage.getItem("forgex-tour-progress-v1");
    if (saved === "done") start = 0;
    else if (saved) start = Number(saved) || 0;
  } catch {}
  setTourIndex(start);
}
```

### 3. Tour dialog render (add inside the workbench screen, near AppNotice)

```tsx
{tourIndex !== null && TOUR_STEPS[tourIndex] && (
  <div
    className="fx-tour-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label={TOUR_STEPS[tourIndex].title}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) finishTour();
    }}
  >
    <div className="fx-tour-card">
      <strong className="fx-tour-title">{TOUR_STEPS[tourIndex].title}</strong>
      <p>{TOUR_STEPS[tourIndex].body}</p>
      <div className="fx-tour-actions">
        <button type="button" className="fx-tour-skip" onClick={finishTour}>
          Skip tour
        </button>
        <span className="fx-tour-progress" aria-live="polite">
          {(tourIndex ?? 0) + 1} / {TOUR_STEPS.length}
        </span>
        <button type="button" className="fx-tour-next" onClick={tourNext}>
          {tourIndex === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  </div>
)}
```

### 4. Permanent reopen entry point (studio footer)

In `SiteFooter`, add:

```tsx
<button type="button" className={styles.tourButton} onClick={onReopenTour}>
  Tour
</button>
```

`Workbench` passes `onReopenTour={reopenTour}` to `SiteFooter` (extend its
props by one optional callback; default no-op so other pages are unaffected).

### 5. Styles (append to `src/app/style.css`)

```css
/* Studio product tour */
.fx-tour-backdrop {
  position: fixed; inset: 0; z-index: 9500; display: flex;
  align-items: center; justify-content: center; padding: 16px;
  background: #05090dcc; backdrop-filter: blur(2px);
}
.fx-tour-card {
  width: min(420px, 100%); background: #101a21; border: 1px solid #3a5a49;
  border-radius: 12px; padding: 20px; color: #e6f0ea;
}
.fx-tour-title { display: block; color: #b9fa77; margin-bottom: 10px; font-size: 15px; }
.fx-tour-card p { margin: 0 0 16px; font-size: 13px; line-height: 1.7; color: #c3d4cd; }
.fx-tour-actions { display: flex; align-items: center; gap: 10px; }
.fx-tour-skip { border: 0; background: none; color: #8fa69e; font-size: 12px; cursor: pointer; }
.fx-tour-progress { margin-left: auto; font-size: 12px; color: #8fa69e; }
.fx-tour-next {
  border: 0; border-radius: 7px; background: #b9fa77; color: #102014;
  font-weight: 600; font-size: 12px; padding: 10px 18px; cursor: pointer;
}
.fx-tour-next:hover { background: #d0ff9e; }
@media (max-width: 580px) {
  .fx-tour-backdrop { align-items: flex-end; padding: 0; background: none; backdrop-filter: none; }
  .fx-tour-card { width: 100%; border-radius: 14px 14px 0 0; }
}
```

## Acceptance checks

1. First visit to `/studio` (no localStorage) → step 1 dialog appears
2. Next advances; closing the tab mid-tour and returning resumes at the saved step
3. Skip / Finish → sets "done"; no auto-reappearance; Help → Tour reopens it
4. Tour reopens resuming at last unfinished step; after completion reopens from step 1
5. Dialogs usable on a 320px phone (bottom sheet)
6. `npm run typecheck` and `npm run build` pass
