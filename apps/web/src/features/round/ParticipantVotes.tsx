import type { RoundStatusResult, SessionParticipant } from "@vbs/core";
import { ParticipantList } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { ConfirmAction } from "../session/ConfirmAction";

/**
 * Spectators stay in the list (matching the prototype's single "Dein Team"
 * list) with a distinct "watching" status — they're just never counted in
 * "x of y voted" (CLAUDE.md), which is computed separately from this list.
 */
export function ParticipantVotes({
  participants,
  roundStatus,
  onlineParticipantIds,
  isAdmin,
  onRemove,
  removingId,
  onPromote,
  isPromoting,
}: {
  participants: SessionParticipant[];
  roundStatus: RoundStatusResult | undefined;
  onlineParticipantIds: ReadonlySet<string> | null;
  /** The signed-in viewer's own role — only admins get the remove and
   * hand-over controls. */
  isAdmin: boolean;
  onRemove: (participantId: string) => void;
  /** The id currently being removed, to disable its own control mid-mutation. */
  removingId?: string;
  onPromote: (participantId: string) => void;
  /** A hand-over is in flight; every row's control waits for it. */
  isPromoting: boolean;
}) {
  const { t } = useTranslation();
  const byId = new Map(
    (roundStatus?.participants ?? []).map((p) => [p.participant_id, p]),
  );
  const revealed = roundStatus?.round.status === "revealed";

  const items = participants.map((participant) => {
    const isSpectator = participant.role === "spectator";
    const vote = byId.get(participant.id);
    // null: presence is unavailable (no realtime socket), so nobody is
    // known to be offline either — say nothing rather than mark everyone.
    const offline =
      onlineParticipantIds !== null &&
      !onlineParticipantIds.has(participant.id);
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
      status: offline ? `${status} (${t("round.offline")})` : status,
      statusVariant: (isSpectator || revealed
        ? "neutral"
        : voted
          ? "voted"
          : "waiting") as "neutral" | "voted" | "waiting",
      action:
        isAdmin && participant.role !== "admin" ? (
          <>
            <ConfirmAction
              label={t("session.promote")}
              confirmQuestion={t("session.promoteConfirm", {
                name: participant.name,
              })}
              confirmLabel={t("session.promoteConfirmYes")}
              cancelLabel={t("session.promoteConfirmNo")}
              onConfirm={() => onPromote(participant.id)}
              disabled={isPromoting}
            />
            <ConfirmAction
              label={t("session.remove")}
              confirmQuestion={t("session.removeConfirm", {
                name: participant.name,
              })}
              confirmLabel={t("session.removeConfirmYes")}
              cancelLabel={t("session.removeConfirmNo")}
              onConfirm={() => onRemove(participant.id)}
              disabled={removingId === participant.id}
            />
          </>
        ) : undefined,
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
