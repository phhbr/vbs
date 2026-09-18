import { BracketButton } from "../BracketButton/BracketButton";
import styles from "./BracketToggle.module.css";

export type BracketToggleOption<T extends string> = {
  value: T;
  label: string;
};

export type BracketToggleProps<T extends string> = {
  /** e.g. "Darstellung" — its own labeled group (design revision finding 11). */
  label?: string;
  value: T;
  onChange: (value: T) => void;
  optionA: BracketToggleOption<T>;
  optionB: BracketToggleOption<T>;
  /** Stays visible but inert, matching every other bracket action. */
  disabled?: boolean;
};

/**
 * The recurring "Label [ A ] [ B ]" pattern — the theme switch, locale
 * switch, and role picker are the same shape with different words. No
 * divider between the options: the group's own gap is the only separator
 * (design revision finding 11 — one separator style, not a mix of pipes
 * and middots).
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
      {label && <span className={styles.label}>{label}</span>}
      <BracketButton
        aria-pressed={value === optionA.value}
        active={value === optionA.value}
        disabled={disabled}
        onClick={() => onChange(optionA.value)}
      >
        {optionA.label}
      </BracketButton>
      <BracketButton
        aria-pressed={value === optionB.value}
        active={value === optionB.value}
        disabled={disabled}
        onClick={() => onChange(optionB.value)}
      >
        {optionB.label}
      </BracketButton>
    </span>
  );
}
