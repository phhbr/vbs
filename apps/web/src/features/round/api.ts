import type { CurrentRound, Deck, RoundStatusResult } from "@vbs/core";
import { supabase } from "../../lib/supabase";

// Same unwrap pattern as ../session/api.ts: supabase-js reports failures in
// `error` rather than throwing, so rethrowing it keeps the PostgrestError
// shape (including `code`, our VBxxx SQLSTATE) for vbsErrorReason().
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export async function startStory(
  code: string,
  title: string,
): Promise<Pick<CurrentRound, "id" | "round_number" | "story" | "attempt">> {
  return unwrap(
    await supabase.rpc("start_story", { p_code: code, p_title: title }),
  );
}

export async function newStory(code: string): Promise<{ code: string }> {
  return unwrap(await supabase.rpc("new_story", { p_code: code }));
}

export async function setDeck(
  code: string,
  deck: Deck,
): Promise<{ code: string; deck: Deck }> {
  return unwrap(
    await supabase.rpc("set_deck", { p_code: code, p_deck: deck }),
  );
}

export async function vote(
  roundId: string,
  value: string,
): Promise<{ round_id: string; value: string }> {
  return unwrap(
    await supabase.rpc("vote", { p_round_id: roundId, p_value: value }),
  );
}

export async function reveal(
  roundId: string,
): Promise<{ round_id: string; result: unknown }> {
  return unwrap(await supabase.rpc("reveal", { p_round_id: roundId }));
}

export async function reEstimate(
  roundId: string,
): Promise<Pick<CurrentRound, "id" | "round_number" | "story" | "attempt">> {
  return unwrap(await supabase.rpc("re_estimate", { p_round_id: roundId }));
}

export async function fetchRoundStatus(
  roundId: string,
): Promise<RoundStatusResult> {
  return unwrap(await supabase.rpc("round_status", { p_round_id: roundId }));
}
