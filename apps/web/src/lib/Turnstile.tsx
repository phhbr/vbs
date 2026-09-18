import { Turnstile as ReactTurnstile } from "@marsidev/react-turnstile";
import { useTranslation } from "react-i18next";

/**
 * Gates anonymous sign-in behind Cloudflare Turnstile. Rendered by AuthGate
 * only when VITE_TURNSTILE_SITE_KEY is set — unset locally and in CI, so
 * both stay hermetic by omission rather than by a feature flag (CLAUDE.md).
 */
export function Turnstile({
  siteKey,
  onSuccess,
}: {
  siteKey: string;
  onSuccess: (token: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p>{t("auth.captchaLabel")}</p>
      <ReactTurnstile siteKey={siteKey} onSuccess={onSuccess} />
    </div>
  );
}
