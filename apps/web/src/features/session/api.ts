import type {
  ClaimAdminResult,
  CreateSessionResult,
  Deck,
  JoinSessionResult,
  LeaveSessionResult,
  RemoveParticipantResult,
  SessionState,
} from "@vbs/core";
import { supabase } from "../../lib/supabase";

/**
 * supabase-js reports failures in `error` rather than throwing. Rethrowing it
 * keeps the PostgrestError shape — including `code`, which carries our VBxxx
 * SQLSTATE — so callers can map it with vbsErrorReason().
 *
 * The RPCs return jsonb, which the generated types can only describe as `Json`,
 * so the payload shape is asserted against the hand-written types in @vbs/core.
 */
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export async function createSession(input: {
  nickname: string;
  deck: Deck;
  locale: string;
}): Promise<CreateSessionResult> {
  return unwrap<CreateSessionResult>(
    await supabase.rpc("create_session", {
      p_nickname: input.nickname,
      p_deck: input.deck,
      p_locale: input.locale,
    }),
  );
}

export async function joinSession(
  code: string,
  nickname: string,
): Promise<JoinSessionResult> {
  return unwrap<JoinSessionResult>(
    await supabase.rpc("join_session", {
      p_code: code,
      p_nickname: nickname,
    }),
  );
}

export async function fetchSessionState(code: string): Promise<SessionState> {
  return unwrap<SessionState>(
    await supabase.rpc("session_state", { p_code: code }),
  );
}

export async function claimAdmin(
  code: string,
  token: string,
): Promise<ClaimAdminResult> {
  return unwrap<ClaimAdminResult>(
    await supabase.rpc("claim_admin", { p_code: code, p_token: token }),
  );
}

export async function transferAdmin(
  participantId: string,
): Promise<ClaimAdminResult> {
  return unwrap<ClaimAdminResult>(
    await supabase.rpc("transfer_admin", { p_participant_id: participantId }),
  );
}

export async function removeParticipant(
  participantId: string,
): Promise<RemoveParticipantResult> {
  return unwrap<RemoveParticipantResult>(
    await supabase.rpc("remove_participant", {
      p_participant_id: participantId,
    }),
  );
}

export async function leaveSession(code: string): Promise<LeaveSessionResult> {
  return unwrap<LeaveSessionResult>(
    await supabase.rpc("leave_session", { p_code: code }),
  );
}

/**
 * Called after join_session fails with session_not_found/session_expired.
 * join_session cannot record its own failure — PostgREST rolls the whole
 * call's transaction back along with any insert made on the way out — so
 * this is its own, separate, always-succeeding call instead.
 */
export async function recordJoinFailure(): Promise<void> {
  unwrap<null>(await supabase.rpc("record_join_failure"));
}
