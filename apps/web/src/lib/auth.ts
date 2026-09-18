import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

let pending: Promise<User> | null = null;

/**
 * The single place anonymous sign-in happens. Memoised on a module-level
 * promise so concurrent callers (and StrictMode's double effect) share one
 * sign-in instead of creating a second anonymous user. captchaToken is only
 * meaningful on the call that actually starts signIn(); once memoised,
 * later calls (with or without a token) just return the same promise.
 */
export function ensureAnonymousUser(captchaToken?: string): Promise<User> {
  pending ??= signIn(captchaToken);
  return pending;
}

async function signIn(captchaToken?: string): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user;

  const signedIn = await supabase.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  );
  if (signedIn.error) throw signedIn.error;
  if (!signedIn.data.user) {
    throw new Error("anonymous sign-in returned no user");
  }
  return signedIn.data.user;
}
