import { formatSessionCode } from "@vbs/core";
import { BracketButton, Dialog } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Shown once, right after minting a token — at creation, or after
 * regenerating one from within the session. The link is never re-derivable
 * (the database keeps only a hash) and never rendered as text here either:
 * a leaked screenshot of this panel must not leak the token along with it
 * (design revision finding 7). Only the session code is shown; the copy
 * button reaches for the full URL directly.
 */
export function AdminRecoveryNotice({
  code,
  url,
  onAcknowledge,
}: {
  code: string;
  url: string;
  onAcknowledge: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <Dialog titleId={titleId} onClose={onAcknowledge}>
      <h2 id={titleId} className="page-heading">
        {t("admin.recoveryTitle")}
      </h2>
      <p role="alert" className="prose">
        {t("admin.recoveryWarning")}
      </p>
      <p>
        {t("admin.recoverySession")} <strong>{formatSessionCode(code)}</strong>
      </p>
      <p>
        <BracketButton variant="primary" onClick={copy}>
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </BracketButton>
      </p>
      <p>
        <BracketButton onClick={onAcknowledge}>
          {t("admin.recoveryAcknowledge")}
        </BracketButton>
      </p>
    </Dialog>
  );
}
