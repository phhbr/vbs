import type { Deck } from "@vbs/core";
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
  const deckLabelId = useId();
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
    <section>
      <h2>{t("create.title")}</h2>
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

        <fieldset>
          <legend id={deckLabelId}>{t("create.deck")}</legend>
          {(["fibonacci", "tshirt"] as const).map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="deck"
                value={option}
                checked={deck === option}
                onChange={() => setDeck(option)}
              />
              {option === "fibonacci"
                ? t("create.deckFibonacci")
                : t("create.deckTshirt")}
            </label>
          ))}
        </fieldset>

        <p>
          <button type="submit" disabled={!nicknameValid || create.isPending}>
            {create.isPending ? t("create.submitting") : t("create.submit")}
          </button>
        </p>

        {create.isError && <p role="alert">{describeError(create.error)}</p>}
      </form>
    </section>
  );
}
