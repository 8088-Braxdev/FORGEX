
"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  Info,
  X,
} from "lucide-react";

type NoticeTone = "success" | "error" | "warning" | "info";

type Props = {
  message: string;
  tone?: NoticeTone;
  onDismiss: () => void;
};

const themes = {
  success: {
    background: "#243a2c",
    border: "#527a59",
    accent: "#b9fa77",
    title: "Success",
    Icon: CheckCircle2,
  },
  error: {
    background: "#382524",
    border: "#975c56",
    accent: "#ffb4a7",
    title: "Action failed",
    Icon: CircleAlert,
  },
  warning: {
    background: "#382f22",
    border: "#877346",
    accent: "#f4cf80",
    title: "Attention required",
    Icon: AlertTriangle,
  },
  info: {
    background: "#17252d",
    border: "#38505a",
    accent: "#b9fa77",
    title: "FORGEX notification",
    Icon: Info,
  },
};

export default function AppNotice({
  message,
  tone = "info",
  onDismiss,
}: Props) {
  const dismissRef = useRef(onDismiss);
  const [paused, setPaused] = useState(false);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!message || paused || tone === "error" || tone === "warning") return;
    const timer = window.setTimeout(() => dismissRef.current(), 8000);
    return () => window.clearTimeout(timer);
  }, [message, tone, paused]);
  if (!message) return null;

  const theme = themes[tone];
  const Icon = theme.Icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
      style={{
        position: "fixed",
        right: 16,
        bottom: "var(--fx-notice-bottom, calc(16px + env(safe-area-inset-bottom)))",
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        width: "min(420px, calc(100vw - 32px))",
        padding: "10px 12px",
        border: `1px solid ${theme.border}`,
        borderRadius: 11,
        background: theme.background,
        color: "#edf5f1",
        boxShadow: "0 18px 45px rgba(0,0,0,.45)",
      }}
    >
      <Icon
        size={19}
        color={theme.accent}
        style={{ flexShrink: 0, marginTop: 2 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong
          style={{
            display: tone === "info" ? "none" : "block",
            fontSize: 12,
            marginBottom: 5,
          }}
        >
          {theme.title}
        </strong>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: "#cbd9d7",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
        >
          {message}
        </p>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          border: 0,
          borderRadius: 6,
          background: "transparent",
          color: "#cbd9d7",
          cursor: "pointer",
        }}
      >
        <X size={17} />
      </button>
    </div>
  );
}
