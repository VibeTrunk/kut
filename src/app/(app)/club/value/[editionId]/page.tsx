import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

type CopyRow = { card_id:string;edition_id:string;edition_title:string;display_name:string;discard_value:number;copy_position:number;weight_percent:number;club_value_contribution:number };
export default async function EditionCopiesPage({params}:{params:Promise<{editionId:string}>}) {
  await requireUser(); const {editionId}=await params; if(!isUuid(editionId)) notFound();
  const supabase=await createClient(); const {data,error}=await supabase.schema("kut").from("my_club_value_copies").select("card_id,edition_id,edition_title,display_name,discard_value,copy_position,weight_percent,club_value_contribution").eq("edition_id",editionId).order("copy_position");
  if(error) throw new Error("Could not load this copy breakdown."); const copies=(data??[]) as CopyRow[]; if(!copies.length) notFound(); const first=copies[0];
  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8"><Link className="text-sm font-bold text-brass hover:underline" href="/club/value">&larr; Club Value</Link><header><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">{first.edition_title}</p><h1 className="display mt-3 text-3xl sm:text-6xl">Your copies</h1><p className="mt-4 text-ink-dim">{copies.length} copies. Each can be discarded for {first.discard_value} KUT Coins.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left"><thead className="border-b border-line text-xs uppercase tracking-wider text-ink-faint"><tr><th className="py-3">Copy</th><th>Weight</th><th className="text-right">Adds to Club Value</th></tr></thead><tbody>{copies.map(copy=><tr className="border-b border-line/50" key={copy.card_id}><td className="py-4"><Link className="font-bold hover:text-brass" href={`/club/collection/${copy.card_id}`}>Copy {copy.copy_position}</Link></td><td>{copy.weight_percent}%</td><td className="text-right font-black tabular-nums">{copy.club_value_contribution}</td></tr>)}</tbody></table></div><p className="text-sm text-ink-dim">Positions are recalculated after every sale, transfer, or discard. No physical copy is permanently privileged.</p></section></main>;
}
