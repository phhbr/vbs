const FRAGMENT_KEY = "admin";

/**
 * The recovery token travels in the URL fragment, which browsers never send to
 * a server, so it stays out of access logs and Referer headers.
 */
export function readAdminTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get(FRAGMENT_KEY);
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
}

export function adminRecoveryUrl(origin: string, code: string, token: string) {
  return `${origin}/s/${code}#${FRAGMENT_KEY}=${token}`;
}

/**
 * Drops the fragment without touching history, so the token cannot be
 * recovered from the back button or leak through a shared screen.
 */
export function stripHash() {
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
}
