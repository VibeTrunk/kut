"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type MessageActionState = { error: string | null };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markMessagesRead(_state: MessageActionState, formData: FormData): Promise<MessageActionState> {
  await requireUser();
  const markAll = formData.get("all") === "1";
  const ids = formData.getAll("notificationId").map(String);
  if (!markAll && (ids.length !== 1 || !uuidPattern.test(ids[0]))) return { error: "This message could not be updated." };

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("mark_notifications_read", { p_notification_ids: markAll ? null : ids });
  if (error) return { error: "This message could not be updated." };
  revalidatePath("/messages", "layout");
  return { error: null };
}
