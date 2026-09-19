import type { SessionState } from "@vbs/core";
import { vbsErrorReason } from "@vbs/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimAdmin,
  createSession,
  fetchSessionState,
  joinSession,
  leaveSession,
  recordJoinFailure,
  regenerateAdminToken,
  removeParticipant,
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
    onError: (error: unknown) => {
      const reason = vbsErrorReason(error);
      if (reason === "session_not_found" || reason === "session_expired") {
        void recordJoinFailure();
      }
    },
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

/** Mints a fresh recovery link on demand — the database can never
 * redisplay the original, and claim_admin now invalidates it after one
 * use anyway, so this is the only way to get a working link again. */
export function useRegenerateAdminToken(code: string) {
  return useMutation({ mutationFn: () => regenerateAdminToken(code) });
}

export function useRemoveParticipant(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeParticipant,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}

export function useLeaveSession(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveSession(code),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: sessionKey(code) }),
  });
}
