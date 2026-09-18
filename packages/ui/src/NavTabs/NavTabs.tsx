import { useRef, type KeyboardEvent } from "react";
import styles from "./NavTabs.module.css";

export type NavTab = {
  id: string;
  label: string;
};

export type NavTabsProps = {
  tabs: readonly NavTab[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel: string;
};

/**
 * STYLE.md's "| Main | Verlauf | Regeln |" bar. The ARIA Tabs pattern:
 * arrow keys both move focus and select (unlike the roving tabindex in a
 * plain toolbar), matching CardDeck's radiogroup keyboard model.
 */
export function NavTabs({ tabs, activeId, onChange, ariaLabel }: NavTabsProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
  const focusableIndex = activeIndex >= 0 ? activeIndex : 0;

  const focusAndSelect = (index: number) => {
    const wrapped = (index + tabs.length) % tabs.length;
    const tab = tabs[wrapped];
    if (!tab) return;
    buttonRefs.current[wrapped]?.focus();
    onChange(tab.id);
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(tabs.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.bar} role="tablist" aria-label={ariaLabel}>
      <span className={styles.divider} aria-hidden="true">
        |
      </span>
      {tabs.map((tab, index) => (
        <span key={tab.id} className={styles.tabWrapper}>
          <button
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === activeId}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={index === focusableIndex ? 0 : -1}
            className={tab.id === activeId ? styles.tabActive : styles.tab}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </button>
          <span className={styles.divider} aria-hidden="true">
            |
          </span>
        </span>
      ))}
    </div>
  );
}
