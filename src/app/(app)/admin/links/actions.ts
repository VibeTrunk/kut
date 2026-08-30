"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { ECONOMY } from "@/game/economy";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LinkActionState = { ok: true; message: string } | { ok: false; error: string } | null;

function revalidateLinks() {
  revalidatePath("/admin/links");
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/roster");
  revalidatePath("/admin/economy"); // coin faucet flows into the supply total
  revalidatePath("/messages"); // adjust / reset write an admin_notice inbox row
  revalidatePath("/"); // Live Ratings / attendance rewards join on the link
  revalidatePath("/players");
  revalidatePath("/leaderboard");
}

function mapRpcError(error: { message: string; code?: string }): string {
  if (error.message.includes("admin access") || error.message.includes("only a superadmin")) {
    return "You don't have permission to do this.";
  }
  if (error.code === "P0002") return "That account or player no longer exists.";
  if (error.code === "22023") {
    if (error.message.includes("per-adjustment limit")) {
      return `That is over the ${ECONOMY.adminWalletAdjustMax.toLocaleString("en-GB")} KUT Coins per-adjustment limit.`;
    }
    if (error.message.includes("non-zero amount")) return "Enter a non-zero amount.";
    if (error.message.includes("reason of 1 to 200")) return "Enter a reason (1–200 characters).";
    return error.message;
  }
  if (error.code === "P0001") {
    if (error.message.includes("already linked")) return "That player is already linked to another account.";
    if (error.message.includes("your own account") || error.message.includes("your own wallet")) {
      return "You can't do that to your own account.";
    }
    if (error.message.includes("below zero")) return "That would drop the member's balance below zero.";
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

  if (intent === "adjust_coins") {
    const raw = String(formData.get("amount") ?? "").trim();
    const amount = Number(raw);
    if (!raw || !Number.isInteger(amount) || amount === 0) {
      return { ok: false, error: "Enter a whole, non-zero amount." };
    }
    if (Math.abs(amount) > ECONOMY.adminWalletAdjustMax) {
      return {
        ok: false,
        error: `Keep it within ${ECONOMY.adminWalletAdjustMax.toLocaleString("en-GB")} KUT Coins per adjustment.`,
      };
    }
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 1 || reason.length > 200) {
      return { ok: false, error: "Give a reason of 1–200 characters." };
    }
    const { data, error } = await supabase.schema("kut").rpc("admin_adjust_wallet", {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) return { ok: false, error: mapRpcError(error) };
    revalidateLinks();
    const row = data as { display_name?: string; amount?: number; balance?: number } | null;
    const signed = (row?.amount ?? amount) > 0 ? `+${row?.amount ?? amount}` : String(row?.amount ?? amount);
    return {
      ok: true,
      message: `${row?.display_name ?? "Account"} wallet adjusted ${signed} KUT Coins (new balance ${row?.balance ?? "?"}).`,
    };
  }

  if (intent === "reset_account") {
    const idempotencyKey = String(formData.get("idempotency_key") ?? "");
    if (!UUID_RE.test(idempotencyKey)) return { ok: false, error: "Could not start the reset. Reload and try again." };
    const { data, error } = await supabase.schema("kut").rpc("admin_reset_account", {
      p_user_id: userId,
      p_idempotency_key: idempotencyKey,
    });
    if (error) return { ok: false, error: mapRpcError(error) };
    revalidateLinks();
    const row = data as { display_name?: string; already_processed?: boolean; cards_burned?: number } | null;
    if (row?.already_processed) {
      return { ok: true, message: `${row?.display_name ?? "Account"} was already reset with this request.` };
    }
    return {
      ok: true,
      message: `${row?.display_name ?? "Account"} reset: ${row?.cards_burned ?? 0} cards burned, fresh 250-coin starter granted.`,
    };
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
