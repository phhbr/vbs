import { BracketToggle } from "../BracketToggle/BracketToggle";

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
    <BracketToggle
      label={label}
      value={theme}
      onChange={onChange}
      optionA={{ value: "dark", label: darkLabel }}
      optionB={{ value: "light", label: lightLabel }}
    />
  );
}
