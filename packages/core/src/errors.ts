/** Custom SQLSTATEs raised by the RPCs; PostgREST surfaces them as error.code. */
export const VBS_ERROR_CODES = {
  VB001: "session_not_found",
  VB002: "session_expired",
  VB003: "session_full",
  VB004: "nickname_taken",
  VB005: "nickname_invalid",
  VB006: "not_admin",
  VB007: "invalid_token",
  VB008: "not_a_participant",
  VB009: "participant_not_found",
  VB010: "admin_invariant",
  VB011: "not_authenticated",
} as const;

export type VbsErrorCode = keyof typeof VBS_ERROR_CODES;
export type VbsErrorReason = (typeof VBS_ERROR_CODES)[VbsErrorCode];

/**
 * Typed on the shape rather than on supabase-js's PostgrestError, so this
 * package stays dependency-free.
 */
export function vbsErrorReason(error: unknown): VbsErrorReason | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  return VBS_ERROR_CODES[code as VbsErrorCode] ?? null;
}
