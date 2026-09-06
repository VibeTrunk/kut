"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

export async function correctGoals(formData:FormData){
  await requireAdmin(); const sessionId=String(formData.get("sessionId")??""); const playerId=String(formData.get("playerId")??""); const reason=String(formData.get("reason")??"").trim(); const remove=formData.get("remove")==="true"; const goals=remove?null:Number(formData.get("goals"));
  if(!isUuid(sessionId)||!isUuid(playerId)||reason.length<3||reason.length>500||(!remove&&(!Number.isInteger(goals)||goals!<0||goals!>99))) throw new Error("Valid goals and a reason are required.");
  const supabase=await createClient(); const {error}=await supabase.schema("kut").rpc("admin_correct_session_goals",{p_session_id:sessionId,p_player_id:playerId,p_goals:goals,p_remove_override:remove,p_reason:reason});
  if(error) throw new Error("The goal correction could not be saved."); revalidatePath(`/admin/attendance/${sessionId}/reports`); revalidatePath("/chronicle","layout");
}
