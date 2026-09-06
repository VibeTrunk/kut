import { getRarityTier, type Attributes, type RarityTier } from "@/game/rating-engine";
import type { Archetype } from "@/game/archetypes";

export type LiveEditionSource = {
  isLive: true;
  editionId: string;
  editionType: "live";
  title: string;
  playerId: string;
  displayName: string;
  archetype: Archetype;
  current: ({ liveOvr: number; rarityTier: RarityTier } & Attributes) | null;
};

export type SpecialEditionSource = {
  isLive: false;
  editionId: string;
  editionType: Exclude<string, "live">;
  title: string;
  playerId: string;
  displayName: string;
  issuedAt: string | null;
  description: string | null;
  snapshotArchetype: Archetype | null;
  snapshotRarityTier: RarityTier | null;
  snapshotOvr: number | null;
  snapshot: (Attributes & { ovr: number }) | null;
  artworkKey: string | null;
  artworkVersion: number | null;
};

export type EditionSource = LiveEditionSource | SpecialEditionSource;

export type ResolvedCardEdition = {
  isLive: boolean;
  editionId: string;
  editionType: string;
  editionTitle: string;
  editionLabel: string;
  playerId: string;
  displayName: string;
  archetype: Archetype;
  ovr: number;
  rarityTier: RarityTier;
  attributes: Attributes;
  issuedAt: string | null;
  description: string | null;
  artworkKey: string | null;
  artworkVersion: number | null;
};

/** Resolve by kind. An incomplete Special never falls back to Live state. */
export function resolveCardEdition(source: EditionSource): ResolvedCardEdition | null {
  if (source.isLive) {
    if (!source.current) return null;
    const { liveOvr, rarityTier, ...attributes } = source.current;
    return {
      isLive: true,
      editionId: source.editionId,
      editionType: "live",
      editionTitle: source.title,
      editionLabel: "Live edition",
      playerId: source.playerId,
      displayName: source.displayName,
      archetype: source.archetype,
      ovr: liveOvr,
      rarityTier,
      attributes,
      issuedAt: null,
      description: null,
      artworkKey: null,
      artworkVersion: null,
    };
  }

  if (
    !source.snapshot || source.snapshotArchetype === null ||
    source.snapshotRarityTier === null || source.snapshotOvr === null ||
    source.issuedAt === null || source.description === null ||
    source.artworkKey === null || source.artworkVersion === null
  ) return null;

  if (source.snapshot.ovr !== source.snapshotOvr) return null;
  if (source.snapshotOvr <= 83 && getRarityTier(source.snapshotOvr) !== source.snapshotRarityTier) return null;

  const { ovr, ...attributes } = source.snapshot;
  return {
    isLive: false,
    editionId: source.editionId,
    editionType: source.editionType,
    editionTitle: source.title,
    editionLabel: source.title,
    playerId: source.playerId,
    displayName: source.displayName,
    archetype: source.snapshotArchetype,
    ovr,
    rarityTier: source.snapshotRarityTier,
    attributes,
    issuedAt: source.issuedAt,
    description: source.description,
    artworkKey: source.artworkKey,
    artworkVersion: source.artworkVersion,
  };
}
