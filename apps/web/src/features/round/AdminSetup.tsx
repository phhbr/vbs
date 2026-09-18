import type { Deck } from "@vbs/core";
import { BracketButton, BracketToggle, Panel } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * The admin-only setup row above the two-column layout: deck picker and the
 * story-start form. Rendered for admins only, but every action re-checks
 * the role in the database (CLAUDE.md rule 3) — hiding this is a
 * convenience, not the enforcement.
 */
export function AdminSetup({
  deck,
  canEditDeck,
  onSetDeck,
  canStart,
  onStart,
  isStarting,
}: {
  deck: Deck;
  canEditDeck: boolean;
  onSetDeck: (deck: Deck) => void;
  canStart: boolean;
  onStart: (title: string) => void;
  isStarting: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
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
    <>
      <p>
        <BracketToggle
          label={t("round.chooseDeck")}
          value={deck}
          onChange={onSetDeck}
          disabled={!canEditDeck}
          optionA={{
            value: "fibonacci",
            label: t("create.deckFibonacci"),
          }}
          optionB={{ value: "tshirt", label: t("create.deckTshirt") }}
        />
      </p>

      <Panel>
        <form onSubmit={submitStart}>
          <label htmlFor={titleId}>{t("round.storyLabel")}</label>{" "}
          <input
            id={titleId}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!canStart}
            maxLength={200}
          />{" "}
          <BracketButton
            type="submit"
            disabled={!canStart || !titleValid || isStarting}
          >
            {t("round.start")}
          </BracketButton>
        </form>
      </Panel>
    </>
  );
}
