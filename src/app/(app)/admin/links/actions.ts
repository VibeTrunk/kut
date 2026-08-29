"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LinkActionState = { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateLinks() {
  revalidatePath("/admin/links");
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/roster");
  revalidatePath("/"); // Live Ratings / attendance rewards join on the link
  revalidatePath("/players");
  revalidatePath("/leaderboard");
}

function mapRpcError(error: { message: string; code?: string }): string {
  if (error.message.includes("admin access") || error.message.includes("only a superadmin")) {
    return "You don't have permission to do this.";
  }
  if (error.code === "P0002") return "That account or player no longer exists.";
  if (error.code === "P0001") {
    if (error.message.includes("already linked")) return "That player is already linked to another account.";
    if (error.message.includes("your own account")) return "You can't do that to your own account.";
    if (error.message.includes("superadmin")) return "Superadmin accounts can't be changed here.";
    if (error.message.includes("completed market trades")) {
      return "This account has completed market trades — disable it instead of deleting.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export async function manageAccount(_prev: LinkActionState, formData: FormData): Promise<LinkActionState> {
  await requireAdmin();

  const intent = String(formData.get("intent") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!UUID_RE.test(userId)) return { ok: false, error: "Invalid account." };

  const supabase = await createClient();

  if (intent === "link" || intent === "unlink") {
    let playerId: string | null = null;
    if (intent === "link") {
      playerId = String(formData.get("player_id") ?? "");
      if (!UUID_RE.test(playerId)) return { ok: false, error: "Pick a player to link." };
    }
    const { data, error } = await supabase.schema("kut").rpc("admin_set_profile_player", {
      p_user_id: userId,
      p_player_id: playerId,
    });
    if (error) return { ok: false, error: mapRpcError(error) };
    revalidateLinks();
    const row = data as { player_name?: string | null } | null;
    return {
      ok: true,
      message:
        intent === "link"
          ? `Linked to ${row?.player_name ?? "the player"}. No coins were granted for past sessions.`
          : "Account unlinked.",
    };
  }

  if (intent === "disable" || intent === "enable") {
    const { data, error } = await supabase.schema("kut").rpc("admin_set_account_disabled", {
      p_user_id: userId,
      p_disabled: intent === "disable",
    });
    if (error) return { ok: false, error: mapRpcError(error) };
    revalidateLinks();
    const row = data as { display_name?: string } | null;
    return { ok: true, message: `${row?.display_name ?? "Account"} ${intent === "disable" ? "disabled" : "enabled"}.` };
  }

  if (intent === "delete") {
    const { data, error } = await supabase.schema("kut").rpc("admin_prepare_account_deletion", { p_user_id: userId });
    if (error) return { ok: false, error: mapRpcError(error) };
    const row = data as { display_name?: string } | null;

    const service = createServiceClient();
    const { error: deleteError } = await service.auth.admin.deleteUser(userId);
    if (deleteError) {
      // Cleanup already ran; neutralise the account so it can't be used.
      await supabase.schema("kut").rpc("admin_set_account_disabled", { p_user_id: userId, p_disabled: true });
      return { ok: false, error: "Account data was cleared but the sign-in record could not be removed. It has been disabled instead." };
    }
    revalidateLinks();
    return { ok: true, message: `${row?.display_name ?? "Account"} permanently deleted.` };
  }

  return { ok: false, error: "Unknown action." };
}
