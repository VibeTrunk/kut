"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export type ReportState = { error: string | null; saved?: boolean; rewarded?: boolean; revision?: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveSessionReport(_previous: ReportState, formData: FormData): Promise<ReportState> {
  await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const intent = formData.get("intent") === "draft" ? "draft" : "submit";
  const revision = Number(formData.get("revision"));
  const rawGoals = String(formData.get("goals") ?? "").trim();
  const goals = rawGoals === "" ? null : Number(rawGoals);
  if (!uuid.test(sessionId) || !uuid.test(idempotencyKey) || !Number.isInteger(revision) || revision < 0 || (goals !== null && (!Number.isInteger(goals) || goals < 0 || goals > 99))) return { error: "Check the report fields and try again." };
  if (intent === "submit" && goals !== null && goals >= 10 && formData.get("confirmGoals") !== "yes") return { error: `Confirm ${goals} goals before submitting.` };
  const nominations: Record<string, string | null> = {};
  for (const categoryId of String(formData.get("categoryIds") ?? "").split(",")) {
    if (!uuid.test(categoryId)) return { error: "The report categories changed. Refresh and try again." };
    const value = String(formData.get(`category-${categoryId}`) ?? "");
    nominations[categoryId] = value && uuid.test(value) ? value : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").rpc("submit_session_report", { p_session_id: sessionId, p_goals: goals, p_nominations: nominations, p_expected_revision: revision, p_idempotency_key: idempotencyKey, p_intent: intent });
  if (error) return { error: error.message.includes("closed") ? "Reports are closed for this session." : "Could not save the report. Check every category and try again." };
  if (data && typeof data === "object" && "conflict" in data && data.conflict) return { error: "This report changed elsewhere. Refresh to load the saved version." };
  revalidatePath(`/sessions/${sessionId}/report`);
  revalidatePath("/");
  return { error: null, saved: true, rewarded: Boolean(data && typeof data === "object" && "rewarded" in data && data.rewarded), revision: data && typeof data === "object" && "revision" in data ? Number(data.revision) : revision + 1 };
}
