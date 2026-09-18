import {
  useId,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./Panel.module.css";

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** The "» Heading" pattern (STYLE.md). Omit for a plain box. */
  heading?: ReactNode;
  /** Defaults to h3: panels sit inside an already-titled section (h2). */
  headingLevel?: ElementType;
};

/**
 * A titled Panel is a <section> with an accessible name (exposing it as a
 * "region" landmark) — a self-contained box with its own heading earns that,
 * unlike a bare <div>. An untitled Panel stays a <div>, since a region with
 * no name would just be landmark noise.
 */
export function Panel({
  heading,
  headingLevel: Heading = "h3",
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
      <Heading id={headingId} className={styles.heading}>
        <span aria-hidden="true">&raquo; </span>
        {heading}
      </Heading>
      {children}
    </section>
  );
}
