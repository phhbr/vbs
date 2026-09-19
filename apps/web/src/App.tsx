import { Header, LocaleToggle, ThemeToggle, useTheme } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";
import styles from "./App.module.css";

export function App() {
  const [theme, setTheme] = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "de";

  return (
    <div className={styles.page}>
      <Header
        title={t("app.title")}
        subtitle={t("app.subtitle")}
        actions={
          <>
            <ThemeToggle
              theme={theme}
              onChange={setTheme}
              label={t("theme.label")}
              darkLabel={t("theme.dark")}
              lightLabel={t("theme.light")}
              amtLabel={t("theme.amt")}
            />
            <LocaleToggle
              locale={locale}
              onChange={(next) => void i18n.changeLanguage(next)}
              label={t("language.label")}
              deLabel={t("language.de")}
              enLabel={t("language.en")}
            />
          </>
        }
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:code" element={<Session />} />
      </Routes>
    </div>
  );
}
