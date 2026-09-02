import { ARCHETYPES, type Archetype } from "@/game/archetypes";
import type { RarityTier } from "@/game/rating-engine";

export type AlbumDirectoryPlayer = {
  id: string; slug: string; display_name: string; archetype: string; photo_path: string | null;
  live_ovr: number; pac: number; sho: number; pas: number; dri: number; def: number; phy: number; rarity_tier: RarityTier;
};
export type AlbumCollectionCard = {
  card_id: string; player_id: string; player_slug: string; display_name: string; archetype: string; photo_path: string | null;
  live_ovr: number; pac: number; sho: number; pas: number; dri: number; def: number; phy: number; rarity_tier: RarityTier;
  edition_title: string; is_live: boolean; discard_value: number;
  active_listing_id: string | null; held_by_offer_id: string | null;
};
export type AlbumSlot = { index: number; player: AlbumDirectoryPlayer; copies: AlbumCollectionCard[] };
export type Lens = { kind: "all" | "gaps" | "specialists" } | { kind: "type"; archetype: Archetype } | { kind: "tier"; tier: RarityTier };

export function parseLens(value?: string): Lens {
  if (value === "gaps" || value === "specialists") return { kind: value };
  if (value?.startsWith("type:") && ARCHETYPES.includes(value.slice(5) as Archetype)) return { kind: "type", archetype: value.slice(5) as Archetype };
  if (value?.startsWith("tier:") && ["common", "bronze", "silver", "gold", "holo", "elite"].includes(value.slice(5))) return { kind: "tier", tier: value.slice(5) as RarityTier };
  return { kind: "all" };
}
export function lensParam(lens: Lens) { return lens.kind === "type" ? `type:${lens.archetype}` : lens.kind === "tier" ? `tier:${lens.tier}` : lens.kind; }

export function buildSlots(roster: AlbumDirectoryPlayer[], owned: AlbumCollectionCard[]): AlbumSlot[] {
  const copies = new Map<string, AlbumCollectionCard[]>();
  for (const card of owned) copies.set(card.player_id, [...(copies.get(card.player_id) ?? []), card]);
  return roster.slice().sort((a, b) => a.display_name.localeCompare(b.display_name) || a.id.localeCompare(b.id)).map((player, index) => ({ index: index + 1, player, copies: copies.get(player.id) ?? [] }));
}
export function applyLens(slots: AlbumSlot[], lens: Lens) {
  if (lens.kind === "gaps") return slots.filter((slot) => slot.copies.length === 0);
  if (lens.kind === "specialists") return slots.filter((slot) => slot.player.archetype !== "all_rounder");
  if (lens.kind === "type") return slots.filter((slot) => slot.player.archetype === lens.archetype);
  if (lens.kind === "tier") return slots.filter((slot) => slot.player.rarity_tier === lens.tier);
  return slots;
}
export function paginate<T>(items: T[], page: number, perPage = 9) {
  const total = Math.max(1, Math.ceil(items.length / perPage));
  const pages = Array.from({ length: total }, (_, index) => items.slice(index * perPage, (index + 1) * perPage));
  return { pages, total, slots: pages[page - 1] ?? [] };
}
export function spreadFor(page: number): [number, number | null] { const left = page % 2 === 0 ? page - 1 : page; return [left, left + 1]; }
