import {
  useId,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Panel.module.css";

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** Uppercase, letter-spaced panel title. Omit for a plain box. */
  heading?: ReactNode;
  /** Defaults to h2: every panel in the app today sits directly under a
   * route's own h1, as a sibling, never nested inside a further-titled
   * section — axe's heading-order rule caught the h3 default skipping a
   * level everywhere it was used without an override. Pass "h3" (or
   * higher) explicitly for a panel that genuinely nests inside another
   * heading. */
  headingLevel?: ElementType;
  /** Rendered beside the heading in the title bar, e.g. "Rundenverlauf
   * [ Alle ]" or the deck-picker buttons beside "Neue Story". */
  headingAction?: ReactNode;
};

/**
 * A titled Panel is a <section> with an accessible name (exposing it as a
 * "region" landmark) — a self-contained box with its own heading earns
 * that, unlike a bare <div>. An untitled Panel stays a <div>, since a
 * region with no name would just be landmark noise. Every section is a
 * panel with the same title bar (design revision finding 9) — there is no
 * separate "boxless" heading style anywhere else in the app.
 */
export function Panel({
  heading,
  headingLevel: Heading = "h2",
  headingAction,
  className,
  children,
  ...props
}: PanelProps) {
  const headingId = useId();
  const classNames = className ? `${styles.panel} ${className}` : styles.panel;

  if (heading === undefined) {
    return (
      <div className={classNames} {...props}>
        {children}
      </div>
    );
  }

  return (
    <section className={classNames} aria-labelledby={headingId} {...props}>
      <div className={styles.head}>
        <Heading id={headingId} className={styles.heading}>
          {heading}
        </Heading>
        {headingAction}
      </div>
      {children}
    </section>
  );
}
