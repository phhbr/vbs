import type { Deck, RoundStatusResult } from "@vbs/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateSessionData } from "../session/queries";
import {
  fetchRoundHistory,
  fetchRoundStatus,
  newStory,
  reEstimate,
  reveal,
  setDeck,
  startStory,
  vote,
} from "./api";

export const roundKey = (roundId: string) => ["round", roundId] as const;
// Prefixed with "round" (not a separate top-level key) so
// useSessionRealtime's refetch predicate — which matches "session" and
// "round" — picks this up too, without needing its own case.
export const roundHistoryKey = (sessionId: string) =>
  ["round", "history", sessionId] as const;

export function useRoundStatus(roundId: string | undefined) {
  return useQuery<RoundStatusResult>({
    queryKey: roundKey(roundId ?? ""),
    queryFn: () => fetchRoundStatus(roundId!),
    enabled: !!roundId,
    // Realtime drives refetches; no polling needed.
    refetchInterval: false,
  });
}

export function useRoundHistory(sessionId: string | undefined) {
  return useQuery({
    queryKey: roundHistoryKey(sessionId ?? ""),
    queryFn: () => fetchRoundHistory(sessionId!),
    enabled: !!sessionId,
    refetchInterval: false,
  });
}

export function useStartStory(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => startStory(code, title),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useNewStory(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => newStory(code),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useSetDeck(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deck: Deck) => setDeck(code, deck),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useVote(roundId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => vote(roundId!, value),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useReveal(roundId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reveal(roundId!),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useReEstimate(roundId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reEstimate(roundId!),
    onSuccess: () => invalidateSessionData(queryClient),
  });
}
