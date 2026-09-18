import type { SessionState } from "@vbs/core";
import { cardsForDeck } from "@vbs/core";
import { CardDeck, Panel, StatusBar } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { ShareLink } from "../session/ShareLink";
import { SessionQr } from "../session/SessionQr";
import { useErrorMessage } from "../session/useErrorMessage";
import { AdminActions } from "./AdminActions";
import { AdminSetup } from "./AdminSetup";
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
import { RecentRounds } from "./RecentRounds";
import { ResultPanel } from "./ResultPanel";
import styles from "./RoundScreen.module.css";

/**
 * The "Main" tab: story setup, the card row, participant status and the
 * result — everything from STYLE.md's two-column layout. Rendered once the
 * caller is a member (Session.tsx guarantees viewer and participants are
 * non-null at that point).
 */
export function RoundScreen({
  code,
  state,
  onlineParticipantIds,
  shareUrl,
  onShowHistory,
}: {
  code: string;
  state: SessionState;
  onlineParticipantIds: ReadonlySet<string>;
  shareUrl: string;
  onShowHistory: () => void;
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

  const phaseLabel = isVoting
    ? t("round.phaseVoting")
    : isRevealed
      ? t("round.phaseRevealed")
      : t("round.phaseIdle");

  return (
    <div id="tabpanel-main" role="tabpanel" aria-labelledby="tab-main">
      <StatusBar
        ariaLabel={t("round.statusBarLabel")}
        items={[
          {
            label: t("round.statusStory"),
            value: currentRound ? currentRound.story : "–",
          },
          { label: t("round.statusStatus"), value: phaseLabel },
          {
            label: t("round.statusVoted"),
            value: currentRound
              ? `${votedCount}/${eligibleVoters.length}`
              : "–",
          },
        ]}
      />

      {mutationError !== null && (
        <p role="alert">{describeError(mutationError)}</p>
      )}

      {isAdmin && (
        <AdminSetup
          deck={state.session.deck}
          canEditDeck={!isVoting}
          onSetDeck={(deck) => setDeck.mutate(deck)}
          canStart={!isVoting}
          onStart={(title) => startStory.mutate(title)}
          isStarting={startStory.isPending}
        />
      )}

      <div className={styles.grid}>
        <div className={styles.column}>
          <h2 className={styles.sectionHeading}>
            <span aria-hidden="true">&raquo; </span>
            {t("round.title")}
          </h2>

          {!currentRound && (
            <p>{isAdmin ? t("round.emptyAdmin") : t("round.emptyPlayer")}</p>
          )}

          {currentRound && isVoting && (
            <p>
              {t("round.progress", {
                voted: votedCount,
                total: eligibleVoters.length,
              })}
            </p>
          )}

          {canVote && isVoting && (
            <CardDeck
              cards={cardsForDeck(state.session.deck)}
              value={myVote?.value ?? null}
              disabled={castVote.isPending}
              onChange={(value) => castVote.mutate(value)}
              ariaLabel={t("round.cards")}
            />
          )}

          <ParticipantVotes
            participants={participants}
            roundStatus={roundStatus.data}
            onlineParticipantIds={onlineParticipantIds}
          />

          {isAdmin && (
            <AdminActions
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
        </div>

        <div className={styles.column}>
          <Panel heading={t("round.resultHeading")}>
            {!currentRound && <p>{t("round.noRoundYet")}</p>}
            {currentRound && isVoting && (
              <>
                <p>
                  {t("round.progress", {
                    voted: votedCount,
                    total: eligibleVoters.length,
                  })}
                </p>
                <p>{t("round.awaitingReveal")}</p>
              </>
            )}
            {currentRound && isRevealed && roundStatus.data?.result && (
              <div aria-live="polite">
                <ResultPanel result={roundStatus.data.result} />
              </div>
            )}
          </Panel>

          <RecentRounds
            sessionId={state.session.id}
            onShowAll={onShowHistory}
          />

          <Panel heading={t("lobby.link")}>
            <ShareLink url={shareUrl} />
            <SessionQr url={shareUrl} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
