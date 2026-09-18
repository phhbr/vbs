import { BracketButton } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { HistoryLine } from "./RoundHistory";
import { useRoundHistory } from "./queries";

/** The Main tab's "Rundenverlauf [ Alle ]" preview: the 3 most recent
 * completed rounds, with a link to the full history tab. */
export function RecentRounds({
  sessionId,
  onShowAll,
}: {
  sessionId: string;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const history = useRoundHistory(sessionId);
  const recent = (history.data ?? [])
    .filter((round) => round.result)
    .slice(0, 3);

  return (
    <div>
      <p>
        {t("round.historyHeading")}{" "}
        <BracketButton onClick={onShowAll}>
          {t("round.historyAll")}
        </BracketButton>
      </p>
      {recent.length === 0 ? (
        <p>{t("round.historyEmpty")}</p>
      ) : (
        <ul>
          {recent.map((round) => (
            <HistoryLine
              key={round.id}
              story={round.story}
              type={round.result!.type}
              value={round.result!.value}
              voteCount={round.result!.vote_count}
              consensus={round.result!.consensus}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
