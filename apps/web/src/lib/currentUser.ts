import type { User } from "@supabase/supabase-js";
import { createContext, use } from "react";

export const UserContext = createContext<User | null>(null);

export function useCurrentUser(): User {
  const user = use(UserContext);
  if (!user) throw new Error("useCurrentUser used outside AuthGate");
  return user;
}
