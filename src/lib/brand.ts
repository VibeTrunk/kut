/**
 * The public brand (ADR-137, design/flut/HANDOFF.md): the game is FLUT,
 * Football League Ultimate Team, and its currency is FLUT Coins.
 *
 * Only what members read comes from here. Infrastructure keeps its `kut`
 * names: the Postgres schema, the Vercel project, `kut.vibetrunk.com`,
 * `KUT_RELEASE_*`, credential locators and diagnostic prefixes.
 */
export const BRAND = {
  /** The mark: nav pennant, page kickers, "How FLUT works". */
  shortName: "FLUT",
  fullName: "Football League Ultimate Team",
  /** The currency in sentences and on buttons: "250 FLUT Coins". */
  currency: "FLUT Coins",
  /** The compact unit after a figure where space is tight: "+54 FLUT". */
  unit: "FLUT",
  /**
   * The planned public address. Nothing routes on it yet: the domain moves in
   * a later slice (ADR-137), so links and redirects still use the current host.
   */
  publicUrl: "https://flut.vibetrunk.com",
} as const;
