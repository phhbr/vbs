import type { ReactNode } from "react";
import styles from "./ParticipantList.module.css";

export type ParticipantListItem = {
  id: string;
  name: string;
  isYou: boolean;
  /** Fully composed, e.g. "has voted", "waiting …", "5", "waiting … (offline)". */
  status: string;
  /** "waiting" = danger, "voted" = accent, "neutral" = body text. */
  statusVariant: "waiting" | "voted" | "neutral";
  /** e.g. an admin's remove control. Omitted for most rows. */
  action?: ReactNode;
};

export function ParticipantList({
  items,
  ariaLabel,
  youSuffix,
}: {
  items: ParticipantListItem[];
  ariaLabel: string;
  /** e.g. "you" — appended in parentheses after the participant's own name. */
  youSuffix: string;
}) {
  return (
    <ul aria-live="polite" aria-label={ariaLabel} className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          {item.name}
          {item.isYou ? ` (${youSuffix})` : ""} —{" "}
          <span
            className={
              item.statusVariant === "waiting"
                ? styles.waiting
                : item.statusVariant === "voted"
                  ? styles.voted
                  : undefined
            }
          >
            {item.status}
          </span>
          {item.action && <> {item.action}</>}
        </li>
      ))}
    </ul>
  );
}
