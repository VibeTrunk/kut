"use server";

import { revalidatePath } from "next/cache";
import { isArchetype } from "@/game/archetypes";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

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

export async function addPlayer(
  _prev: AddPlayerState,
  formData: FormData,
): Promise<AddPlayerState> {
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

export async function manageRoster(
  _prev: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  await requireAdmin();

  const intent = String(formData.get("intent") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!isUuid(playerId)) return { ok: false, error: "Invalid player." };

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
    return {
      ok: true,
      message: `${row?.display_name ?? "Player"} ${makeActive ? "reactivated" : "deactivated"}.`,
    };
  }

  if (intent === "delete") {
    const { data, error } = await supabase
      .schema("kut")
      .rpc("admin_delete_player", { p_player_id: playerId });
    if (error) {
      if (error.message.includes("admin access"))
        return { ok: false, error: "You don't have permission to do this." };
      if (error.code === "P0001") {
        return {
          ok: false,
          error:
            "This player has history (attendance, an account, an invite, or owned cards). Deactivate them instead.",
        };
      }
      return { ok: false, error: "Couldn't delete the player. Please try again." };
    }
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} deleted.` };
  }

  if (intent === "start_injury") {
    const startedOn = String(formData.get("started_on") ?? "");
    const note = String(formData.get("note") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
      return { ok: false, error: "Pick the date of the injury." };
    }
    if (note.length > 200) return { ok: false, error: "Keep the note to 200 characters." };
    const { data, error } = await supabase.schema("kut").rpc("admin_start_injury", {
      p_player_id: playerId,
      p_started_on: startedOn,
      p_note: note || null,
    });
    if (error) return { ok: false, error: injuryError(error.message) };
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Player"} is now in injury mode.` };
  }

  if (intent === "end_injury") {
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 3 || reason.length > 200) {
      return { ok: false, error: "Give a reason of 3–200 characters." };
    }
    const { data, error } = await supabase.schema("kut").rpc("admin_end_injury", {
      p_player_id: playerId,
      p_reason: reason,
    });
    if (error) return { ok: false, error: injuryError(error.message) };
    revalidateRoster();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `Injury mode ended for ${row?.display_name ?? "the player"}.` };
  }

  return { ok: false, error: "Unknown action." };
}

// kut.admin_start_injury / admin_end_injury raise short, stable messages
// (ADR-082); map the ones an admin can act on, and fall back for the rest.
function injuryError(message: string): string {
  if (message.includes("admin access")) return "You don't have permission to do this.";
  if (message.includes("own player"))
    return "Another admin has to put your own player in injury mode.";
  if (message.includes("no active account"))
    return "Injury mode needs a linked, active account: the player checks in themselves.";
  if (message.includes("played since"))
    return "The player has played a published session after that date. Pick a later date.";
  if (message.includes("already in injury mode")) return "This player is already in injury mode.";
  if (message.includes("not in injury mode")) return "This player isn't in injury mode.";
  if (message.includes("injury date")) return "The injury date can't be in the future.";
  return "Couldn't update injury mode. Please try again.";
}
