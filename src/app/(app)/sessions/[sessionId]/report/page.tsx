import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { finalizeDueSurveys } from "@/lib/session-reports/finalize-due-surveys";
import { createClient } from "@/lib/supabase/server";
import { ReportForm } from "./report-form";

type Props = { params: Promise<{ sessionId: string }> };
type Context = { session_id:string; session_date:string; session_type:string; survey_status:string; closes_at:string; category_ids:string[]; reward_amount:number; player_id:string; goals:number|null; report_status:string|null; revision:number; reward_received:boolean };

export default async function SessionReportPage({params}:Props){
  await requireUser(); const {sessionId}=await params;
  // Opening a just-closed report is a natural trigger to finalize it.
  await finalizeDueSurveys();
  const supabase=await createClient();
  const {data:context,error}=await supabase.schema("kut").from("my_session_reports").select("*").eq("session_id",sessionId).maybeSingle();
  if(error) throw new Error("Could not load this session report."); if(!context) notFound(); const report=context as Context;
  const [categoriesResponse,attendanceResponse,kudosResponse]=await Promise.all([
    supabase.schema("kut").from("kudos_categories").select("id,title,description").in("id",report.category_ids),
    supabase.schema("kut").from("attendance").select("player_id, players(display_name)").eq("session_id",sessionId),
    supabase.schema("kut").from("session_kudos").select("category_id,recipient_player_id").eq("session_id",sessionId).eq("nominator_player_id",report.player_id),
  ]);
  if(categoriesResponse.error||attendanceResponse.error||kudosResponse.error) throw new Error("Could not load report choices.");
  const order=new Map(report.category_ids.map((value,index)=>[value,index])); const categories=(categoriesResponse.data??[]).sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
  const nominations=Object.fromEntries((kudosResponse.data??[]).map(row=>[row.category_id,row.recipient_player_id])); const closed=report.survey_status!=="open"||new Date(report.closes_at)<=new Date();
  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-2xl space-y-8 py-4 sm:py-8"><Link className="text-sm font-black text-brass" href="/">← Home</Link><header><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">{report.session_type} · {report.session_date}</p><h1 className="display mt-3 text-4xl sm:text-6xl">Goals & kudos</h1><p className="mt-3 text-sm text-ink-dim">Reports close {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Amsterdam"}).format(new Date(report.closes_at))}.</p></header>{closed?<section className="rounded-3xl border border-line bg-panel/60 p-8 text-center"><h2 className="display text-3xl">Reports closed</h2><p className="mt-3 text-ink-dim">{report.survey_status==="finalized"?"Results are ready in the Chronicle.":"Results are being prepared."}</p>{report.survey_status==="finalized"&&<Link className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-brass px-5 font-black text-ink-on-accent" href={`/chronicle`}>Open Chronicle</Link>}</section>:<ReportForm attendees={attendanceResponse.data??[]} categories={categories} goals={report.goals} playerId={report.player_id} revision={report.revision} rewardReceived={report.reward_received} savedNominations={nominations} sessionId={sessionId}/>}</section></main>;
}
