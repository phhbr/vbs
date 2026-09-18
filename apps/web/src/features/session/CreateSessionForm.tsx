import type { Deck } from "@vbs/core";
import { BracketButton, BracketToggle, Panel } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { adminRecoveryUrl } from "./adminToken";
import { useCreateSession } from "./queries";
import { useErrorMessage } from "./useErrorMessage";

export function CreateSessionForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateSession();
  const describeError = useErrorMessage();

  const nicknameId = useId();
  const nicknameHintId = useId();
  const [nickname, setNickname] = useState("");
  const [deck, setDeck] = useState<Deck>("fibonacci");

  const trimmed = nickname.trim();
  const nicknameValid = trimmed.length >= 1 && trimmed.length <= 24;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!nicknameValid) return;
    create.mutate(
      { nickname: trimmed, deck, locale: i18n.resolvedLanguage ?? "de" },
      {
        onSuccess: (result) => {
          // The token travels in the fragment, which browsers never send to a
          // server. `justCreated` tells the session screen to show it once
          // rather than treat it as a recovery attempt.
          void navigate(adminRecoveryUrl("", result.code, result.admin_token), {
            replace: true,
            state: { justCreated: true },
          });
        },
      },
    );
  };

  return (
    <Panel heading={t("create.title")} headingLevel="h2">
      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor={nicknameId}>{t("create.nickname")}</label>
          <br />
          <input
            id={nicknameId}
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={24}
            required
            aria-describedby={nicknameHintId}
            autoComplete="nickname"
          />
          <br />
          <small id={nicknameHintId}>{t("create.nicknameHint")}</small>
        </p>

        <p>
          <BracketToggle
            label={t("create.deck")}
            value={deck}
            onChange={setDeck}
            optionA={{ value: "fibonacci", label: t("create.deckFibonacci") }}
            optionB={{ value: "tshirt", label: t("create.deckTshirt") }}
          />
        </p>

        <p>
          <BracketButton
            type="submit"
            disabled={!nicknameValid || create.isPending}
          >
            {create.isPending ? t("create.submitting") : t("create.submit")}
          </BracketButton>
        </p>

        {create.isError && <p role="alert">{describeError(create.error)}</p>}
      </form>
    </Panel>
  );
}
