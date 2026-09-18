import { Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";

export function RulesTab() {
  const { t } = useTranslation();

  return (
    <Panel heading={t("session.rulesHeading")}>
      <p className="prose">{t("session.rulesIntro")}</p>
      <p className="prose">{t("session.rulesDiscussion")}</p>
    </Panel>
  );
}
