import styles from "./VoteDistribution.module.css";

export type VoteDistributionRow = {
  /** The card, e.g. "3", "XL" or "?". */
  value: string;
  count: number;
  /** e.g. "2 Stimmen" — composed by the caller, plurals and all. */
  countLabel: string;
  /** e.g. "Leo und Philipp" — joined by the caller (Intl.ListFormat). */
  voters: string;
  /** The whole row as one sentence for screen readers, e.g. "3: 2 Stimmen,
   * Leo und Philipp" — the visible pieces read badly run together ("3 2
   * Stimmen"), and word order is the caller's (i18n) business. */
  accessibleText: string;
};

/**
 * Votes grouped by card, one row each, in the order given: the card as a
 * chip styled like the card row, a bar sized against the largest group, the
 * count in words, and the voters' names beneath. The bar and the leading
 * group's filled chip are visual only — the count is always written out,
 * so neither is the sole cue (AAA: never color or shape alone).
 */
export function VoteDistribution({
  rows,
  ariaLabel,
}: {
  rows: VoteDistributionRow[];
  ariaLabel: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <ol aria-label={ariaLabel} className={styles.list}>
      {rows.map((row) => {
        const leading = row.count === max;
        return (
          <li
            key={row.value}
            className={
              leading ? `${styles.item} ${styles.leading}` : styles.item
            }
          >
            <span className={styles.srOnly}>{row.accessibleText}</span>
            <span className={styles.value} aria-hidden="true">
              {row.value}
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={styles.bar}
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </span>
            <span className={styles.count} aria-hidden="true">
              {row.countLabel}
            </span>
            <span className={styles.voters} aria-hidden="true">
              {row.voters}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
