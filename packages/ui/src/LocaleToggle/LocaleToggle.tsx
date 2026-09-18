import { BracketButton } from "../BracketButton/BracketButton";
import styles from "../ThemeToggle/ThemeToggle.module.css";

export type LocaleToggleProps = {
  locale: "de" | "en";
  onChange: (locale: "de" | "en") => void;
  deLabel: string;
  enLabel: string;
};

/**
 * New in M4 — STYLE.md's prototype is German-only, so this has no direct
 * prototype block, but follows the same bracket-pair pattern as ThemeToggle
 * (and shares its CSS: the two are visually identical).
 */
export function LocaleToggle({
  locale,
  onChange,
  deLabel,
  enLabel,
}: LocaleToggleProps) {
  return (
    <span className={styles.row}>
      <BracketButton
        aria-pressed={locale === "de"}
        className={locale === "de" ? styles.optionActive : styles.option}
        onClick={() => onChange("de")}
      >
        {deLabel}
      </BracketButton>
      <span className={styles.divider} aria-hidden="true">
        |
      </span>
      <BracketButton
        aria-pressed={locale === "en"}
        className={locale === "en" ? styles.optionActive : styles.option}
        onClick={() => onChange("en")}
      >
        {enLabel}
      </BracketButton>
    </span>
  );
}
