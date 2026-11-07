"use client";

import { useEffect, useRef, useState } from "react";
import {
  INITIAL_CONNECTIVITY,
  connectivityTransition,
  type ConnectivityState,
} from "@/lib/connectivity";

const HEARTBEAT_URL = "/manifest.webmanifest?sw=bypass";
const HEARTBEAT_INTERVAL_MS = 30000;
const OFFLINE_TOAST_MS = 4500;
const ONLINE_TOAST_MS = 3000;

type Toast = { kind: "offline" | "online"; id: number };

export default function OfflineBanner() {
  const [toast, setToast] = useState<Toast | null>(null);
  const stateRef = useRef<ConnectivityState>(INITIAL_CONNECTIVITY);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const stoppedRef = useRef(false);

  function showToast(kind: "offline" | "online") {
    if (toastTimer.current !== undefined) clearTimeout(toastTimer.current);
    setToast({ kind, id: Date.now() });
    toastTimer.current = setTimeout(
      () => setToast(null),
      kind === "offline" ? OFFLINE_TOAST_MS : ONLINE_TOAST_MS,
    );
  }

  function applyTransition(transition: "none" | "toOffline" | "toOnline") {
    if (transition === "toOffline") showToast("offline");
    else if (transition === "toOnline") showToast("online");
  }

  useEffect(() => {
    stoppedRef.current = false;

    async function check() {
      if (stoppedRef.current) return;
      let reachable = false;
      try {
        const response = await fetch(HEARTBEAT_URL, {
          method: "GET",
          cache: "no-store",
        });
        reachable = response.ok || response.type === "opaque";
      } catch {
        reachable = false;
      }
      if (stoppedRef.current) return;

      const event = reachable ? "success" : "failure";
      const result = connectivityTransition(stateRef.current, event);
      stateRef.current = result.state;
      applyTransition(result.transition);

      heartbeatTimer.current = setTimeout(check, HEARTBEAT_INTERVAL_MS);
    }

    function onOnline() {
      const result = connectivityTransition(stateRef.current, "navigator-online");
      stateRef.current = result.state;
      applyTransition(result.transition);
    }

    function onOffline() {
      const result = connectivityTransition(
        stateRef.current,
        "navigator-offline",
      );
      stateRef.current = result.state;
      applyTransition(result.transition);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    void check();

    return () => {
      stoppedRef.current = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (heartbeatTimer.current !== undefined)
        clearTimeout(heartbeatTimer.current);
      if (toastTimer.current !== undefined) clearTimeout(toastTimer.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <>
      <style>{`
        .fx-connectivity-toast {
          position: fixed;
          right: 16px;
          bottom: calc(16px + env(safe-area-inset-bottom));
          z-index: 1200;
          max-width: 360px;
          padding: 10px 12px 10px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .fx-connectivity-toast.offline {
          background: #382f22;
          color: #f4cf80;
          border: 1px solid #877346;
        }
        .fx-connectivity-toast.online {
          background: #1f3324;
          color: #b9fa77;
          border: 1px solid #3d5a49;
        }
        .fx-connectivity-toast button {
          background: transparent;
          border: 0;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0 0 0 4px;
        }
        @media (max-width: 640px) {
          .fx-connectivity-toast {
            left: 50%;
            right: auto;
            transform: translateX(-50%);
            bottom: calc(16px + env(safe-area-inset-bottom));
            width: calc(100vw - 32px);
          }
        }
      `}</style>
      <div
        className={`fx-connectivity-toast ${toast.kind}`}
        role="status"
        aria-live="polite"
      >
        <span>
          {toast.kind === "offline"
            ? "You're offline. FORGEX keeps working with cached files."
            : "Back online"}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            if (toastTimer.current !== undefined)
              clearTimeout(toastTimer.current);
            setToast(null);
          }}
        >
          ×
        </button>
      </div>
    </>
  );
}