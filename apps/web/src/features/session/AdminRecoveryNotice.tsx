import { BracketButton, Panel } from "@vbs/ui";
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
    <Panel heading={t("admin.recoveryTitle")} headingLevel="h2">
      <p role="alert">{t("admin.recoveryWarning")}</p>
      <p>
        <code>{url}</code>{" "}
        <BracketButton onClick={copy}>
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </BracketButton>
      </p>
      <p>
        <BracketButton onClick={onAcknowledge}>
          {t("admin.recoveryAcknowledge")}
        </BracketButton>
      </p>
    </Panel>
  );
}
