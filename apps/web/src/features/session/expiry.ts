import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const WARNING_WINDOW_MS = 60 * 60 * 1000;
const RECOMPUTE_INTERVAL_MS = 30 * 1000;

/**
 * A clock, not an animation: recomputed on an interval rather than tied to
 * render, so the status bar and the warning banner stay accurate on a tab
 * left open. `isNear` flips true one hour out — the WCAG timeout warning
 * window — and stays true past the deadline until the realtime
 * session_expired broadcast (see realtime.ts) replaces this screen entirely.
 */
export function useExpiryStatus(expiresAt: string) {
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const expiresAtMs = new Date(expiresAt).getTime();
  const formatted = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(expiresAtMs);

  return {
    formatted,
    isNear: expiresAtMs - now <= WARNING_WINDOW_MS,
  };
}
