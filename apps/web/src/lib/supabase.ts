import type { Database } from "@vbs/core";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required — copy apps/web/.env.example to .env.local",
  );
}

export const supabase = createClient<Database>(url, anonKey);
