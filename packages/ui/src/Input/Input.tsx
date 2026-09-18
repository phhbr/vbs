import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Input.module.css";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * The one styled text input in the app (design revision finding 6): same
 * dashed border as a Panel, no radius, flex:1 so it fills an .InputRow
 * beside a button, same min-height as a button so their centers line up,
 * and its own accent-colored focus outline (distinct from every other
 * focusable element's fg-strong ring, so a dashed border plus a
 * same-color ring don't blur into one shape).
 */
export function Input({ type = "text", className, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={className ? `${styles.input} ${className}` : styles.input}
      {...props}
    />
  );
}

/** A label-above-input pair, gap 10 — the recurring form-field shape. */
export function Field({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `${styles.field} ${className}` : styles.field}>
      {children}
    </div>
  );
}

/** An Input paired with an adjacent button (e.g. a "regenerate" action),
 * their centers aligned since both share the same min-height. */
export function InputRow({ children }: { children: ReactNode }) {
  return <div className={styles.inputRow}>{children}</div>;
}
