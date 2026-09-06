import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { VIEW_TABS } from "@/components/album/collection-header";
import { SectionTabs } from "@/components/app-shell/section-tabs";
import { setCardWant, setTradeAvailability } from "../discovery-actions";
import { CopyMessageButton } from "./copy-message-button";

type Wanted = { edition_id: string; state: string; edition_title: string; is_live: boolean; display_name: string; owned_count: number; lowest_listing_price: number | null };
type Availability = { edition_id: string; owner_display_name: string };
type Edition = { id: string; title: string; players: { display_name: string } | { display_name: string }[] | null };
type TradeCard = { card_id: string; edition_id: string; edition_title: string; display_name: string; is_available: boolean; availability_state: string; acquired_at: string };

export default async function WantedPage() {
  await requireUser();
  const supabase = await createClient();
  const [wantedResponse, availabilityResponse, editionsResponse, tradeResponse] = await Promise.all([
    supabase.schema("kut").from("my_wanted_cards").select("edition_id, state, edition_title, is_live, display_name, owned_count, lowest_listing_price").order("created_at"),
    supabase.schema("kut").rpc("get_my_wanted_availability"),
    supabase.schema("kut").from("card_editions").select("id, title, players(display_name)").eq("is_live", true).order("title"),
    supabase.schema("kut").from("my_trade_cards").select("card_id, edition_id, edition_title, display_name, is_available, availability_state, acquired_at").order("display_name").order("acquired_at"),
  ]);
  if (wantedResponse.error || availabilityResponse.error || editionsResponse.error || tradeResponse.error) throw new Error("Could not load trading preferences.");

  const wanted = (wantedResponse.data ?? []) as Wanted[];
  const active = wanted.filter((row) => row.state === "active");
  const availability = (availabilityResponse.data ?? []) as Availability[];
  const activeIds = new Set(active.map((row) => row.edition_id));
  const tradeCards = (tradeResponse.data ?? []) as TradeCard[];
  const editionTotals = new Map<string, number>();
  for (const card of tradeCards) editionTotals.set(card.edition_id, (editionTotals.get(card.edition_id) ?? 0) + 1);
  const editionSeen = new Map<string, number>();

  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-4xl space-y-8 py-4 sm:py-8">
    <header className="space-y-4"><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">My club</p><h1 className="display text-4xl sm:text-6xl">Trading preferences</h1><p className="max-w-2xl text-sm leading-relaxed text-ink-dim">Choose the cards you want and the owned copies you are open to trading. Wanted cards stay private; another member sees your name only when you make a matching copy available.</p><SectionTabs activeKey="trading" label="Collection view" tabs={VIEW_TABS} /></header>

    <div className="grid gap-4 md:grid-cols-2">
      <details className="group rounded-2xl border border-line bg-panel/60 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-brass"><span><span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-45">+</span>Select wanted cards</span><span className="text-xs text-ink-faint">{active.length} / 100</span></summary>
        <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">{(editionsResponse.data as Edition[]).map((edition) => { const player = Array.isArray(edition.players) ? edition.players[0] : edition.players; const selected = activeIds.has(edition.id); return <form action={setCardWant} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line/50 bg-board/60 p-3" key={edition.id}><input name="editionId" type="hidden" value={edition.id}/><input name="wanted" type="hidden" value={selected ? "false" : "true"}/><span className="min-w-0"><span className="block truncate font-bold">{player?.display_name ?? edition.title}</span><span className="text-xs text-ink-faint">{edition.title}</span></span><button aria-pressed={selected} className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-black ${selected ? "border border-brick/50 text-brick" : "bg-brass text-ink-on-accent"}`}>{selected ? "Remove" : "Want"}</button></form>; })}</div>
      </details>

      <details className="group rounded-2xl border border-line bg-panel/60 p-5" id="available">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-brass"><span><span aria-hidden="true" className="mr-2 inline-block transition-transform group-open:rotate-45">+</span>Select available copies</span><span className="text-xs text-ink-faint">{tradeCards.filter((card) => card.is_available).length} / 30</span></summary>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">Listed cards and cards held in an offer cannot also be marked available.</p>
        <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto pr-1">{tradeCards.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-dim">Your owned cards will appear here.</p> : tradeCards.map((card) => { const copy = (editionSeen.get(card.edition_id) ?? 0) + 1; editionSeen.set(card.edition_id, copy); const total = editionTotals.get(card.edition_id) ?? 1; const eligible = card.availability_state === "eligible"; const state = card.is_available ? "Available" : eligible ? "Private" : card.availability_state === "listed" ? "Listed in Market" : "Held in an offer"; return <form action={setTradeAvailability} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line/50 bg-board/60 p-3" key={card.card_id}><input name="cardId" type="hidden" value={card.card_id}/><input name="available" type="hidden" value={card.is_available ? "false" : "true"}/><span className="min-w-0"><span className="block truncate font-bold">{card.display_name}{total > 1 ? ` · Copy ${copy}` : ""}</span><span className="text-xs text-ink-faint">{card.edition_title} · {state}</span></span><button aria-pressed={card.is_available} className={`min-h-11 shrink-0 rounded-lg px-3 text-sm font-black ${card.is_available ? "border border-brick/50 text-brick" : "bg-brass text-ink-on-accent disabled:bg-line disabled:text-ink-faint"}`} disabled={!eligible && !card.is_available}>{card.is_available ? "Make private" : "Make available"}</button></form>; })}</div>
      </details>
    </div>

    <section className="space-y-5"><div><h2 className="display text-3xl">Your wanted cards</h2><p className="mt-2 text-sm text-ink-dim">Market listings and members with matching available copies appear here.</p></div>{active.length === 0 ? <div className="rounded-3xl border border-dashed border-line bg-panel/50 p-8 text-center"><h3 className="display text-3xl">Nothing wanted yet</h3><p className="mt-2 text-sm text-ink-dim">Use Select wanted cards above to start your private list.</p></div> : <div className="space-y-5">{active.map((want) => { const owners = availability.filter((row) => row.edition_id === want.edition_id); return <article className="rounded-2xl border border-line bg-panel/60 p-5" key={want.edition_id}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-brass">{want.edition_title}</p><h3 className="display mt-1 text-3xl">{want.display_name}</h3><p className="mt-2 text-xs text-ink-faint">{want.owned_count ? `You own ${want.owned_count}.` : "Not in your collection."} {want.lowest_listing_price ? <Link className="font-bold text-brass hover:underline" href={`/market?q=${encodeURIComponent(want.display_name)}`}>Listed from {want.lowest_listing_price} coins.</Link> : "No public listing."}</p></div><form action={setCardWant}><input name="editionId" type="hidden" value={want.edition_id}/><input name="wanted" type="hidden" value="false"/><button className="min-h-11 text-sm font-black text-brick">Remove</button></form></div><div className="mt-5 border-t border-line/50 pt-4">{owners.length === 0 ? <p className="text-sm text-ink-dim">Nobody has marked a copy available yet.</p> : <ul className="space-y-4">{owners.map((owner) => <li className="flex flex-wrap items-center justify-between gap-3" key={owner.owner_display_name}><p className="text-sm"><strong>{owner.owner_display_name}</strong> is open to trading this card.</p><CopyMessageButton card={`${want.is_live ? "Live " : ""}${want.display_name}`} owner={owner.owner_display_name}/></li>)}</ul>}</div></article>; })}</div>}</section>

    <section className="rounded-2xl border border-brass/25 bg-brass-bg/20 p-5"><h2 className="display text-2xl">How to complete a trade</h2><p className="mt-3 text-sm leading-relaxed text-ink-dim">Contact each other and agree the terms together. The owner can then list the card in Market and you can use the existing Offer action for cards and/or coins. Listings are public and are never reserved, so complete an agreed trade promptly.</p></section>
  </section></main>;
}
