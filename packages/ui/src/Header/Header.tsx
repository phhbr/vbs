import type { ReactNode } from "react";
import styles from "./Header.module.css";
import { LOGO_TEXT } from "./logo";

export type HeaderProps = {
  title: string;
  subtitle: string;
  /** The theme/locale toggle row (STYLE.md's "Darstellung: [Dunkel] | [Hell]" line). */
  actions?: ReactNode;
};

/**
 * The site's persistent branding, not a page heading — it renders on every
 * route, so it deliberately has no <h1> of its own (each route supplies the
 * one that describes its own content). The ASCII wordmark is decoration:
 * aria-hidden, with the real name as the eyebrow text right above it.
 */
export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <p className={styles.eyebrow}>{title.toUpperCase()}</p>
        <pre className={styles.logo} aria-hidden="true">
          {LOGO_TEXT}
        </pre>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
