"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type PasswordResetState = { error: string | null; success: string | null };

const invalidRequest: PasswordResetState = {
  error: "Choose a valid member, password, and reset reason.",
  success: null,
};

export async function resetMemberPassword(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  await requireAdmin();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const password = String(formData.get("password") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (
    !isUuid(targetUserId) ||
    password.length < 12 ||
    password.length > 72 ||
    reason.length < 3 ||
    reason.length > 500
  ) {
    return invalidRequest;
  }

  const supabase = await createClient();
  const { data: eventId, error: auditError } = await supabase
    .schema("kut")
    .rpc("create_password_reset_event", {
      p_reason: reason,
      p_target_user_id: targetUserId,
    });

  if (auditError || !eventId) {
    return { error: "This reset is not allowed for that account.", success: null };
  }

  const service = createServiceClient();
  const { error: updateError } = await service.auth.admin.updateUserById(targetUserId, { password });

  const { error: completionError } = await supabase
    .schema("kut")
    .rpc("complete_password_reset_event", {
      p_event_id: eventId,
      p_succeeded: !updateError,
    });

  if (updateError) {
    return { error: "The password was not changed. The failed attempt was recorded.", success: null };
  }

  if (completionError) {
    return { error: "Password changed, but its audit record needs review before another reset.", success: null };
  }

  return {
    error: null,
    success: `Password reset for the selected member. Share the temporary password through a secure channel.`,
  };
}
