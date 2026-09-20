import { Panel } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { useErrorMessage } from "../session/useErrorMessage";
import { useRoundHistory } from "./queries";

/**
 * One completed round, formatted as STYLE.md's "story — label value (n
 * Stimmen)". Exported so the Main tab's "recent rounds" preview can reuse
 * the exact same formatting as the full history list.
 */
export function HistoryLine({
  story,
  type,
  value,
  voteCount,
  consensus,
}: {
  story: string;
  type: "average" | "majority";
  value: string | null;
  voteCount: number;
  consensus: boolean;
}) {
  const { t } = useTranslation();
  const label = type === "average" ? t("round.average") : t("round.majority");
  const line = t("round.historyLine", {
    story,
    label,
    value: value ?? "–",
    count: voteCount,
  });

  return (
    <li>
      {line}
      {consensus && t("round.historyConsensusSuffix")}
    </li>
  );
}

/** The full round history — the "Verlauf" tab. Only revealed rounds have a
 * result to show; a round still voting appears on the Main tab instead. */
export function RoundHistory({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const history = useRoundHistory(sessionId);
  const revealed = (history.data ?? []).filter((round) => round.result);

  return (
    <Panel heading={t("round.historyHeading")}>
      {history.isError ? (
        // A failed read is not an empty history. Reporting it as one is how
        // a missing select grant on `rounds` in production read to everyone
        // as "no rounds played yet" for three revealed rounds.
        <p role="alert">{describeError(history.error)}</p>
      ) : revealed.length === 0 ? (
        <p>{t("round.historyEmptyFull")}</p>
      ) : (
        <ul>
          {revealed.map((round) => (
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
