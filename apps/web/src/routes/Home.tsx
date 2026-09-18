import { useTranslation } from "react-i18next";
import { CreateSessionForm } from "../features/session/CreateSessionForm";
import { JoinByCodeForm } from "../features/session/JoinByCodeForm";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import styles from "./Home.module.css";

export function Home() {
  const { t } = useTranslation();
  useDocumentTitle(`${t("app.title")} — ${t("home.heading")}`);

  return (
    <main>
      <h1 className={styles.heading}>{t("home.heading")}</h1>
      <div className={styles.panels}>
        <CreateSessionForm />
        <JoinByCodeForm />
      </div>
    </main>
  );
}
