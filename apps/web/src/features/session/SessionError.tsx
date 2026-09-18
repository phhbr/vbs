import { BracketButton, Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import styles from "./SessionError.module.css";
import { useErrorMessage } from "./useErrorMessage";

/**
 * A dead end gets its own screen rather than an inline hint, so an unknown
 * code or an expired session always offers a way forward. One component for
 * every reason a session route can't be shown — session not found, expired,
 * full, a bad recovery token, and so on — since the only thing that changes
 * is which message errors.* maps to, not the layout.
 */
export function SessionErrorScreen({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const message = useErrorMessage()(error);
  useDocumentTitle(`${t("app.title")} — ${t("errors.title")}`);

  return (
    <main>
      <h1>{t("errors.title")}</h1>
      <Panel>
        <p role="alert" className={styles.message}>
          {message}
        </p>
        <p>
          {onRetry && (
            <BracketButton onClick={onRetry}>{t("errors.retry")}</BracketButton>
          )}{" "}
          <Link to="/" className={styles.backLink}>
            {t("errors.back")}
          </Link>
        </p>
      </Panel>
    </main>
  );
}
