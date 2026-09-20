import { useId, type ChangeEvent } from "react";
import type { Theme } from "../theme/useTheme";
import styles from "./ThemeSelect.module.css";

export type ThemeSelectProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  groupModernLabel: string;
  groupRetroLabel: string;
  modernLightLabel: string;
  modernDarkLabel: string;
  lightLabel: string;
  darkLabel: string;
  amtLabel: string;
  vb6Label: string;
};

// Behörde and Fachanwendung are proper names in both locales (design
// revision, third theme finding 7) — their explanations are hardcoded
// English here rather than routed through i18n, where they could end up
// translated by mistake.
const AMT_TITLE =
  "Behörde: styled after a 1980s German administrative terminal";
const VB6_TITLE =
  "Fachanwendung: styled after a 1990s Windows line-of-business application";

/**
 * A single native <select>, replacing the six-way radiogroup the design
 * revision shipped with — that toolbar would wrap twice at 360px. Native
 * on purpose: the system picker on mobile, correct keyboard handling, and
 * correct rendering under forced-colors mode all come for free. Styled
 * from tokens only, same as every other control.
 */
export function ThemeSelect({
  theme,
  onChange,
  label,
  groupModernLabel,
  groupRetroLabel,
  modernLightLabel,
  modernDarkLabel,
  lightLabel,
  darkLabel,
  amtLabel,
  vb6Label,
}: ThemeSelectProps) {
  const selectId = useId();

  const onSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as Theme);
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={styles.select}
        value={theme}
        onChange={onSelectChange}
      >
        <optgroup label={groupModernLabel}>
          <option value="modernLight">{modernLightLabel}</option>
          <option value="modernDark">{modernDarkLabel}</option>
        </optgroup>
        <optgroup label={groupRetroLabel}>
          <option value="light">{lightLabel}</option>
          <option value="dark">{darkLabel}</option>
          <option value="amt" title={AMT_TITLE}>
            {amtLabel}
          </option>
          <option value="vb6" title={VB6_TITLE}>
            {vb6Label}
          </option>
        </optgroup>
      </select>
    </div>
  );
}
