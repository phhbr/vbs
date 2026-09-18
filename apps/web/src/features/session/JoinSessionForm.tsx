import { formatSessionCode } from "@vbs/core";
import { BracketButton, Panel } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useJoinSession } from "./queries";
import { useErrorMessage } from "./useErrorMessage";

/** Shown on /s/:code when the visitor has not joined this session yet. */
export function JoinSessionForm({ code }: { code: string }) {
  const { t } = useTranslation();
  const join = useJoinSession(code);
  const describeError = useErrorMessage();
  useDocumentTitle(`${t("app.title")} — ${t("join.title")}`);

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
      <Panel>
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
            <BracketButton type="submit" disabled={!valid || join.isPending}>
              {join.isPending ? t("join.submitting") : t("join.submit")}
            </BracketButton>
          </p>

          {join.isError && <p role="alert">{describeError(join.error)}</p>}
        </form>
      </Panel>
    </main>
  );
}
