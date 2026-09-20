import { Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function Impressum() {
  const { t } = useTranslation();
  useDocumentTitle(`${t("app.title")} — ${t("legal.impressum.heading")}`);

  return (
    <main className="page-main">
      <h1 className="page-heading">{t("legal.impressum.heading")}</h1>
      <Panel heading={t("legal.impressum.providerHeading")}>
        <address className="prose">
          {t("legal.impressum.name")}
          <br />
          {t("legal.impressum.street")}
          <br />
          {t("legal.impressum.city")}
        </address>
      </Panel>
      <Panel heading={t("legal.impressum.contactHeading")}>
        <address className="prose">
          {t("legal.impressum.phoneLabel")}:{" "}
          <a href={`tel:${t("legal.impressum.phoneHref")}`}>
            {t("legal.impressum.phone")}
          </a>
          <br />
          {t("legal.impressum.emailLabel")}:{" "}
          <a href={`mailto:${t("legal.impressum.email")}`}>
            {t("legal.impressum.email")}
          </a>
        </address>
      </Panel>
      <Panel heading={t("legal.impressum.responsibleHeading")}>
        <address className="prose">
          {t("legal.impressum.name")}
          <br />
          {t("legal.impressum.street")}
          <br />
          {t("legal.impressum.city")}
        </address>
      </Panel>
    </main>
  );
}
