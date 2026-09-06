import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { weekStart } from "@/game/football-week";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export default async function SessionRedirect({ params }: { params: Promise<{ sessionId: string }> }) {
  await requireUser(); const { sessionId } = await params; if (!isUuid(sessionId)) notFound();
  const supabase = await createClient();
  const { data: report, error: reportError } = await supabase.schema("kut").from("my_session_reports").select("session_id").eq("session_id", sessionId).maybeSingle();
  if (reportError) throw new Error("Could not locate your session report.");
  if (report) redirect(`/sessions/${sessionId}/report`);
  const { data, error } = await supabase.schema("kut").from("match_sessions").select("session_date").eq("id", sessionId).eq("status", "published").maybeSingle();
  if (error) throw new Error("Could not locate this session."); if (!data) notFound();
  redirect(`/chronicle/${weekStart(data.session_date)}#s-${sessionId}`);
}
