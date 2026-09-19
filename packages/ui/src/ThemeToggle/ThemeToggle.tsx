import { useId, useRef, type KeyboardEvent } from "react";
import { BracketButton } from "../BracketButton/BracketButton";
import type { Theme } from "../theme/useTheme";
import styles from "./ThemeToggle.module.css";

export type ThemeToggleProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  darkLabel: string;
  lightLabel: string;
  amtLabel: string;
};

const OPTIONS = ["dark", "light", "amt"] as const;

// Behörde is a proper name in both locales (design revision, third theme
// finding 7) — its explanation is hardcoded English here rather than routed
// through i18n, where it could end up translated by mistake.
const AMT_TITLE =
  "Behörde: styled after a 1980s German administrative terminal";

/**
 * A real radiogroup (design revision, third theme finding 4), not a
 * two-state toggle — same keyboard pattern as CardDeck: roving tabindex,
 * arrow keys move focus and select, Home/End jump to the ends.
 */
export function ThemeToggle({
  theme,
  onChange,
  label,
  darkLabel,
  lightLabel,
  amtLabel,
}: ThemeToggleProps) {
  const labelId = useId();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const labels: Record<Theme, string> = {
    dark: darkLabel,
    light: lightLabel,
    amt: amtLabel,
  };

  const selectedIndex = OPTIONS.indexOf(theme);
  const focusableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const focusAndSelect = (index: number) => {
    const wrapped = (index + OPTIONS.length) % OPTIONS.length;
    const option = OPTIONS[wrapped];
    if (option === undefined) return;
    buttonRefs.current[wrapped]?.focus();
    onChange(option);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(OPTIONS.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <span className={styles.row}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <span
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.options}
      >
        {OPTIONS.map((option, index) => {
          const selected = option === theme;
          return (
            <BracketButton
              key={option}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              role="radio"
              aria-checked={selected}
              active={selected}
              tabIndex={index === focusableIndex ? 0 : -1}
              title={option === "amt" ? AMT_TITLE : undefined}
              onClick={() => onChange(option)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {labels[option]}
            </BracketButton>
          );
        })}
      </span>
    </span>
  );
}
