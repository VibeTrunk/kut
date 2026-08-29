"use server";

import { revalidatePath } from "next/cache";
import { isArchetype } from "@/game/archetypes";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AddPlayerState =
  | { ok: true; player: { slug: string; display_name: string } }
  | { ok: false; error: string }
  | null;

export type RosterActionState = { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateRoster() {
  revalidatePath("/admin/roster");
  revalidatePath("/"); // Live Ratings
  revalidatePath("/players"); // directory placeholder
}

export async function addPlayer(_prev: AddPlayerState, formData: FormData): Promise<AddPlayerState> {
  await requireAdmin();

  const displayName = String(formData.get("display_name") ?? "").trim();
  const archetype = String(formData.get("archetype") ?? "all_rounder");
  const fullName = String(formData.get("full_name") ?? "").trim() || null;

  if (!displayName || displayName.length > 80) {
    return { ok: false, error: "Display name must be 1–80 characters." };
  }
  if (!isArchetype(archetype)) {
    return { ok: false, error: "Pick a valid archetype." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("admin_add_player", {
    p_display_name: displayName,
    p_archetype: archetype,
    p_full_name: fullName,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("admin access")
        ? "You don't have permission to do this."
        : "Couldn't add the player. Check the name and try again.",
    };
  }

  revalidateRoster();
  return { ok: true, player: data as { slug: string; display_name: string } };
}

export async function manageRoster(_prev: RosterActionState, formData: FormData): Promise<RosterActionState> {
  await requireAdmin();

  const intent = String(formData.get("intent") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!UUID_RE.test(playerId)) return { ok: false, error: "Invalid player." };

  const supabase = await createClient();

  if (intent === "toggle") {
    const makeActive = String(formData.get("is_active") ?? "") === "true";
    const { data, error } = await supabase.schema("kut").rpc("admin_set_player_active", {
      p_player_id: playerId,
      p_is_active: makeActive,
    });
    if (error) {
      return {
        ok: false,
        error: error.message.includes("admin access")
          ? "You don't have permission to do this."
          : "Couldn't update the player. Please try again.",
      };
    }
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} ${makeActive ? "reactivated" : "deactivated"}.` };
  }

  if (intent === "delete") {
    const { data, error } = await supabase.schema("kut").rpc("admin_delete_player", { p_player_id: playerId });
    if (error) {
      if (error.message.includes("admin access")) return { ok: false, error: "You don't have permission to do this." };
      if (error.code === "P0001") {
        return {
          ok: false,
          error: "This player has history (attendance, an account, an invite, or owned cards). Deactivate them instead.",
        };
      }
      return { ok: false, error: "Couldn't delete the player. Please try again." };
    }
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} deleted.` };
  }

  return { ok: false, error: "Unknown action." };
}
