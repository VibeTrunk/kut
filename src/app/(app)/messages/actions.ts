"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export type MessageActionState = { error: string | null };

export async function markMessagesRead(_state: MessageActionState, formData: FormData): Promise<MessageActionState> {
  await requireUser();
  const markAll = formData.get("all") === "1";
  const ids = formData.getAll("notificationId").map(String);
  if (!markAll && (ids.length !== 1 || !isUuid(ids[0]))) return { error: "This message could not be updated." };

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("mark_notifications_read", { p_notification_ids: markAll ? null : ids });
  if (error) return { error: "This message could not be updated." };
  revalidatePath("/messages", "layout");
  return { error: null };
}
