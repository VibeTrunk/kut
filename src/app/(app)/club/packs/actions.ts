"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type OpenPackState = { error: string | null };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function openPack(
  _previousState: OpenPackState,
  formData: FormData,
): Promise<OpenPackState> {
  await requireUser();
  const packSlug = String(formData.get("packSlug") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");

  if (!slugPattern.test(packSlug) || !uuidPattern.test(idempotencyKey)) {
    return { error: "This pack request was invalid. Please refresh and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("open_pack", {
    p_pack_slug: packSlug,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data || typeof data !== "object" || !("opening_id" in data) || typeof data.opening_id !== "string") {
    return { error: "The pack could not be opened. Check your TF Coin balance and try again." };
  }

  redirect(`/club/packs/${data.opening_id}`);
}
