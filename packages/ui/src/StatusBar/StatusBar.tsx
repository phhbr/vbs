import type { ReactNode } from "react";
import styles from "./StatusBar.module.css";

export type StatusBarItem = {
  label: string;
  value: ReactNode;
};

/**
 * A grid of label-over-value pairs (design revision finding 4) — no pipe
 * characters, no borders on the row itself. Meant to sit inside a Panel.
 */
export function StatusBar({
  items,
  ariaLabel,
}: {
  items: StatusBarItem[];
  ariaLabel: string;
}) {
  return (
    <div className={styles.meta} role="group" aria-label={ariaLabel}>
      {items.map((item, index) => (
        <div key={index} className={styles.item}>
          <span className={styles.label}>{item.label}</span>
          <span className={styles.value}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
