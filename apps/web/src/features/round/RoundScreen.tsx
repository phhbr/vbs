import type { SessionState } from "@vbs/core";
import { cardsForDeck } from "@vbs/core";
import { useTranslation } from "react-i18next";
import { useErrorMessage } from "../session/useErrorMessage";
import { AdminControls } from "./AdminControls";
import { CardRow } from "./CardRow";
import { ParticipantVotes } from "./ParticipantVotes";
import {
  useNewStory,
  useReEstimate,
  useReveal,
  useRoundStatus,
  useSetDeck,
  useStartStory,
  useVote,
} from "./queries";
import { ResultPanel } from "./ResultPanel";

/**
 * The live-voting area: story, card row, participant status and result.
 * Rendered once the caller is a member (Session.tsx guarantees viewer and
 * participants are non-null at that point).
 */
export function RoundScreen({
  code,
  state,
  onlineParticipantIds,
}: {
  code: string;
  state: SessionState;
  onlineParticipantIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const describeError = useErrorMessage();
  const viewer = state.viewer!;
  const participants = state.participants ?? [];
  const currentRound = state.current_round;
  const isAdmin = viewer.role === "admin";
  const canVote = viewer.role !== "spectator" && viewer.can_vote;
  const isVoting = currentRound?.status === "voting";
  const isRevealed = currentRound?.status === "revealed";

  const roundStatus = useRoundStatus(currentRound?.id);
  const startStory = useStartStory(code);
  const newStory = useNewStory(code);
  const setDeck = useSetDeck(code);
  const castVote = useVote(currentRound?.id);
  const reveal = useReveal(currentRound?.id);
  const reEstimate = useReEstimate(currentRound?.id, code);

  const myVote = roundStatus.data?.participants.find(
    (p) => p.participant_id === viewer.participant_id,
  );
  const eligibleVoters = participants.filter(
    (p) => p.role !== "spectator" && p.can_vote,
  );
  const votedCount = eligibleVoters.filter(
    (p) =>
      roundStatus.data?.participants.find((rp) => rp.participant_id === p.id)
        ?.voted,
  ).length;

  const mutationError =
    startStory.error ??
    newStory.error ??
    setDeck.error ??
    castVote.error ??
    reveal.error ??
    reEstimate.error;

  return (
    <section>
      <h2>{t("round.title")}</h2>

      {mutationError !== null && (
        <p role="alert">{describeError(mutationError)}</p>
      )}

      {isAdmin && (
        <AdminControls
          deck={state.session.deck}
          canEditDeck={!isVoting}
          onSetDeck={(deck) => setDeck.mutate(deck)}
          canStart={!isVoting}
          onStart={(title) => startStory.mutate(title)}
          isStarting={startStory.isPending}
          canReveal={isVoting ?? false}
          onReveal={() => reveal.mutate()}
          isRevealing={reveal.isPending}
          canReEstimate={isRevealed ?? false}
          onReEstimate={() => reEstimate.mutate()}
          isReEstimating={reEstimate.isPending}
          canNewStory={isRevealed ?? false}
          onNewStory={() => newStory.mutate()}
          isClearingStory={newStory.isPending}
        />
      )}

      {!currentRound && (
        <p>{isAdmin ? t("round.emptyAdmin") : t("round.emptyPlayer")}</p>
      )}

      {currentRound && (
        <>
          <p>{t("round.story", { title: currentRound.story })}</p>

          {isVoting && (
            <p>
              {t("round.progress", {
                voted: votedCount,
                total: eligibleVoters.length,
              })}
            </p>
          )}

          {canVote && isVoting && (
            <CardRow
              cards={cardsForDeck(state.session.deck)}
              value={myVote?.value ?? null}
              disabled={castVote.isPending}
              onChange={(value) => castVote.mutate(value)}
            />
          )}

          <ParticipantVotes
            participants={participants}
            roundStatus={roundStatus.data}
            onlineParticipantIds={onlineParticipantIds}
          />

          <div aria-live="polite">
            {isRevealed && roundStatus.data?.result && (
              <ResultPanel result={roundStatus.data.result} />
            )}
          </div>
        </>
      )}
    </section>
  );
}
