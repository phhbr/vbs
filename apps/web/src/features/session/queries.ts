import type { SessionState } from "@vbs/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimAdmin,
  createSession,
  fetchSessionState,
  joinSession,
  transferAdmin,
} from "./api";

export const sessionKey = (code: string) => ["session", code] as const;

export function useSessionState(code: string) {
  return useQuery<SessionState>({
    queryKey: sessionKey(code),
    queryFn: () => fetchSessionState(code),
    // No polling in M2 — M3 replaces the refresh button with realtime.
    refetchInterval: false,
    retry: false,
  });
}

export function useCreateSession() {
  return useMutation({ mutationFn: createSession });
}

export function useJoinSession(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nickname: string) => joinSession(code, nickname),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useClaimAdmin(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => claimAdmin(code, token),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useTransferAdmin(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transferAdmin,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}
