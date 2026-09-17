import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Shown once, right after creating a session. The link is never re-derivable:
 * the database keeps only a hash of the token.
 */
export function AdminRecoveryNotice({
  url,
  onAcknowledge,
}: {
  url: string;
  onAcknowledge: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <section>
      <h2>{t("admin.recoveryTitle")}</h2>
      <p role="alert">{t("admin.recoveryWarning")}</p>
      <p>
        <code>{url}</code>{" "}
        <button type="button" onClick={copy}>
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </button>
      </p>
      <p>
        <button type="button" onClick={onAcknowledge}>
          {t("admin.recoveryAcknowledge")}
        </button>
      </p>
    </section>
  );
}
