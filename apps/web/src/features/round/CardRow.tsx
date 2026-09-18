import { useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * A custom radiogroup rather than native radio inputs: STYLE.md calls for
 * square, button-shaped cards, and the ARIA radiogroup pattern (real
 * <button>s with role="radio", roving tabindex, arrow keys both move focus
 * and select) is what makes that fully keyboard-operable without falling
 * back to a div with an onClick.
 */
export function CardRow({
  cards,
  value,
  onChange,
  disabled,
}: {
  cards: readonly string[];
  value: string | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = value ? cards.indexOf(value) : -1;
  const focusableIndex = selectedIndex >= 0 ? selectedIndex : 0;

  const focusAndSelect = (index: number) => {
    const wrapped = (index + cards.length) % cards.length;
    const card = cards[wrapped];
    if (card === undefined) return;
    buttonRefs.current[wrapped]?.focus();
    onChange(card);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAndSelect(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAndSelect(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAndSelect(0);
        break;
      case "End":
        event.preventDefault();
        focusAndSelect(cards.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div role="radiogroup" aria-label={t("round.cards")}>
      {cards.map((card, index) => {
        const selected = card === value;
        return (
          <button
            key={card}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusableIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(card)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
