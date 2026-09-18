import { BracketToggle } from "../BracketToggle/BracketToggle";

export type LocaleToggleProps = {
  locale: "de" | "en";
  onChange: (locale: "de" | "en") => void;
  deLabel: string;
  enLabel: string;
};

/**
 * New in M4 — STYLE.md's prototype is German-only, so this has no direct
 * prototype block, but follows the same bracket-pair pattern as ThemeToggle.
 */
export function LocaleToggle({
  locale,
  onChange,
  deLabel,
  enLabel,
}: LocaleToggleProps) {
  return (
    <BracketToggle
      value={locale}
      onChange={onChange}
      optionA={{ value: "de", label: deLabel }}
      optionB={{ value: "en", label: enLabel }}
    />
  );
}
