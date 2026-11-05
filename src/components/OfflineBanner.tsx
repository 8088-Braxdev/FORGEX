"use client";

import { useEffect, useState } from "react";

const HEARTBEAT_URL = "/manifest.webmanifest?sw=bypass";
const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * Global offline banner.
 *
 * `navigator.onLine` only reflects the network interface state, so this
 * component also runs a small same-origin heartbeat request to detect
 * captive portals and networks that are up but offer no internet.
 * The banner only appears for genuinely unreachable conditions.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!(typeof window !== "undefined")) return;

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
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

      if (!stopped) {
        setOffline(!reachable);
        timer = setTimeout(check, HEARTBEAT_INTERVAL_MS);
      }
    }

    void check();

    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="alert"
      aria-label="You are offline"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 14,
        zIndex: 1200,
        padding: "9px 16px",
        borderRadius: 999,
        border: "1px solid #877346",
        background: "#382f22",
        color: "#f4cf80",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.2,
        boxShadow: "0 6px 18px rgba(0, 0, 0, 0.35)",
      }}
    >
      Offline — cached pages remain available. Network features need a connection.
    </div>
  );
}