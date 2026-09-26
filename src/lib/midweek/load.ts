import type { createClient } from "@/lib/supabase/server";
import { isMidweekVisible, isPickingOpen, type MidweekCurrent, type MySquadRow } from "./entry";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The Midweek state every entry point shares: the switch, the current
 * tournament and the caller's own saved rows for it.
 *
 * Tolerant by design (ADR-097). Vercel deploys on merge, before a hosted
 * push, and the switch is off until launch, so a missing relation, a failed
 * read or a denied read (zero rows, ADR-079) all mean "Midweek is not showing"
 * and never fail the page that asked. Views are read with `select("*")`, so a
 * column a later migration appends changes nothing here.
 */
export type MidweekEntryState = {
  current: MidweekCurrent;
  /**
   * The caller's saved slots for the current tournament, in slot order; null
   * when the read failed, which is not the same as "not picked".
   */
  squad: MySquadRow[] | null;
};

export async function loadMidweekEntryState(
  supabase: SupabaseServerClient,
): Promise<MidweekEntryState | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_current")
    .select("*")
    .maybeSingle();
  if (error) {
    // Expected before the hosted push; loud enough to notice after it.
    console.error("midweek current read failed", error.code, error.message);
    return null;
  }
  const current = (data ?? null) as MidweekCurrent | null;
  if (!isMidweekVisible(current)) return null;
  if (!current.tournament_id) return { current, squad: [] };

  const squadResponse = await supabase
    .schema("kut")
    .from("my_midweek_squad")
    .select("*")
    .eq("tournament_id", current.tournament_id)
    .order("slot");
  if (squadResponse.error) {
    console.error("midweek squad read failed", squadResponse.error.code);
    return { current, squad: null };
  }
  return { current, squad: (squadResponse.data ?? []) as MySquadRow[] };
}

/** A saved card as the entry points draw it: a `MidweekMiniCard`. */
export type EntryMini = {
  rarityTier: "common" | "bronze" | "silver" | "gold" | "holo" | "elite";
  ovr: number;
  injured: boolean;
};

/**
 * What the Home card and the Collection strip need before the lock (PR 7):
 * the lock time and the caller's saved five, or null when neither shows. They
 * show only while picking is open for a member who hasn't opted out; the
 * evening states are PR 8's.
 */
export async function loadMidweekEntryPoint(
  supabase: SupabaseServerClient,
  injuredPlayerIds: ReadonlySet<string>,
  now: Date,
): Promise<{ lockAt: string; saved: EntryMini[] } | null> {
  const state = await loadMidweekEntryState(supabase);
  if (!state || state.squad === null || state.current.opted_out) return null;
  if (!isPickingOpen(state.current, now) || !state.current.lock_at) return null;
  if (state.squad.length === 0) return { lockAt: state.current.lock_at, saved: [] };

  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select("card_id, player_id, is_live, ovr, rarity_tier")
    .in(
      "card_id",
      state.squad.map((row) => row.card_id),
    );
  if (error) return null;
  const byCard = new Map(
    (
      (data ?? []) as {
        card_id: string;
        player_id: string;
        is_live: boolean;
        ovr: number;
        rarity_tier: EntryMini["rarityTier"];
      }[]
    ).map((row) => [row.card_id, row]),
  );
  // A saved card sold since shows as a trialist on the picker; here it is
  // simply left out.
  const saved = state.squad.flatMap((row) => {
    const card = byCard.get(row.card_id);
    return card
      ? [
          {
            rarityTier: card.rarity_tier,
            ovr: card.ovr,
            injured: card.is_live && injuredPlayerIds.has(card.player_id),
          },
        ]
      : [];
  });
  return { lockAt: state.current.lock_at, saved };
}
