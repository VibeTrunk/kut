"use client";

import { useActionState, useRef, useState } from "react";
import { saveSessionReport, type ReportState } from "./actions";

type Category = { id: string; title: string; description: string };
type Attendee = { player_id: string; players: { display_name: string } | { display_name: string }[] | null };
const initial: ReportState = { error: null };

export function ReportForm({ sessionId, playerId, categories, attendees, goals: initialGoals, revision, rewardReceived, savedNominations }: { sessionId: string; playerId: string; categories: Category[]; attendees: Attendee[]; goals: number | null; revision: number; rewardReceived: boolean; savedNominations: Record<string,string> }) {
  const [goals, setGoals] = useState(initialGoals === null ? "" : String(initialGoals));
  const requestKey = useRef<string | null>(null);
  const [state, action, pending] = useActionState(saveSessionReport, initial);
  const effectiveRevision = state.revision ?? revision;
  function submit(formData: FormData) { requestKey.current = crypto.randomUUID(); formData.set("idempotencyKey",requestKey.current); return action(formData); }
  const highGoals = /^\d+$/.test(goals) && Number(goals)>=10;
  return <form action={submit} className="space-y-7"><input name="sessionId" type="hidden" value={sessionId}/><input name="revision" type="hidden" value={effectiveRevision}/><input name="categoryIds" type="hidden" value={categories.map(c=>c.id).join(",")}/>
    {state.saved && <p className="rounded-xl border border-moss-line bg-moss-bg p-4 font-bold text-moss" role="status">{state.rewarded ? "Report submitted → +50 KUT Coins received." : "Your report is saved. Reward already received."}</p>}
    {state.error && <div className="rounded-xl border border-brick-line bg-brick-bg p-4 font-bold text-brick" role="alert">{state.error}</div>}
    <fieldset className="space-y-3"><legend className="display text-3xl">How many goals did you score?</legend><div className="flex flex-wrap gap-2">{[0,1,2,3,4,5].map(value=><button className={`min-h-11 min-w-11 rounded-xl border font-black ${goals===String(value)?"border-brass bg-brass text-ink-on-accent":"border-line bg-panel"}`} key={value} onClick={()=>setGoals(String(value))} type="button">{value}</button>)}</div><label className="block max-w-48 text-sm font-bold">6 or more<input className="mt-2 min-h-12 w-full rounded-xl border border-line bg-panel px-4 text-base" max="99" min="0" name="goals" onChange={e=>setGoals(e.target.value)} type="number" value={goals}/></label>{highGoals&&<label className="flex min-h-11 items-center gap-3 text-sm font-bold"><input name="confirmGoals" type="checkbox" value="yes"/>Confirm {goals} goals</label>}</fieldset>
    <fieldset className="space-y-4"><legend className="display text-3xl">Give kudos</legend><p className="text-sm text-ink-dim">Choose a different teammate in each category, or explicitly Skip.</p>{categories.map(category=><label className="block rounded-2xl border border-line bg-panel/60 p-4" key={category.id}><span className="font-black">{category.title}</span><span className="mt-1 block text-xs text-ink-faint">{category.description}</span><select className="mt-3 min-h-12 w-full rounded-xl border border-line bg-board px-3 text-base" defaultValue={savedNominations[category.id]??""} name={`category-${category.id}`}><option value="">Skip</option>{attendees.filter(a=>a.player_id!==playerId).map(a=>{const p=Array.isArray(a.players)?a.players[0]:a.players;return <option key={a.player_id} value={a.player_id}>{p?.display_name??"Teammate"}</option>})}</select></label>)}</fieldset>
    <p className="text-sm text-ink-dim">Enter your goals and choose or skip each category. A complete first submission earns 50 KUT Coins; edits never pay twice.</p><div className="grid gap-3 sm:grid-cols-2"><button className="min-h-13 rounded-xl border border-line bg-panel font-black" disabled={pending} name="intent" value="draft">Save draft</button><button className="min-h-13 rounded-xl bg-brass font-black text-ink-on-accent" disabled={pending} name="intent" value="submit">{pending?"Saving…":rewardReceived?"Save changes":"Submit report → earn 50 coins"}</button></div>
  </form>;
}
