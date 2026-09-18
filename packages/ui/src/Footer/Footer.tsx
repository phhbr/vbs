import type { ReactNode } from "react";
import styles from "./Footer.module.css";

export type FooterProps = {
  /** Joined with " · ", e.g. ["VBS", sessionCode, "Runde 3"]. */
  segments: ReactNode[];
  /** The prototype's [Leave session], when there is a session to leave. */
  action?: ReactNode;
};

export function Footer({ segments, action }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <span className={styles.segments}>
        {segments.map((segment, index) => (
          // Segments are short, static, ordered labels, not a growing or
          // reorderable list, so the index is a stable enough key here.
          <span key={index}>
            {index > 0 && <span aria-hidden="true">&middot; </span>}
            {segment}
          </span>
        ))}
      </span>
      {action && (
        <>
          <span aria-hidden="true">&mdash;</span>
          {action}
        </>
      )}
    </footer>
  );
}
