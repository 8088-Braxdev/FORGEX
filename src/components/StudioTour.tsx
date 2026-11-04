"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import styles from "./StudioTour.module.css";

type TourStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector for the element this step highlights; omitted for centered steps. */
  target?: string;
};

const PROGRESS_KEY = "forgex-tour-progress-v1";

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to FORGEX",
    body: "This is your workspace. Everything runs in your browser: import code, edit it, preview it. This short tour shows where things are. You can reopen it any time from the Tour button.",
  },
  {
    id: "workspace",
    title: "Create or import",
    body: "Use New to start a project, Open folder to load files from your device, or Repository to import from GitHub. Nothing leaves your browser until you choose to publish.",
    target: ".fxide-primary-actions",
  },
  {
    id: "run",
    title: "Run and preview",
    body: "Press Run to render your HTML, CSS and JavaScript in the preview pane. Live preview updates as you type. Static projects only — FORGEX does not run servers.",
    target: "button[aria-label='Run preview']",
  },
  {
    id: "analyze",
    title: "Analyze your code",
    body: "Analyze scans your files locally and lists findings in the panels below: Problems for issues in your code, Output for preview messages. Findings are advisory hints, not a security audit.",
    target: "button[aria-label='Analyze project']",
  },
  {
    id: "preview-notes",
    title: "About the preview",
    body: "Your project can call public HTTPS APIs from the preview and show real responses. But sign-in flows like Google or password popups cannot complete inside the sandbox — they need a real browser window. Test those in a separate tab.",
    target: ".fxide-preview",
  },
  {
    id: "publish",
    title: "Publish to GitHub",
    body: "Connect GitHub, import your repository, review your changes in Source Control, then publish a pull request. FORGEX never pushes to your main branch directly.",
    target: "[aria-label='GitHub account']",
  },
  {
    id: "done",
    title: "That's the layout",
    body: "The rail on the left switches between Workbench, Security, Health, Release Gate, Rulebook and History. If you get stuck, press the Tour button and continue from where you stopped.",
  },
];

/** True when the element is actually rendered and takes space on screen. */
function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}

export default function StudioTour() {
  const [index, setIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // On mount: start the tour for first-time visitors and resume it for
  // anyone who left mid-way. Completed visitors only see the Tour button.
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved === null) {
        setIndex(0);
        localStorage.setItem(PROGRESS_KEY, "0");
      } else if (saved !== "done") {
        const resume = Number(saved);
        if (Number.isInteger(resume) && resume >= 0 && resume < TOUR_STEPS.length) {
          setIndex(resume);
        }
      }
    } catch {
      // Storage unavailable: offer the tour once for this session.
      setIndex(0);
    }
  }, []);

  // Measure the element the current step highlights so the spotlight ring
  // follows it, and scroll it into view. Invisible or missing targets
  // fall back to a centered dialog so the ring never floats over a
  // collapsed pane.
  useEffect(() => {
    if (index === null) {
      setTargetRect(null);
      return;
    }
    const selector = TOUR_STEPS[index].target;
    if (!selector) {
      setTargetRect(null);
      return;
    }
    let element: Element | null = null;
    try {
      element = document.querySelector(selector);
    } catch {
      element = null;
    }
    if (!element || !isVisible(element)) {
      setTargetRect(null);
      return;
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const measured = element;
    const measure = () => {
      if (!isVisible(measured)) {
        setTargetRect(null);
        return;
      }
      const rect = measured.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    measure();
    const timer = window.setInterval(measure, 300);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index]);

  const save = useCallback((value: string) => {
    try {
      localStorage.setItem(PROGRESS_KEY, value);
    } catch {
      // Session-only progress; the tour still works without persistence.
    }
  }, []);

  const finish = useCallback(() => {
    setIndex(null);
    save("done");
  }, [save]);

  const next = useCallback(() => {
    setIndex((current) => {
      if (current === null) return null;
      const step = current + 1;
      if (step >= TOUR_STEPS.length) {
        save("done");
        return null;
      }
      save(String(step));
      return step;
    });
  }, [save]);

  const reopen = useCallback(() => {
    let start = 0;
    try {
      const saved = localStorage.getItem(PROGRESS_KEY);
      if (saved && saved !== "done") start = Number(saved) || 0;
    } catch {
      start = 0;
    }
    setIndex(start);
  }, []);

  if (!mounted) return null;

  const step = index === null ? null : TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  return (
    <>
      {step && (
        <>
          <div className={styles.dim} aria-hidden="true" />
          {targetRect && (
            <div
              className={styles.spotlight}
              style={{
                top: targetRect.top - 4,
                left: targetRect.left - 4,
                width: targetRect.width + 8,
                height: targetRect.height + 8,
              }}
              aria-hidden="true"
            />
          )}
          <div
            className={styles.backdrop}
            role="dialog"
            aria-modal="true"
            aria-label={step.title}
          >
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <strong className={styles.title}>{step.title}</strong>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={finish}
                  aria-label="Close tour"
                >
                  <X size={16} />
                </button>
              </div>
              <p className={styles.body}>{step.body}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.skip} onClick={finish}>
                  Skip tour
                </button>
                <span className={styles.progress} aria-live="polite">
                  {(index ?? 0) + 1} / {TOUR_STEPS.length}
                </span>
                <button type="button" className={styles.next} onClick={next}>
                  {last ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hidden while the tour is open so it never covers footer content
          (email, support links) during a walkthrough. */}
      <button
        type="button"
        className={`${styles.reopen} ${index !== null ? styles.reopenHidden : ""}`}
        onClick={reopen}
        aria-label="Open the FORGEX tour"
        title="Open the FORGEX tour"
      >
        <HelpCircle size={15} />
        <span>Tour</span>
      </button>
    </>
  );
}