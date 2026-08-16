import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for invite onboarding.");
  }

  const { url } = getSupabasePublicEnv();
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
