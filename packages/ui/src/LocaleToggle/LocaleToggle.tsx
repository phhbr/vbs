import { BracketToggle } from "../BracketToggle/BracketToggle";

export type LocaleToggleProps = {
  locale: "de" | "en";
  onChange: (locale: "de" | "en") => void;
  label: string;
  deLabel: string;
  enLabel: string;
};

/**
 * New in M4 — the prototype is German-only, so this has no direct
 * prototype block, but follows the same labeled bracket-pair pattern as
 * ThemeToggle (design revision finding 11 — every control group gets its
 * own label).
 */
export function LocaleToggle({
  locale,
  onChange,
  label,
  deLabel,
  enLabel,
}: LocaleToggleProps) {
  return (
    <BracketToggle
      label={label}
      value={locale}
      onChange={onChange}
      optionA={{ value: "de", label: deLabel }}
      optionB={{ value: "en", label: enLabel }}
    />
  );
}
