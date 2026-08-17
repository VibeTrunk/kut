"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export type PublishAttendanceState = { error: string | null };

const INVALID_REQUEST: PublishAttendanceState = {
  error: "The attendance details were invalid. Please review them and try again.",
};

function readAttendanceForm(formData: FormData) {
  const sessionDate = String(formData.get("sessionDate") ?? "");
  const sessionType = String(formData.get("sessionType") ?? "");
  const rawAttendance = String(formData.get("attendance") ?? "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return null;

  try {
    const attendance: unknown = JSON.parse(rawAttendance);
    if (!Array.isArray(attendance) || attendance.length === 0) return null;
    return { attendance, sessionDate, sessionType };
  } catch {
    return null;
  }
}

export async function publishAttendanceSession(
  _previousState: PublishAttendanceState,
  formData: FormData,
): Promise<PublishAttendanceState> {
  await requireAdmin();

  const input = readAttendanceForm(formData);
  if (!input) return INVALID_REQUEST;

  const supabase = await createClient();
  const { data: activeSeason, error: seasonError } = await supabase
    .schema("kut")
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (seasonError || !activeSeason) {
    return { error: "There is no active season to publish this session into." };
  }

  const { error } = await supabase.schema("kut").rpc("publish_attendance_session", {
    p_attendance: input.attendance,
    p_season_id: activeSeason.id,
    p_session_date: input.sessionDate,
    p_session_type: input.sessionType,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A session of this type already exists on that date." };
    }
    return { error: "Publishing failed. No ratings were changed; please try again." };
  }

  revalidatePath("/");
  redirect("/admin/attendance?published=1");
}

export async function correctPublishedAttendanceSession(
  _previousState: PublishAttendanceState,
  formData: FormData,
): Promise<PublishAttendanceState> {
  await requireAdmin();

  const input = readAttendanceForm(formData);
  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("correctionReason") ?? "").trim();

  if (
    !input ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
    reason.length < 3 ||
    reason.length > 500
  ) {
    return { error: "Add a short correction reason and review the attendance details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("correct_published_attendance_session", {
    p_attendance: input.attendance,
    p_reason: reason,
    p_session_date: input.sessionDate,
    p_session_id: sessionId,
    p_session_type: input.sessionType,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Another session of this type already exists on that date." };
    }
    return { error: "The correction could not be saved. Ratings were not changed; please try again." };
  }

  revalidatePath("/");
  revalidatePath("/admin/attendance");
  redirect("/admin/attendance?corrected=1");
}

export async function cancelPublishedSession(
  _previousState: PublishAttendanceState,
  formData: FormData,
): Promise<PublishAttendanceState> {
  await requireAdmin();

  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("cancellationReason") ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
    reason.length < 3 ||
    reason.length > 500
  ) {
    return { error: "Add a short cancellation reason before cancelling this session." };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("cancel_published_session", {
    p_reason: reason,
    p_session_id: sessionId,
  });

  if (error) {
    return { error: "The session could not be cancelled. Ratings were not changed; please try again." };
  }

  revalidatePath("/");
  revalidatePath("/admin/attendance");
  redirect("/admin/attendance?cancelled=1");
}

export async function reactivateCancelledSession(
  _previousState: PublishAttendanceState,
  formData: FormData,
): Promise<PublishAttendanceState> {
  await requireAdmin();

  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reactivationReason") ?? "").trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
    reason.length < 3 ||
    reason.length > 500
  ) {
    return { error: "Add a short reason before reactivating this session." };
  }

  const supabase = await createClient();
  const { error } = await supabase.schema("kut").rpc("reactivate_cancelled_session", {
    p_reason: reason,
    p_session_id: sessionId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "A current session of this type already occupies that date. Cancel it or choose a different date first." };
    }
    return { error: "The session could not be reactivated. Ratings were not changed; please try again." };
  }

  revalidatePath("/");
  revalidatePath("/admin/attendance");
  redirect("/admin/attendance?reactivated=1");
}
