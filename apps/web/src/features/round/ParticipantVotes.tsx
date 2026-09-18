import type { RoundStatusResult, SessionParticipant } from "@vbs/core";
import { ParticipantList } from "@vbs/ui";
import { useTranslation } from "react-i18next";

/**
 * Spectators stay in the list (matching the prototype's single "Dein Team"
 * list) with a distinct "watching" status — they're just never counted in
 * "x of y voted" (CLAUDE.md), which is computed separately from this list.
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

  const items = participants.map((participant) => {
    const isSpectator = participant.role === "spectator";
    const vote = byId.get(participant.id);
    const online = onlineParticipantIds.has(participant.id);
    const voted = vote?.voted ?? false;
    const status = isSpectator
      ? t("round.spectating")
      : revealed
        ? (vote?.value ?? t("round.didNotVote"))
        : voted
          ? t("round.hasVoted")
          : t("round.waiting");

    return {
      id: participant.id,
      name: participant.name,
      isYou: participant.is_you,
      status: online ? status : `${status} (${t("round.offline")})`,
      statusVariant: (isSpectator || revealed
        ? "neutral"
        : voted
          ? "voted"
          : "waiting") as "neutral" | "voted" | "waiting",
    };
  });

  return (
    <ParticipantList
      items={items}
      ariaLabel={t("round.voteStatus")}
      youSuffix={t("lobby.you")}
    />
  );
}
