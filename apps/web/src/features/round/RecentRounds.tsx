import { BracketButton, Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { useErrorMessage } from "../session/useErrorMessage";
import { HistoryLine } from "./RoundHistory";
import { useRoundHistory } from "./queries";

/** The Main tab's "Rundenverlauf [ Alle ]" panel: the 3 most recent
 * completed rounds, with a link to the full history tab. */
export function RecentRounds({
  sessionId,
  onShowAll,
}: {
  sessionId: string;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const history = useRoundHistory(sessionId);
  const recent = (history.data ?? [])
    .filter((round) => round.result)
    .slice(0, 3);

  return (
    <Panel
      heading={t("round.historyHeading")}
      headingAction={
        <BracketButton onClick={onShowAll}>
          {t("round.historyAll")}
        </BracketButton>
      }
    >
      {history.isError ? (
        // Same reason as RoundHistory's: an unreadable table must not
        // render as an empty one.
        <p role="alert">{describeError(history.error)}</p>
      ) : recent.length === 0 ? (
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
    </Panel>
  );
}
