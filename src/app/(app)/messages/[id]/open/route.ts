import type { NextRequest } from "next/server";
import { messageTarget, type UserNotification } from "@/lib/messages";
import { loadTargetLookups, MESSAGE_COLUMNS } from "@/lib/messages-load";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

/**
 * Opening a message (ADR-114): marks it read, then goes to its subject, or
 * back to the inbox when it has none. A route rather than a page, linked with a
 * plain `<a>`, so nothing prefetches it and marks a message read unseen. It
 * only ever marks the caller's own message (RLS and `mark_notifications_read`)
 * and only redirects to a path it built itself.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  // A relative Location: the browser stays on the host it came from, which
  // `request.url` does not always name (next dev reports localhost).
  const to = (path: string) => new Response(null, { status: 303, headers: { Location: path } });
  if (!isUuid(id)) return to("/messages");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") return to("/login");

  const { data, error } = await supabase
    .schema("kut")
    .from("user_notifications")
    .select(MESSAGE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return to("/messages");
  const message = data as UserNotification;

  if (!message.read_at) {
    const { error: readError } = await supabase
      .schema("kut")
      .rpc("mark_notifications_read", { p_notification_ids: [id] });
    if (readError) console.error("message open: mark read failed", readError.code);
  }
  const target = messageTarget(message, await loadTargetLookups(supabase, [message]));
  return to(target?.href ?? "/messages");
}
