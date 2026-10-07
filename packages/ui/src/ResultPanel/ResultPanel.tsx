import type { ReactNode } from "react";
import styles from "./ResultPanel.module.css";

export type ResultPanelProps = {
  /** e.g. "Ø Durchschnitt" or "Mehrheit". */
  label: string;
  value: string;
  /** Shown as a filled badge, e.g. "KONSENS ERREICHT" — omit when there is none. */
  consensusLabel?: string;
  /** e.g. "Streuung: 5 – 13 — Diskussion empfohlen." — omit when there is none. */
  spreadText?: string;
  /** The votes by card (a VoteDistribution) — the panel's main content
   * when present, with label/value demoted to a secondary summary line. */
  distribution?: ReactNode;
  /** e.g. "Nicht abgestimmt: Finn" — omit when everyone voted. */
  notVotedText?: string;
};

export function ResultPanel({
  label,
  value,
  consensusLabel,
  spreadText,
  distribution,
  notVotedText,
}: ResultPanelProps) {
  const summary = (
    <p className={distribution ? styles.summary : undefined}>
      {label}: <strong className={styles.value}>{value}</strong>
    </p>
  );

  return (
    <div>
      {!distribution && summary}
      {consensusLabel && <p className={styles.badge}>{consensusLabel}</p>}
      {distribution && (
        <div className={styles.distribution}>{distribution}</div>
      )}
      {!consensusLabel && spreadText && (
        <p className={styles.spread}>{spreadText}</p>
      )}
      {distribution && summary}
      {notVotedText && <p className={styles.notVoted}>{notVotedText}</p>}
    </div>
  );
}
