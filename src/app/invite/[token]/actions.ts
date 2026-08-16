"use server";

import { redirect } from "next/navigation";
import { hashInviteToken, isValidInviteToken } from "@/lib/invites/token";
import { createServiceClient } from "@/lib/supabase/service";

export type ClaimInviteState = { error: string | null };

const invalidInvite: ClaimInviteState = {
  error: "This invitation is invalid, expired, or has already been used.",
};

export async function claimInvite(
  _previousState: ClaimInviteState,
  formData: FormData,
): Promise<ClaimInviteState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isValidInviteToken(token)) return invalidInvite;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    return { error: "Enter a valid email address and a password of at least 12 characters." };
  }

  const supabase = createServiceClient();
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createUserError || !createdUser.user) {
    return { error: "Unable to create an account with those details." };
  }

  const { error: claimError } = await supabase.schema("kut").rpc("claim_invitation", {
    p_token_hash: hashInviteToken(token),
    p_user_id: createdUser.user.id,
  });

  if (claimError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return invalidInvite;
  }

  redirect("/login?welcome=1");
}
