import type { ButtonHTMLAttributes } from "react";
import styles from "./BracketButton.module.css";

export type BracketButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** The bracket-action pattern: a `<button>` styled to look like a link. */
export function BracketButton({
  type = "button",
  className,
  ...props
}: BracketButtonProps) {
  return (
    <button
      type={type}
      className={className ? `${styles.button} ${className}` : styles.button}
      {...props}
    />
  );
}
