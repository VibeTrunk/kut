import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { formatChronicleDate, issueStandfirst } from "@/lib/chronicle";
import { createClient } from "@/lib/supabase/server";

type Week = { week_start: string; week_end: string; session_count: number; appearance_count: number; goal_count: number };

export const metadata = { title: "KUT Chronicle" };

export default async function ChronicleIndexPage() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").from("chronicle_weeks").select("week_start, week_end, session_count, appearance_count, goal_count").order("week_start", { ascending: false });
  if (error) throw new Error("Could not load the Chronicle.");
  const weeks = (data ?? []) as Week[];
  if (weeks.length === 0) return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl py-8"><h1 className="display text-5xl">KUT Chronicle</h1><p className="mt-8 text-ink-dim">The first issue arrives when a session is published.</p></section></main>;
  const [latest, ...earlier] = weeks;
  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl space-y-12 py-4 sm:py-8"><header className="border-y-4 border-brass py-5"><div className="flex items-end justify-between gap-4"><h1 className="display text-5xl sm:text-6xl">KUT Chronicle</h1><p className="text-right text-2xl font-black tabular-nums text-brass">{weeks.length}<span className="block text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint">issues</span></p></div><p className="mt-4 text-[0.65rem] font-extrabold uppercase tracking-[0.2em] text-ink-faint">One issue per football week · Terrible Football Haarlem</p></header><article className="overflow-hidden rounded-3xl border border-brass-line bg-panel/70"><div className="space-y-4 p-8"><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-brass">Latest issue</p><h2 className="display text-4xl">Week of {formatChronicleDate(latest.week_start)}</h2><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-ink-faint">{formatChronicleDate(latest.week_start)} – {formatChronicleDate(latest.week_end, { day: "numeric", month: "long", year: "numeric" })}</p><p className="display text-2xl text-ink-dim">{issueStandfirst(latest.session_count, latest.appearance_count, latest.goal_count)}</p></div><Link className="flex min-h-13 items-center justify-center bg-gradient-to-b from-[#eebd63] to-[#d29a34] px-6 font-black text-ink-on-accent" href={`/chronicle/${latest.week_start}`}>Read the issue →</Link></article><section><h2 className="display mb-4 text-3xl">Earlier issues</h2><ol>{earlier.map((week, index) => <li className="border-b border-line/40" key={week.week_start}><Link className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-4 py-4 hover:text-brass" href={`/chronicle/${week.week_start}`}><span className="display text-2xl text-ink-faint">{String(weeks.length - index - 1).padStart(2, "0")}</span><span><span className="block font-black">Week of {formatChronicleDate(week.week_start)}</span><span className="block text-xs font-bold text-ink-faint">{week.session_count} sessions · {week.appearance_count} in · {week.goal_count} goals</span></span><span>›</span></Link></li>)}</ol></section></section></main>;
}
