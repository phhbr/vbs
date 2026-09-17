import { useTheme } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";
import { Home } from "./routes/Home";
import { Session } from "./routes/Session";

export function App() {
  const [theme, setTheme] = useTheme();
  const { t, i18n } = useTranslation();

  return (
    <>
      <header>
        <p>{t("app.title")}</p>
        <p>{t("app.subtitle")}</p>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? t("theme.dark") : t("theme.light")}
        </button>
        <button type="button" onClick={() => void i18n.changeLanguage("de")}>
          {t("language.de")}
        </button>
        <button type="button" onClick={() => void i18n.changeLanguage("en")}>
          {t("language.en")}
        </button>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:code" element={<Session />} />
      </Routes>
    </>
  );
}
