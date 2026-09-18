import type { Deck } from "@vbs/core";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Rendered for admins only, but every action re-checks the role in the
 * database (CLAUDE.md rule 3) — hiding this component is a convenience, not
 * the enforcement.
 */
export function AdminControls({
  deck,
  canEditDeck,
  onSetDeck,
  canStart,
  onStart,
  isStarting,
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
  deck: Deck;
  canEditDeck: boolean;
  onSetDeck: (deck: Deck) => void;
  canStart: boolean;
  onStart: (title: string) => void;
  isStarting: boolean;
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
  const titleId = useId();
  const deckLabelId = useId();
  const [title, setTitle] = useState("");

  const trimmed = title.trim();
  const titleValid = trimmed.length >= 1 && trimmed.length <= 200;

  const submitStart = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canStart || !titleValid) return;
    onStart(trimmed);
    setTitle("");
  };

  return (
    <div>
      <form onSubmit={submitStart}>
        <label htmlFor={titleId}>{t("round.storyLabel")}</label>
        <br />
        <input
          id={titleId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={!canStart}
          maxLength={200}
        />{" "}
        <button
          type="submit"
          disabled={!canStart || !titleValid || isStarting}
        >
          {t("round.start")}
        </button>
      </form>

      <fieldset disabled={!canEditDeck}>
        <legend id={deckLabelId}>{t("create.deck")}</legend>
        {(["fibonacci", "tshirt"] as const).map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="round-deck"
              value={option}
              checked={deck === option}
              onChange={() => onSetDeck(option)}
            />
            {option === "fibonacci"
              ? t("create.deckFibonacci")
              : t("create.deckTshirt")}
          </label>
        ))}
      </fieldset>

      <p>
        <button type="button" disabled={!canReveal || isRevealing} onClick={onReveal}>
          {t("round.reveal")}
        </button>{" "}
        <button
          type="button"
          disabled={!canReEstimate || isReEstimating}
          onClick={onReEstimate}
        >
          {t("round.reEstimate")}
        </button>{" "}
        <button
          type="button"
          disabled={!canNewStory || isClearingStory}
          onClick={onNewStory}
        >
          {t("round.newStory")}
        </button>
      </p>
    </div>
  );
}
