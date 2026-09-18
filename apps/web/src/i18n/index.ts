import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import roundDe from "../features/round/locales/de.json";
import roundEn from "../features/round/locales/en.json";
import sessionDe from "../features/session/locales/de.json";
import sessionEn from "../features/session/locales/en.json";
import commonDe from "./locales/de.json";
import commonEn from "./locales/en.json";

// Keys live with the feature (CLAUDE.md), merged here into one namespace so
// components call plain t("lobby.title") without namespace boilerplate. Each
// file owns distinct top-level keys, so a shallow merge is enough.
const de = { ...commonDe, ...sessionDe, ...roundDe };
const en = { ...commonEn, ...sessionEn, ...roundEn };

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    fallbackLng: "de",
    supportedLngs: ["de", "en"],
    interpolation: {
      escapeValue: false,
    },
  });

// CLAUDE.md: <html lang> follows the active locale.
const applyDocumentLanguage = (lng: string) => {
  document.documentElement.lang = lng;
};
applyDocumentLanguage(i18next.resolvedLanguage ?? "de");
i18next.on("languageChanged", applyDocumentLanguage);

export default i18next;
