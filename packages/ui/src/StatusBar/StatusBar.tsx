import type { ReactNode } from "react";
import styles from "./StatusBar.module.css";

export type StatusBarItem = {
  label: string;
  value: ReactNode;
};

export function StatusBar({
  items,
  ariaLabel,
}: {
  items: StatusBarItem[];
  ariaLabel: string;
}) {
  return (
    <div className={styles.bar} role="group" aria-label={ariaLabel}>
      <span className={styles.divider} aria-hidden="true">
        |
      </span>
      {items.map((item, index) => (
        <span key={index}>
          {item.label}: <span className={styles.value}>{item.value}</span>{" "}
          <span className={styles.divider} aria-hidden="true">
            |
          </span>
        </span>
      ))}
    </div>
  );
}
