import { BracketButton } from "@vbs/ui";
import { useState } from "react";

/**
 * A two-step inline confirm rather than a native `confirm()` or a modal —
 * real, focusable `<button>`s throughout, so keyboard reachability and the
 * house look both fall out for free. Shared by the remove-participant
 * control and the leave-session action.
 */
export function ConfirmAction({
  label,
  confirmQuestion,
  confirmLabel,
  cancelLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmQuestion: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <BracketButton onClick={() => setConfirming(true)} disabled={disabled}>
        {label}
      </BracketButton>
    );
  }

  return (
    <span role="group" aria-label={confirmQuestion}>
      {confirmQuestion}{" "}
      <BracketButton
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
        disabled={disabled}
      >
        {confirmLabel}
      </BracketButton>{" "}
      <BracketButton onClick={() => setConfirming(false)}>
        {cancelLabel}
      </BracketButton>
    </span>
  );
}
