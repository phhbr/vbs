import { Header, LocaleToggle, ThemeToggle, useTheme } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";

export function App() {
  const [theme, setTheme] = useTheme();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "de";

  return (
    <>
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
            />
            <span aria-hidden="true">&middot;</span>
            <LocaleToggle
              locale={locale}
              onChange={(next) => void i18n.changeLanguage(next)}
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
    </>
  );
}
