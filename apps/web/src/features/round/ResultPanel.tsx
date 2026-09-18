import type { RoundResult } from "@vbs/core";
import { ResultPanel as KitResultPanel } from "@vbs/ui";
import { useTranslation } from "react-i18next";

/** Maps the domain RoundResult onto @vbs/ui's presentational ResultPanel. */
export function ResultPanel({ result }: { result: RoundResult }) {
  const { t } = useTranslation();

  return (
    <KitResultPanel
      label={
        result.type === "average" ? t("round.average") : t("round.majority")
      }
      value={result.value ?? "–"}
      consensusLabel={result.consensus ? t("round.consensus") : undefined}
      spreadText={
        result.spread
          ? t("round.spread", {
              min: result.spread.min,
              max: result.spread.max,
            })
          : undefined
      }
    />
  );
}
