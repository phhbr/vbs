import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useErrorMessage } from "./useErrorMessage";

/**
 * A dead end gets its own screen rather than an inline hint, so an unknown
 * code or an expired session always offers a way forward.
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

  return (
    <main>
      <h1>{t("errors.title")}</h1>
      <p role="alert">{message}</p>
      <p>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            {t("errors.retry")}
          </button>
        )}{" "}
        <Link to="/">{t("errors.back")}</Link>
      </p>
    </main>
  );
}
