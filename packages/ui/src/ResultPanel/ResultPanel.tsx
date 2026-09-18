import styles from "./ResultPanel.module.css";

export type ResultPanelProps = {
  /** e.g. "Ø Durchschnitt" or "Mehrheit". */
  label: string;
  value: string;
  /** Shown as a filled badge, e.g. "KONSENS ERREICHT" — omit when there is none. */
  consensusLabel?: string;
  /** e.g. "Streuung: 5 – 13 — Diskussion empfohlen." — omit when there is none. */
  spreadText?: string;
};

export function ResultPanel({
  label,
  value,
  consensusLabel,
  spreadText,
}: ResultPanelProps) {
  return (
    <div>
      <p>
        {label}: <strong className={styles.value}>{value}</strong>
      </p>
      {consensusLabel && <p className={styles.badge}>{consensusLabel}</p>}
      {!consensusLabel && spreadText && (
        <p className={styles.spread}>{spreadText}</p>
      )}
    </div>
  );
}
