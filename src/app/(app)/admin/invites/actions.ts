"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createInviteToken } from "@/lib/invites/token";
import { createClient } from "@/lib/supabase/server";

export type CreateInviteState = {
  error: string | null;
  inviteUrl: string | null;
  playerName: string | null;
};

const initialError: CreateInviteState = {
  error: "Could not create an invitation. Please try again.",
  inviteUrl: null,
  playerName: null,
};

export async function createInvite(
  _previousState: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const admin = await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(playerId)) {
    return initialError;
  }

  const supabase = await createClient();
  const { data: player, error: playerError } = await supabase
    .schema("kut")
    .from("players")
    .select("id, display_name")
    .eq("id", playerId)
    .eq("is_active", true)
    .maybeSingle();

  if (playerError || !player) return initialError;

  const { data: linkedProfile, error: profileError } = await supabase
    .schema("kut")
    .from("profiles")
    .select("id")
    .eq("player_id", playerId)
    .maybeSingle();

  if (profileError || linkedProfile) {
    return {
      error: "This player already has a linked KUT account.",
      inviteUrl: null,
      playerName: null,
    };
  }

  const { token, tokenHash } = createInviteToken();
  const { error: inviteError } = await supabase.schema("kut").from("invitations").insert({
    player_id: player.id,
    token_hash: tokenHash,
    created_by: admin.id,
  });

  if (inviteError) return initialError;

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return initialError;
  }

  revalidatePath("/admin/invites");
  return {
    error: null,
    inviteUrl: `${appUrl}/invite/${token}`,
    playerName: player.display_name,
  };
}
