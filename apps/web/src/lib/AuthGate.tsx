import type { User } from "@supabase/supabase-js";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ensureAnonymousUser } from "./auth";
import { UserContext } from "./currentUser";

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    ensureAnonymousUser().then(
      (signedIn) => active && setUser(signedIn),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <p role="alert">{t("auth.failed")}</p>;
  if (!user) return <p>{t("auth.signingIn")}</p>;
  return <UserContext value={user}>{children}</UserContext>;
}
