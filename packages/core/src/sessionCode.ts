export const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const SESSION_CODE_LENGTH = 12;

/**
 * Mirrors `normalize_session_code()` in the database: drop everything outside
 * the alphabet and upper-case, so a pasted "abcd-efgh jklm" still resolves.
 */
export function normalizeSessionCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Groups a code as XXXX-XXXX-XXXX for display. URLs carry the bare form. */
export function formatSessionCode(code: string): string {
  const normalized = normalizeSessionCode(code);
  return (normalized.match(/.{1,4}/g) ?? []).join("-");
}

export function isValidSessionCode(code: string): boolean {
  const normalized = normalizeSessionCode(code);
  if (normalized.length !== SESSION_CODE_LENGTH) return false;
  return [...normalized].every((c) => SESSION_CODE_ALPHABET.includes(c));
}
