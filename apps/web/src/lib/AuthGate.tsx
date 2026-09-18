import type { User } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ensureAnonymousUser } from "./auth";
import { UserContext } from "./currentUser";
import { Turnstile } from "./Turnstile";

// Unset locally and in CI, so both sign in with no captcha step at all —
// hermetic by omission, not a feature flag (CLAUDE.md's Captcha section).
const TURNSTILE_SITE_KEY = import.meta.env["VITE_TURNSTILE_SITE_KEY"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState(false);
  // null = still waiting on the widget; "" = no captcha configured, proceed
  // immediately; anything else = a verified token, ready to sign in with.
  const [captchaToken, setCaptchaToken] = useState<string | null>(
    TURNSTILE_SITE_KEY ? null : "",
  );

  useEffect(() => {
    if (captchaToken === null) return;
    let active = true;
    ensureAnonymousUser(captchaToken || undefined).then(
      (signedIn) => active && setUser(signedIn),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [captchaToken]);

  if (failed) return <p role="alert">{t("auth.failed")}</p>;
  if (captchaToken === null) {
    return (
      <Turnstile siteKey={TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} />
    );
  }
  if (!user) return <p>{t("auth.signingIn")}</p>;
  return <UserContext value={user}>{children}</UserContext>;
}
