/**
 * The public brand (ADR-137, design/flut/HANDOFF.md): the game is FLUT,
 * Football League Ultimate Team, and its currency is FLUT Coins.
 *
 * Only what members read comes from here. Infrastructure keeps its `kut`
 * names: the Postgres schema, the Vercel project, `KUT_RELEASE_*`, credential
 * locators and diagnostic prefixes. `kut.vibetrunk.com` is the legacy host,
 * which redirects to `publicUrl` (`next.config.ts`).
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
   * The public address (ADR-137 slice 3). Invite links come from Production
   * `APP_URL`, which is set to the same address.
   */
  publicUrl: "https://flut.vibetrunk.com",
} as const;
