import { BracketButton } from "@vbs/ui";
import { useTranslation } from "react-i18next";
import { ConfirmAction } from "../session/ConfirmAction";

/** Reveal / re-estimate / new-story — always visible for the admin, disabled
 * outside their valid round state, since the check that matters lives in
 * the database, not in hiding buttons. Revealing with votes still missing
 * is allowed (the database never required a full round) but asks first. */
export function AdminActions({
  canReveal,
  onReveal,
  isRevealing,
  votedCount,
  voterCount,
  canReEstimate,
  onReEstimate,
  isReEstimating,
  canNewStory,
  onNewStory,
  isClearingStory,
}: {
  canReveal: boolean;
  onReveal: () => void;
  isRevealing: boolean;
  votedCount: number;
  voterCount: number;
  canReEstimate: boolean;
  onReEstimate: () => void;
  isReEstimating: boolean;
  canNewStory: boolean;
  onNewStory: () => void;
  isClearingStory: boolean;
}) {
  const { t } = useTranslation();

  return (
    <p>
      {canReveal && votedCount < voterCount ? (
        <ConfirmAction
          label={t("round.reveal")}
          confirmQuestion={t("round.revealEarlyConfirm", {
            voted: votedCount,
            total: voterCount,
          })}
          confirmLabel={t("round.revealEarlyConfirmYes")}
          cancelLabel={t("round.revealEarlyConfirmNo")}
          onConfirm={onReveal}
          disabled={isRevealing}
        />
      ) : (
        <BracketButton disabled={!canReveal || isRevealing} onClick={onReveal}>
          {t("round.reveal")}
        </BracketButton>
      )}{" "}
      <BracketButton
        disabled={!canReEstimate || isReEstimating}
        onClick={onReEstimate}
      >
        {t("round.reEstimate")}
      </BracketButton>{" "}
      <BracketButton
        disabled={!canNewStory || isClearingStory}
        onClick={onNewStory}
      >
        {t("round.newStory")}
      </BracketButton>
    </p>
  );
}
