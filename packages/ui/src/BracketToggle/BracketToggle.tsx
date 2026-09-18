import { BracketButton } from "../BracketButton/BracketButton";
import styles from "./BracketToggle.module.css";

export type BracketToggleOption<T extends string> = {
  value: T;
  label: string;
};

export type BracketToggleProps<T extends string> = {
  /** e.g. "Darstellung:" — omit for an unlabeled pair. */
  label?: string;
  value: T;
  onChange: (value: T) => void;
  optionA: BracketToggleOption<T>;
  optionB: BracketToggleOption<T>;
  /** Stays visible but inert, matching every other bracket action. */
  disabled?: boolean;
};

/**
 * The recurring "Label: [ A ] | [ B ]" pattern — STYLE.md's theme switch
 * (`Darstellung: [Dunkel] | [Hell]`) and role picker (`Rolle: [Admin] |
 * [Player]`) are the same shape with different words, so this is the one
 * implementation behind ThemeToggle, LocaleToggle, and any other two-way
 * bracket choice (e.g. a deck picker).
 */
export function BracketToggle<T extends string>({
  label,
  value,
  onChange,
  optionA,
  optionB,
  disabled,
}: BracketToggleProps<T>) {
  return (
    <span className={styles.row}>
      {label}
      <BracketButton
        aria-pressed={value === optionA.value}
        disabled={disabled}
        className={
          value === optionA.value ? styles.optionActive : styles.option
        }
        onClick={() => onChange(optionA.value)}
      >
        {optionA.label}
      </BracketButton>
      <span className={styles.divider} aria-hidden="true">
        |
      </span>
      <BracketButton
        aria-pressed={value === optionB.value}
        disabled={disabled}
        className={
          value === optionB.value ? styles.optionActive : styles.option
        }
        onClick={() => onChange(optionB.value)}
      >
        {optionB.label}
      </BracketButton>
    </span>
  );
}
