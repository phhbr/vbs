import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

export function Session() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();

  return (
    <main>
      <p>{t("session.placeholder", { code })}</p>
    </main>
  );
}
