import { Footer, Header, LocaleToggle, ThemeSelect, useTheme } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Link, Route, Routes } from "react-router";
import { Datenschutz } from "./routes/Datenschutz";
import { Home } from "./routes/Home";
import { Impressum } from "./routes/Impressum";
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
            <ThemeSelect
              theme={theme}
              onChange={setTheme}
              label={t("theme.label")}
              groupModernLabel={t("theme.groupModern")}
              groupRetroLabel={t("theme.groupRetro")}
              modernLightLabel={t("theme.modernLight")}
              modernDarkLabel={t("theme.modernDark")}
              lightLabel={t("theme.light")}
              darkLabel={t("theme.dark")}
              amtLabel={t("theme.amt")}
              vb6Label={t("theme.vb6")}
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
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
      </Routes>
      <Footer
        segments={[
          <Link to="/impressum" key="impressum">
            {t("legal.footer.impressum")}
          </Link>,
          <Link to="/datenschutz" key="datenschutz">
            {t("legal.footer.datenschutz")}
          </Link>,
        ]}
      />
    </div>
  );
}
