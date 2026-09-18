import { BracketButton } from "../BracketButton/BracketButton";
import styles from "./ThemeToggle.module.css";

export type ThemeToggleProps = {
  theme: "light" | "dark";
  onChange: (theme: "light" | "dark") => void;
  label: string;
  darkLabel: string;
  lightLabel: string;
};

/** STYLE.md's "Darstellung: [Dunkel] | [Hell]" line. */
export function ThemeToggle({
  theme,
  onChange,
  label,
  darkLabel,
  lightLabel,
}: ThemeToggleProps) {
  return (
    <span className={styles.row}>
      {label}
      <BracketButton
        aria-pressed={theme === "dark"}
        className={theme === "dark" ? styles.optionActive : styles.option}
        onClick={() => onChange("dark")}
      >
        {darkLabel}
      </BracketButton>
      <span className={styles.divider} aria-hidden="true">
        |
      </span>
      <BracketButton
        aria-pressed={theme === "light"}
        className={theme === "light" ? styles.optionActive : styles.option}
        onClick={() => onChange("light")}
      >
        {lightLabel}
      </BracketButton>
    </span>
  );
}
