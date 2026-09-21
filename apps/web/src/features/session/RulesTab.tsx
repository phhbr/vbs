import { Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { SupportLink, supportUrl } from "../support/SupportLink";

export function RulesTab() {
  const { t } = useTranslation();

  return (
    <>
      <Panel heading={t("session.rulesHeading")}>
        <p className="prose">{t("session.rulesIntro")}</p>
        <p className="prose">{t("session.rulesDiscussion")}</p>
      </Panel>
      {supportUrl() && (
        <Panel heading={t("support.rulesHeading")}>
          <p className="prose">{t("support.rulesBody")}</p>
          <SupportLink />
        </Panel>
      )}
    </>
  );
}
