import { Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Section = { heading: string; paragraphs: string[] };

export function Datenschutz() {
  const { t } = useTranslation();
  useDocumentTitle(`${t("app.title")} — ${t("legal.datenschutz.heading")}`);
  const sections = t("legal.datenschutz.sections", {
    returnObjects: true,
  }) as Section[];

  return (
    <main className="page-main">
      <h1 className="page-heading">{t("legal.datenschutz.heading")}</h1>
      <Link to="/">{t("legal.back")}</Link>
      <Panel>
        <p className="prose">{t("legal.datenschutz.intro")}</p>
      </Panel>
      {sections.map((section, index) => (
        <Panel key={index} heading={section.heading}>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p className="prose" key={paragraphIndex}>
              {paragraph}
            </p>
          ))}
        </Panel>
      ))}
    </main>
  );
}
