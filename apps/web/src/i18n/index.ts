import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import legalDe from "../features/legal/locales/de.json";
import legalEn from "../features/legal/locales/en.json";
import roundDe from "../features/round/locales/de.json";
import roundEn from "../features/round/locales/en.json";
import sessionDe from "../features/session/locales/de.json";
import sessionEn from "../features/session/locales/en.json";
import supportDe from "../features/support/locales/de.json";
import supportEn from "../features/support/locales/en.json";
import commonDe from "./locales/de.json";
import commonEn from "./locales/en.json";

// Keys live with the feature (CLAUDE.md), merged here into one namespace so
// components call plain t("lobby.title") without namespace boilerplate. Each
// file owns distinct top-level keys, so a shallow merge is enough.
const de = { ...commonDe, ...sessionDe, ...roundDe, ...legalDe, ...supportDe };
const en = { ...commonEn, ...sessionEn, ...roundEn, ...legalEn, ...supportEn };

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
