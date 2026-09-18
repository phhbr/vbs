import type { ElementType, HTMLAttributes, ReactNode } from "react";
import styles from "./Panel.module.css";

export type PanelProps = HTMLAttributes<HTMLDivElement> & {
  /** The "» Heading" pattern (STYLE.md). Omit for a plain box. */
  heading?: ReactNode;
  /** Defaults to h3: panels sit inside an already-titled section (h2). */
  headingLevel?: ElementType;
};

export function Panel({
  heading,
  headingLevel: Heading = "h3",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={className ? `${styles.panel} ${className}` : styles.panel}
      {...props}
    >
      {heading !== undefined && (
        <Heading className={styles.heading}>
          <span aria-hidden="true">&raquo; </span>
          {heading}
        </Heading>
      )}
      {children}
    </div>
  );
}
