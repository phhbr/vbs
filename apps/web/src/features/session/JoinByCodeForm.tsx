import { isValidSessionCode, normalizeSessionCode } from "@vbs/core";
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
    <section>
      <h2>{t("join.title")}</h2>
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
          <button type="submit">{t("join.submit")}</button>
        </p>
      </form>
    </section>
  );
}
