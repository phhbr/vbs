import type { ButtonHTMLAttributes, Ref } from "react";
import styles from "./BracketButton.module.css";

export type BracketButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accent border — the one emphasized action in a group (e.g. submit). */
  variant?: "default" | "primary";
  /** The inverted "on" state: active tab, active toggle option, selected
   * deck. Distinct from :hover/:focus-visible, which invert on their own. */
  active?: boolean;
  /** React 19 accepts ref as a plain prop — NavTabs' roving tabindex needs
   * to focus a specific button directly. */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * The one component behind every bracket action in the app — plain
 * buttons, toggle options, nav tabs, deck/role pickers. Brackets are
 * rendered here as separate aria-hidden spans around the label, never
 * baked into the label string, so their spacing can't drift between
 * components or locales (design revision finding 2).
 */
export function BracketButton({
  type = "button",
  className,
  variant = "default",
  active = false,
  ref,
  children,
  ...props
}: BracketButtonProps) {
  const classNames = [
    styles.button,
    variant === "primary" ? styles.primary : null,
    active ? styles.active : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button ref={ref} type={type} className={classNames} {...props}>
      <span className={styles.bracket} aria-hidden="true">
        [
      </span>
      {children}
      <span className={styles.bracket} aria-hidden="true">
        ]
      </span>
    </button>
  );
}
