import { BracketButton } from "@vbs/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function ShareLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <p>
      {t("lobby.link")}: <a href={url}>{url}</a>{" "}
      <BracketButton onClick={copy}>
        {copied ? t("lobby.copied") : t("lobby.copy")}
      </BracketButton>
    </p>
  );
}
