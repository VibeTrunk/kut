"use server";

import { redirect } from "next/navigation";
import { hashInviteToken, isValidInviteToken } from "@/lib/invites/token";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/auth/username";
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
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isValidInviteToken(token)) return invalidInvite;
  if (!isValidUsername(username) || password.length < 12) {
    return {
      error:
        "Choose a username of 3–30 characters (letters, numbers, underscore) and a password of at least 12 characters.",
    };
  }

  const supabase = createServiceClient();
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
  });

  if (createUserError || !createdUser.user) {
    return { error: "That username is taken, or the details were not accepted." };
  }

  const { error: claimError } = await supabase.schema("kut").rpc("claim_invitation", {
    p_token_hash: hashInviteToken(token),
    p_user_id: createdUser.user.id,
    p_username: normalizeUsername(username),
  });

  if (claimError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id);
    return invalidInvite;
  }

  redirect("/login?welcome=1");
}
