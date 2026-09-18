import * as Sentry from "@sentry/react";

// Unset locally and in CI, same hermetic-by-omission pattern as Turnstile
// (CLAUDE.md's Captcha section) — no DSN, no Sentry, not even a no-op client.
const DSN = import.meta.env["VITE_SENTRY_DSN"];

export function initErrorTracking() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // No replay, no tracing, no default PII: this app's errors must never
    // carry a nickname, vote value, or session code incidentally captured
    // from the DOM or request headers.
    sendDefaultPii: false,
    integrations: [],
  });
}
