import { describe, expect, it } from "vitest";
import {
  cardsForDeck,
  FIBONACCI_CARDS,
  groupVotesByValue,
  TSHIRT_CARDS,
} from "./round";

describe("cardsForDeck", () => {
  it("returns the fibonacci cards for the fibonacci deck", () => {
    expect(cardsForDeck("fibonacci")).toBe(FIBONACCI_CARDS);
  });

  it("returns the t-shirt cards for the tshirt deck", () => {
    expect(cardsForDeck("tshirt")).toBe(TSHIRT_CARDS);
  });
});

describe("groupVotesByValue", () => {
  it("groups by card in deck order, not by vote count or arrival", () => {
    const groups = groupVotesByValue(FIBONACCI_CARDS, [
      { name: "Cy", value: "13" },
      { name: "Leo", value: "3" },
      { name: "Eva", value: "?" },
      { name: "Philipp", value: "3" },
      { name: "Dee", value: "5" },
    ]);

    expect(groups.map((g) => g.value)).toEqual(["3", "5", "13", "?"]);
  });

  it("sorts the names within each group", () => {
    const [group] = groupVotesByValue(FIBONACCI_CARDS, [
      { name: "Philipp", value: "3" },
      { name: "Leo", value: "3" },
      { name: "ada", value: "3" },
    ]);

    expect(group?.voters).toEqual(["ada", "Leo", "Philipp"]);
  });

  it("orders t-shirt sizes by size, not alphabetically", () => {
    const groups = groupVotesByValue(TSHIRT_CARDS, [
      { name: "A", value: "XL" },
      { name: "B", value: "S" },
      { name: "C", value: "M" },
    ]);

    expect(groups.map((g) => g.value)).toEqual(["S", "M", "XL"]);
  });

  it("keeps a value outside the deck, sorted last", () => {
    const groups = groupVotesByValue(FIBONACCI_CARDS, [
      { name: "A", value: "XL" },
      { name: "B", value: "1" },
    ]);

    expect(groups.map((g) => g.value)).toEqual(["1", "XL"]);
  });

  it("returns no groups for no votes", () => {
    expect(groupVotesByValue(FIBONACCI_CARDS, [])).toEqual([]);
  });
});
