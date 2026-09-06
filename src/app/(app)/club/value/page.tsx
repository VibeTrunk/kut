import Link from "next/link";
import { ECONOMY } from "@/game/economy";
import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Club Value" };
const nf = new Intl.NumberFormat("en-US");
type ClubValueRow = { wallet_balance:number;card_count:number;unique_player_count:number;owned_cards_value:number;personal_card_weight:number;personal_card_player_name:string|null;personal_card_player_slug:string|null;personal_card_ovr:number;personal_card_base_value:number;personal_card_bonus:number;club_value:number };
type EditionRow = { edition_id:string;edition_title:string;discard_value:number;copy_count:number;club_value_contribution:number };

export default async function ClubValuePage() {
  await requireUser();
  const supabase = await createClient();
  const [valueResponse, editionsResponse] = await Promise.all([
    supabase.schema("kut").from("my_club_value").select("wallet_balance,card_count,unique_player_count,owned_cards_value,personal_card_weight,personal_card_player_name,personal_card_player_slug,personal_card_ovr,personal_card_base_value,personal_card_bonus,club_value").maybeSingle(),
    supabase.schema("kut").from("my_club_value_editions").select("edition_id,edition_title,discard_value,copy_count,club_value_contribution").order("club_value_contribution",{ascending:false}),
  ]);
  if (valueResponse.error || editionsResponse.error) throw new Error("Could not load your Club Value breakdown.");
  const value = (valueResponse.data as ClubValueRow|null) ?? { wallet_balance:0,card_count:0,unique_player_count:0,owned_cards_value:0,personal_card_weight:4,personal_card_player_name:null,personal_card_player_slug:null,personal_card_ovr:0,personal_card_base_value:0,personal_card_bonus:0,club_value:0 };
  const editions = (editionsResponse.data ?? []) as EditionRow[];
  return <main className="board-ground min-h-screen p-5 text-ink sm:p-10"><section className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8">
    <Link className="text-sm font-bold text-brass hover:underline" href="/club/collection">&larr; Collection</Link>
    <header><p className="text-[0.7rem] font-extrabold uppercase tracking-[0.26em] text-brass">Your collection</p><h1 className="display mt-3 text-3xl sm:text-6xl">Club Value</h1></header>
    <section><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-faint">Your Club Value</p><p className="mt-2 text-5xl font-black tabular-nums text-brass">{nf.format(value.club_value)}</p>
      <dl className="mt-7 grid grid-cols-3 gap-4"><div><dt className="text-[0.6rem] font-black uppercase tracking-wider text-ink-faint">Wallet</dt><dd className="mt-2 text-2xl font-black">{nf.format(value.wallet_balance)}</dd></div><div><dt className="text-[0.6rem] font-black uppercase tracking-wider text-ink-faint">Collection</dt><dd className="mt-2 text-2xl font-black">{nf.format(value.owned_cards_value)}</dd></div><div><dt className="text-[0.6rem] font-black uppercase tracking-wider text-ink-faint">Personal card</dt><dd className="mt-2 text-2xl font-black">{nf.format(value.personal_card_bonus)}</dd></div></dl>
      <p className="mt-7 text-sm text-ink-dim">{nf.format(value.wallet_balance)} + {nf.format(value.owned_cards_value)} + {nf.format(value.personal_card_bonus)} = {nf.format(value.club_value)} &middot; {value.card_count} cards, {value.unique_player_count} different players</p>
    </section>
    <section><p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-ink-faint">How copies count</p><div className="mt-4 grid grid-cols-4 gap-2">{[["1st",100],["2nd",20],["3rd",5],["4th+",0]].map(([label,weight])=><div className="rounded-xl border border-line p-3 text-center" key={label}><p className="text-xs text-ink-dim">{label}</p><p className="mt-2 text-xl font-black text-brass">{weight}%</p></div>)}</div><p className="mt-4 text-sm text-ink-dim">Per edition. Discard payouts stay at their full value.</p></section>
    <section><h2 className="display text-3xl">Your collection&rsquo;s share</h2>{editions.length===0?<p className="mt-4 text-ink-dim">No cards yet.</p>:<ul className="mt-5 divide-y divide-line/50 border-y border-line/60">{editions.map((edition)=><li className="flex min-h-16 items-center justify-between gap-4 py-3" key={edition.edition_id}><div><Link className="font-black text-brass hover:underline" href={`/club/value/${edition.edition_id}`}>{edition.edition_title} &rarr;</Link><p className="mt-1 text-xs text-ink-dim">{edition.copy_count} {edition.copy_count===1?"copy":"copies"} &middot; {edition.discard_value} base value</p></div><strong className="tabular-nums">{nf.format(edition.club_value_contribution)}</strong></li>)}</ul>}</section>
    <section className="rounded-2xl border border-line bg-panel/50 p-5 text-sm text-ink-dim"><h2 className="font-black text-ink">Personal card &times;{value.personal_card_weight || ECONOMY.personalCardClubWeight}</h2><p className="mt-2">{value.personal_card_player_name ? <><Link className="text-brass underline" href={`/players/${value.personal_card_player_slug}`}>{value.personal_card_player_name}</Link> at OVR {value.personal_card_ovr}: {value.personal_card_base_value} &times; {value.personal_card_weight} = {value.personal_card_bonus}.</> : "No player is linked to this account, so the personal-card bonus is zero."}</p></section>
  </section></main>;
}
