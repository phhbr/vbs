import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

let pending: Promise<User> | null = null;

/**
 * The single place anonymous sign-in happens. Memoised on a module-level
 * promise so concurrent callers (and StrictMode's double effect) share one
 * sign-in instead of creating a second anonymous user.
 */
export function ensureAnonymousUser(): Promise<User> {
  pending ??= signIn();
  return pending;
}

async function signIn(): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user;

  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error) throw signedIn.error;
  if (!signedIn.data.user) {
    throw new Error("anonymous sign-in returned no user");
  }
  return signedIn.data.user;
}
