import type { RoundStatusResult, SessionParticipant } from "@vbs/core";
import { useTranslation } from "react-i18next";

/**
 * Spectators are excluded: they never vote, so "waiting …" would misreport
 * their status (CLAUDE.md: spectators are not counted in "x of y voted").
 */
export function ParticipantVotes({
  participants,
  roundStatus,
  onlineParticipantIds,
}: {
  participants: SessionParticipant[];
  roundStatus: RoundStatusResult | undefined;
  onlineParticipantIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const byId = new Map(
    (roundStatus?.participants ?? []).map((p) => [p.participant_id, p]),
  );
  const revealed = roundStatus?.round.status === "revealed";
  const voters = participants.filter((p) => p.role !== "spectator");

  return (
    <ul aria-live="polite">
      {voters.map((participant) => {
        const vote = byId.get(participant.id);
        const online = onlineParticipantIds.has(participant.id);
        const status = revealed
          ? (vote?.value ?? t("round.didNotVote"))
          : vote?.voted
            ? t("round.hasVoted")
            : t("round.waiting");

        return (
          <li key={participant.id}>
            {participant.name}
            {participant.is_you ? ` (${t("lobby.you")})` : ""} — {status}
            {!online && ` (${t("round.offline")})`}
          </li>
        );
      })}
    </ul>
  );
}
