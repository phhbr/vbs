import { formatSessionCode } from "@vbs/core";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJoinSession } from "./queries";
import { useErrorMessage } from "./useErrorMessage";

/** Shown on /s/:code when the visitor has not joined this session yet. */
export function JoinSessionForm({ code }: { code: string }) {
  const { t } = useTranslation();
  const join = useJoinSession(code);
  const describeError = useErrorMessage();

  const nicknameId = useId();
  const [nickname, setNickname] = useState("");

  const trimmed = nickname.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= 24;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    join.mutate(trimmed);
  };

  return (
    <main>
      <h1>{t("join.title")}</h1>
      <p>{t("join.forSession", { code: formatSessionCode(code) })}</p>

      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor={nicknameId}>{t("join.nickname")}</label>
          <br />
          <input
            id={nicknameId}
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={24}
            required
            autoComplete="nickname"
          />
        </p>

        <p>
          <button type="submit" disabled={!valid || join.isPending}>
            {join.isPending ? t("join.submitting") : t("join.submit")}
          </button>
        </p>

        {join.isError && <p role="alert">{describeError(join.error)}</p>}
      </form>
    </main>
  );
}
