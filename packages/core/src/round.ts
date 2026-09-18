import type { Deck } from "./session";

/**
 * Card values per deck. The database validates votes against the same set
 * (deck_card_values() in the voting migration) — this copy is for rendering
 * the card row, not for authority: a client-side mismatch just shows the
 * wrong cards, it can never make an invalid vote land.
 */
export const FIBONACCI_CARDS = [
  "0",
  "1",
  "2",
  "3",
  "5",
  "8",
  "13",
  "20",
  "40",
  "100",
  "?",
  "PAUSE",
] as const;

export const TSHIRT_CARDS = ["XS", "S", "M", "L", "XL", "XXL", "?"] as const;

export function cardsForDeck(deck: Deck): readonly string[] {
  return deck === "tshirt" ? TSHIRT_CARDS : FIBONACCI_CARDS;
}

export type RoundPhase = "voting" | "revealed";

/** Metadata only, as returned by session_state — never votes or a result. */
export type CurrentRound = {
  id: string;
  round_number: number;
  story: string;
  attempt: number;
  status: RoundPhase;
  started_at: string;
  revealed_at: string | null;
};

export type RoundResult = {
  type: "average" | "majority";
  value: string | null;
  consensus: boolean;
  spread: { min: number; max: number } | null;
  vote_count: number;
};

export type RoundStatusParticipant = {
  participant_id: string;
  voted: boolean;
  /** Own value always; others' only once the round is revealed. */
  value: string | null;
};

/** The round_status() RPC's payload — not to be confused with RoundPhase. */
export type RoundStatusResult = {
  round: {
    id: string;
    round_number: number;
    story: string;
    attempt: number;
    status: RoundPhase;
    started_at: string;
    revealed_at: string | null;
  };
  result: RoundResult | null;
  participants: RoundStatusParticipant[];
};
