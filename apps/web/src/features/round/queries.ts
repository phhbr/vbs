import type { Deck, RoundStatusResult } from "@vbs/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionKey } from "../session/queries";
import {
  fetchRoundStatus,
  newStory,
  reEstimate,
  reveal,
  setDeck,
  startStory,
  vote,
} from "./api";

export const roundKey = (roundId: string) => ["round", roundId] as const;

export function useRoundStatus(roundId: string | undefined) {
  return useQuery<RoundStatusResult>({
    queryKey: roundKey(roundId ?? ""),
    queryFn: () => fetchRoundStatus(roundId!),
    enabled: !!roundId,
    // Realtime drives refetches; no polling needed.
    refetchInterval: false,
  });
}

export function useStartStory(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => startStory(code, title),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useNewStory(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => newStory(code),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useSetDeck(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deck: Deck) => setDeck(code, deck),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useVote(roundId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: string) => vote(roundId!, value),
    onSuccess: () =>
      roundId && queryClient.invalidateQueries({ queryKey: roundKey(roundId) }),
  });
}

export function useReveal(roundId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reveal(roundId!),
    onSuccess: () =>
      roundId && queryClient.invalidateQueries({ queryKey: roundKey(roundId) }),
  });
}

export function useReEstimate(roundId: string | undefined, code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reEstimate(roundId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}
