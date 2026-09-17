import { useTranslation } from "react-i18next";

export function Home() {
  const { t } = useTranslation();

  return (
    <main>
      <p>{t("home.placeholder")}</p>
    </main>
  );
}
