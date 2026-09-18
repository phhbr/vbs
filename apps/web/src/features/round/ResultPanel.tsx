import type { RoundResult } from "@vbs/core";
import { useTranslation } from "react-i18next";

export function ResultPanel({ result }: { result: RoundResult }) {
  const { t } = useTranslation();

  return (
    <div>
      <p>
        {result.type === "average" ? t("round.average") : t("round.majority")}
        : <strong>{result.value ?? "–"}</strong>
      </p>
      {result.consensus ? (
        <p>
          <strong>{t("round.consensus")}</strong>
        </p>
      ) : (
        result.spread && (
          <p>
            {t("round.spread", {
              min: result.spread.min,
              max: result.spread.max,
            })}
          </p>
        )
      )}
    </div>
  );
}
