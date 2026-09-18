import type { Deck } from "@vbs/core";
import {
  BracketButton,
  BracketToggle,
  Field,
  Input,
  InputRow,
  Panel,
} from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./AdminSetup.module.css";

/**
 * The "Neue Story" panel: deck picker in the title bar, story-start form
 * below (design revision finding 9 — every section is a panel with the
 * same title bar, not a floating deck picker above an unrelated box).
 * Rendered for admins only, but every action re-checks the role in the
 * database (CLAUDE.md rule 3) — hiding this is a convenience, not the
 * enforcement.
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
    <Panel
      heading={t("round.newStoryHeading")}
      headingAction={
        <BracketToggle
          label={t("round.chooseDeck")}
          value={deck}
          onChange={onSetDeck}
          disabled={!canEditDeck}
          optionA={{ value: "fibonacci", label: t("create.deckFibonacci") }}
          optionB={{ value: "tshirt", label: t("create.deckTshirt") }}
        />
      }
    >
      <form onSubmit={submitStart} className={styles.form}>
        <Field>
          <label htmlFor={titleId}>{t("round.storyLabel")}</label>
          <InputRow>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!canStart}
              maxLength={200}
            />
            <BracketButton
              type="submit"
              variant="primary"
              disabled={!canStart || !titleValid || isStarting}
            >
              {t("round.start")}
            </BracketButton>
          </InputRow>
        </Field>
      </form>
    </Panel>
  );
}
