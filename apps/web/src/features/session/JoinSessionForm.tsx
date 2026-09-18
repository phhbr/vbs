import { formatSessionCode } from "@vbs/core";
import { BracketButton, Field, Input, Panel } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useJoinSession } from "./queries";
import { useErrorMessage } from "./useErrorMessage";
import styles from "./JoinSessionForm.module.css";

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
    <main className="page-main">
      <h1 className="page-heading">{t("join.title")}</h1>
      <Panel>
        <p>{t("join.forSession", { code: formatSessionCode(code) })}</p>

        <form onSubmit={onSubmit} className={styles.form}>
          <Field>
            <label htmlFor={nicknameId}>{t("join.nickname")}</label>
            <Input
              id={nicknameId}
              name="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              required
              autoComplete="nickname"
            />
          </Field>

          <BracketButton
            type="submit"
            variant="primary"
            disabled={!valid || join.isPending}
          >
            {join.isPending ? t("join.submitting") : t("join.submit")}
          </BracketButton>

          {join.isError && <p role="alert">{describeError(join.error)}</p>}
        </form>
      </Panel>
    </main>
  );
}
