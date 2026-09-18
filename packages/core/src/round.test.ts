import { describe, expect, it } from "vitest";
import { cardsForDeck, FIBONACCI_CARDS, TSHIRT_CARDS } from "./round";

describe("cardsForDeck", () => {
  it("returns the fibonacci cards for the fibonacci deck", () => {
    expect(cardsForDeck("fibonacci")).toBe(FIBONACCI_CARDS);
  });

  it("returns the t-shirt cards for the tshirt deck", () => {
    expect(cardsForDeck("tshirt")).toBe(TSHIRT_CARDS);
  });
});
