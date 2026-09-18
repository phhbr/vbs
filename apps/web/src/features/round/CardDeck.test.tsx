import { CardDeck } from "@vbs/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// CardDeck lives in @vbs/ui, but its keyboard/ARIA behavior is exercised
// here rather than in packages/ui, which has no jsdom/testing-library setup
// of its own — apps/web already does, and CardDeck has no app dependency,
// so importing it through the workspace package is the pragmatic choice
// over duplicating that test infrastructure for one component.

const cards = ["1", "2", "3"] as const;

describe("CardDeck", () => {
  it("renders one radio per card with the current value checked", () => {
    render(
      <CardDeck
        cards={cards}
        value="2"
        onChange={vi.fn()}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    expect(screen.getByRole("radio", { name: "1" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: "2" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("selects a card on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CardDeck
        cards={cards}
        value={null}
        onChange={onChange}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    await user.click(screen.getByRole("radio", { name: "3" }));

    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("moves focus and selects with the arrow keys", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CardDeck
        cards={cards}
        value="1"
        onChange={onChange}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    screen.getByRole("radio", { name: "1" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("2");
    expect(screen.getByRole("radio", { name: "2" })).toHaveFocus();
  });

  it("wraps from the last card back to the first", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CardDeck
        cards={cards}
        value="3"
        onChange={onChange}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    screen.getByRole("radio", { name: "3" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("jumps to the first and last card with Home and End", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CardDeck
        cards={cards}
        value="2"
        onChange={onChange}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    screen.getByRole("radio", { name: "2" }).focus();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("3");

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("1");
  });

  it("disables every card when the round is not accepting votes", () => {
    render(
      <CardDeck
        cards={cards}
        value={null}
        onChange={vi.fn()}
        disabled={true}
        ariaLabel="Cards"
      />,
    );

    for (const card of cards) {
      expect(screen.getByRole("radio", { name: card })).toBeDisabled();
    }
  });

  it("makes only the selected (or first) card tab-reachable", () => {
    render(
      <CardDeck
        cards={cards}
        value="2"
        onChange={vi.fn()}
        disabled={false}
        ariaLabel="Cards"
      />,
    );

    expect(screen.getByRole("radio", { name: "1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("radio", { name: "2" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
