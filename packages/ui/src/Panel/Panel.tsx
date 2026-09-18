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
  /** Defaults to h3: panels sit inside an already-titled section (h2). */
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
  headingLevel: Heading = "h3",
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
