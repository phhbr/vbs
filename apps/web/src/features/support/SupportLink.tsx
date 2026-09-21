import { useTranslation } from "react-i18next";

// Read at call time, not at module scope like lib/sentry.ts and
// lib/AuthGate.tsx — those are one-shot initialisers, this is rendered by
// tests in both states, and vi.stubEnv only affects reads that happen after
// the stub is installed.
export function supportUrl(): string | undefined {
  return import.meta.env["VITE_SUPPORT_URL"];
}

export function SupportLink() {
  const { t } = useTranslation();
  const url = supportUrl();

  if (!url) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {t("support.link")}
      {/* WCAG G201: announce the context change; a new tab keeps a live
       * session's realtime connection intact instead of navigating away. */}
      <span className="visually-hidden"> ({t("support.newTab")})</span>
    </a>
  );
}
