"use server";

import { revalidatePath } from "next/cache";
import { isArchetype } from "@/game/archetypes";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type CardActionState = { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateCard() {
  revalidatePath("/settings/card");
  revalidatePath("/"); // Live Ratings
  revalidatePath("/players");
  revalidatePath("/club/collection");
}

function friendlyError(code: string | undefined, message: string | undefined): string {
  if (message?.includes("no linked player")) {
    return "Your account isn't linked to a player yet. Ask an admin to link it.";
  }
  if (code === "22023") {
    return "That value wasn't accepted. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export async function savePlayerPhoto(_prev: CardActionState, formData: FormData): Promise<CardActionState> {
  await requireUser();

  const photoPath = String(formData.get("photo_path") ?? "").trim();
  if (!photoPath || photoPath.length > 200) {
    return { ok: false, error: "Missing uploaded photo path." };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_own_player_photo", { p_photo_path: photoPath });
  if (error) {
    return { ok: false, error: friendlyError(error.code, error.message) };
  }

  revalidateCard();
  return { ok: true, message: "Photo saved. Your card now shows it everywhere." };
}

export async function clearPlayerPhoto(): Promise<CardActionState> {
  await requireUser();

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_own_player_photo", { p_photo_path: null });
  if (error) {
    return { ok: false, error: friendlyError(error.code, error.message) };
  }

  revalidateCard();
  return { ok: true, message: "Photo removed. Your card is back to its initials." };
}

export async function savePlayerArchetype(_prev: CardActionState, formData: FormData): Promise<CardActionState> {
  await requireUser();

  const archetype = String(formData.get("archetype") ?? "");
  if (!isArchetype(archetype)) {
    return { ok: false, error: "Pick a valid archetype." };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("set_own_player_archetype", { p_archetype: archetype });
  if (error) {
    return { ok: false, error: friendlyError(error.code, error.message) };
  }

  revalidateCard();
  return { ok: true, message: "Archetype updated. Your six stats have been recalculated." };
}
