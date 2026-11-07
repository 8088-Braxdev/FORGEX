"use client";

import { useEffect, useRef, useState } from "react";
import AppNotice from "@/components/AppNotice";
import {
  INITIAL_CONNECTIVITY,
  connectivityTransition,
  type ConnectivityState,
} from "@/lib/connectivity";

const HEARTBEAT_URL = "/manifest.webmanifest?sw=bypass";
const HEARTBEAT_INTERVAL_MS = 30000;
const OFFLINE_TOAST_MS = 4500;
const ONLINE_TOAST_MS = 3000;

export default function OfflineBanner() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "warning" | "info">("info");
  const [duration, setDuration] = useState(0);

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
    if (kind === "offline") {
      setMessage("You're offline. FORGEX keeps working with cached files.");
      setTone("warning");
      setDuration(OFFLINE_TOAST_MS);
    } else {
      setMessage("Back online");
      setTone("success");
      setDuration(ONLINE_TOAST_MS);
    }
    toastTimer.current = setTimeout(() => {
      setMessage("");
      setDuration(0);
    }, kind === "offline" ? OFFLINE_TOAST_MS : ONLINE_TOAST_MS);
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

  return (
    <AppNotice
      message={message}
      tone={tone}
      duration={duration}
      onDismiss={() => {
        if (toastTimer.current !== undefined) clearTimeout(toastTimer.current);
        setMessage("");
        setDuration(0);
      }}
    />
  );
}