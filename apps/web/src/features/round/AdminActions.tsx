import { BracketButton } from "@vbs/ui";
import { useTranslation } from "react-i18next";

/** Reveal / re-estimate / new-story — always visible for the admin, disabled
 * outside their valid round state, since the check that matters lives in
 * the database, not in hiding buttons. */
export function AdminActions({
  canReveal,
  onReveal,
  isRevealing,
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
      <BracketButton disabled={!canReveal || isRevealing} onClick={onReveal}>
        {t("round.reveal")}
      </BracketButton>{" "}
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
