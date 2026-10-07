import type { RoundResult, RoundStatusParticipant } from "@vbs/core";
import { groupVotesByValue } from "@vbs/core";
import { ResultPanel as KitResultPanel, VoteDistribution } from "@vbs/ui";
import { useTranslation } from "react-i18next";

/**
 * Maps the domain RoundResult onto @vbs/ui's presentational ResultPanel,
 * led by the votes grouped by card. Voters' names come from round_status
 * itself, so someone removed after voting is still named; who did *not*
 * vote is the caller's call, since only it knows the current eligible
 * voters.
 */
export function ResultPanel({
  result,
  cards,
  votes,
  notVoted,
}: {
  result: RoundResult;
  cards: readonly string[];
  votes: readonly RoundStatusParticipant[];
  /** Names of eligible voters who did not vote — empty when everyone did. */
  notVoted: readonly string[];
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "de";
  const listFormat = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  });
  const collator = new Intl.Collator(locale);

  const groups = groupVotesByValue(
    cards,
    votes.flatMap((p) =>
      p.voted && p.value !== null ? [{ name: p.name, value: p.value }] : [],
    ),
    collator.compare,
  );

  const rows = groups.map(({ value, voters }) => {
    const countLabel = t("round.voteCount", { count: voters.length });
    const names = listFormat.format(voters);
    return {
      value,
      count: voters.length,
      countLabel,
      voters: names,
      accessibleText: t("round.distributionRow", {
        value,
        count: countLabel,
        names,
      }),
    };
  });

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
      distribution={
        rows.length > 0 ? (
          <VoteDistribution
            rows={rows}
            ariaLabel={t("round.distributionLabel")}
          />
        ) : undefined
      }
      notVotedText={
        notVoted.length > 0
          ? t("round.notVoted", {
              names: listFormat.format([...notVoted].sort(collator.compare)),
            })
          : undefined
      }
    />
  );
}
