import type { SessionState } from "@vbs/core";
import { vbsErrorReason } from "@vbs/core";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

/**
 * Everything a session screen shows: session_state plus every "round"-keyed
 * query (current round status, round history). Every mutation calls this on
 * success instead of picking the one query it thinks it changed — a reveal,
 * for one, changes the round status *and* session_state's current_round,
 * and refetching only the former left the result panel saying "voting"
 * until a broadcast or poll caught up. The realtime handler uses the same
 * helper, so both paths always agree on what "refresh" means.
 */
export function invalidateSessionData(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "session" || query.queryKey[0] === "round",
  });
}

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
    onSuccess: () => invalidateSessionData(queryClient),
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
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useTransferAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transferAdmin,
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

/** Mints a fresh recovery link on demand — the database can never
 * redisplay the original, and claim_admin now invalidates it after one
 * use anyway, so this is the only way to get a working link again. */
export function useRegenerateAdminToken(code: string) {
  return useMutation({ mutationFn: () => regenerateAdminToken(code) });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeParticipant,
    onSuccess: () => invalidateSessionData(queryClient),
  });
}

export function useLeaveSession(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveSession(code),
    // Not awaited, unlike every other mutation here: the caller navigates
    // away in its own onSuccess, and TanStack runs that only after this one
    // settles. Awaiting the refetch let the "no longer a member" state
    // render first, which unmounted the caller and silently dropped the
    // navigation. Nothing on the screen being left needs to be current.
    onSuccess: () => {
      void invalidateSessionData(queryClient);
    },
  });
}
