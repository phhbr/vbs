import { useTranslation } from "react-i18next";

export function RulesTab() {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t("session.rulesHeading")}</h2>
      <p>{t("session.rulesIntro")}</p>
      <p>{t("session.rulesDiscussion")}</p>
    </div>
  );
}
