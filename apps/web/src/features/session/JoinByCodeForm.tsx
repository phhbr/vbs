import { isValidSessionCode, normalizeSessionCode } from "@vbs/core";
import { BracketButton, Panel } from "@vbs/ui";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

/** Only routes to the session; the nickname is asked for there. */
export function JoinByCodeForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const codeId = useId();
  const hintId = useId();
  const errorId = useId();
  const [code, setCode] = useState("");
  const [showError, setShowError] = useState(false);

  const valid = isValidSessionCode(code);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) {
      setShowError(true);
      return;
    }
    void navigate(`/s/${normalizeSessionCode(code)}`);
  };

  return (
    <Panel heading={t("join.title")} headingLevel="h2">
      <form onSubmit={onSubmit}>
        <p>
          <label htmlFor={codeId}>{t("join.code")}</label>
          <br />
          <input
            id={codeId}
            name="code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setShowError(false);
            }}
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={showError ? errorId : hintId}
            aria-invalid={showError || undefined}
          />
          <br />
          <small id={hintId}>{t("join.codeHint")}</small>
        </p>

        {showError && (
          <p id={errorId} role="alert">
            {t("join.codeInvalid")}
          </p>
        )}

        <p>
          <BracketButton type="submit">{t("join.submit")}</BracketButton>
        </p>
      </form>
    </Panel>
  );
}
