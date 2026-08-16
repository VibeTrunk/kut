import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

type PackHealth = {
  slug: string; title: string; price: number; cards_per_pack: number; eligible_live_count: number;
  expected_discard_per_slot: number; expected_discard_per_pack: number; expected_discard_return_ratio: number;
  total_coin_supply: number; total_pack_openings: number; total_card_copies: number; total_burned_cards: number;
};

function healthStatus(ratio: number) {
  if (ratio >= 0.95) return { label: "Critical", className: "border-rose-400/50 bg-rose-950/50 text-rose-100" };
  if (ratio > 0.8) return { label: "Warning", className: "border-orange-400/50 bg-orange-950/50 text-orange-100" };
  if (ratio > 0.75) return { label: "Watch", className: "border-amber-400/50 bg-amber-950/50 text-amber-100" };
  return { label: "Target", className: "border-emerald-400/50 bg-emerald-950/50 text-emerald-100" };
}

export default async function EconomyPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.schema("kut").from("pack_economy_health")
    .select("slug, title, price, cards_per_pack, eligible_live_count, expected_discard_per_slot, expected_discard_per_pack, expected_discard_return_ratio, total_coin_supply, total_pack_openings, total_card_copies, total_burned_cards")
    .order("price");

  if (error) throw new Error("Could not load pack economy health.");
  const packs = (data ?? []) as PackHealth[];
  const totals = packs[0];

  return (
    <main className="min-h-screen bg-slate-950 p-5 text-slate-50 sm:p-10">
      <section className="mx-auto max-w-5xl space-y-8">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
          <Link className="text-amber-400 hover:text-amber-300" href="/admin/attendance">← Admin attendance</Link>
          <Link className="text-slate-400 hover:text-slate-200" href="/">Live ratings</Link>
        </nav>
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-400">Admin · economy</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Pack health</h1>
          <p className="mt-3 max-w-2xl text-slate-300">Expected values use the active Live Card pool and server-defined rarity weights. They are a warning system, not a setting screen.</p>
        </header>
        {totals && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><dt className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Coin supply</dt><dd className="mt-2 text-2xl font-black">{Number(totals.total_coin_supply)}</dd></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><dt className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Packs opened</dt><dd className="mt-2 text-2xl font-black">{Number(totals.total_pack_openings)}</dd></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><dt className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Card copies</dt><dd className="mt-2 text-2xl font-black">{Number(totals.total_card_copies)}</dd></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><dt className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Burned</dt><dd className="mt-2 text-2xl font-black">{Number(totals.total_burned_cards)}</dd></div>
        </dl>}
        {packs.length === 0 ? <p className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-300">No active packs are configured.</p> : <div className="grid gap-5 md:grid-cols-2">
          {packs.map((pack) => {
            const ratio = Number(pack.expected_discard_return_ratio);
            const status = healthStatus(ratio);
            return <article className="rounded-3xl border border-slate-700 bg-slate-900 p-6" key={pack.slug}>
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">{pack.cards_per_pack} cards · {pack.price} TF Coins</p><h2 className="mt-1 text-2xl font-black">{pack.title}</h2></div><span className={`rounded-full border px-3 py-1 text-sm font-black ${status.className}`}>{status.label}</span></div>
              <dl className="mt-6 grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-slate-950/60 p-3"><dt className="text-xs font-bold uppercase text-slate-400">Per slot</dt><dd className="mt-1 text-xl font-black">{Number(pack.expected_discard_per_slot).toFixed(2)}</dd></div><div className="rounded-xl bg-slate-950/60 p-3"><dt className="text-xs font-bold uppercase text-slate-400">Per pack</dt><dd className="mt-1 text-xl font-black">{Number(pack.expected_discard_per_pack).toFixed(2)}</dd></div><div className="rounded-xl bg-slate-950/60 p-3"><dt className="text-xs font-bold uppercase text-slate-400">Return</dt><dd className="mt-1 text-xl font-black">{(ratio * 100).toFixed(1)}%</dd></div></dl>
              <p className="mt-4 text-sm text-slate-400">{pack.eligible_live_count} eligible Live editions. Target expected discard return is 75% or lower; warning begins above 80%.</p>
            </article>;
          })}
        </div>}
      </section>
    </main>
  );
}
