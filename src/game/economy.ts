/**
 * Canonical economy constants (BUILD_SPEC.md Part 145).
 *
 * Every value the economy actually enforces lives in SQL; these mirror them so
 * display copy (the "How KUT works" page, the Club Value breakdown) stays in
 * sync with the rules. If a value changes here it must also change in the
 * relevant migration and in BUILD_SPEC Part 145.
 *
 * This module holds constants only. The TypeScript re-implementations of the
 * Club Value and pack-EV formulas were removed in ADR-064 — nothing in `src/`
 * called them, and their tests compared TypeScript against TypeScript rather
 * than against the SQL that actually runs.
 */
export const ECONOMY = {
  attendanceCoinReward: 250,
  // One-off bonus for the member who brought the bibs to a session
  // (kut.grant_bibs_reward, ADR-037; wording corrected in ADR-044). Mirrored by
  // the SQL `v_amount` constant in 20260907000000_bibs_bonus.sql and
  // BUILD_SPEC Part 145.
  bibsCoinBonus: 100,
  sessionReportReward: 50,
  starterCoinGrant: 250,
  basicPackPrice: 175,
  basicPackCardCount: 3,
  marketTaxPercent: 5,
  listingDurationHours: 24,
  // Per-call fat-finger cap on abs(amount) for the admin coin faucet
  // (kut.admin_adjust_wallet, ADR-035). Mirrored by the SQL guard in
  // 20260905000000_admin_economy_tools.sql.
  adminWalletAdjustMax: 100_000,
  // Club Value v3 (ADR-056): your linked player's Live-card discard value counts
  // this many times, on top of the weighted value of every card you own.
  // Mirrored by the `4` literals in 20260917000000_duplicate_club_value.sql and
  // BUILD_SPEC Part XII.
  personalCardClubWeight: 4,
  // Club Value v3 (ADR-056): owned copies are grouped per edition and the Nth
  // copy contributes this percentage of the edition's discard value. Discard
  // payouts themselves stay at full value. Mirrored by
  // kut.duplicate_edition_contribution in 20260917000000_duplicate_club_value.sql.
  duplicateEditionWeights: [
    { label: "1st", percent: 100 },
    { label: "2nd", percent: 20 },
    { label: "3rd", percent: 5 },
    { label: "4th+", percent: 0 },
  ],
  // Trade offers (ADR-042). Mirrored by the SQL literals / guards in
  // 20260911000000_trade_offers.sql and BUILD_SPEC Part XXXIV.
  tradeOfferExpiryHours: 12,
  tradeOfferMaxCards: 3,
  tradeOfferMaxActivePerUser: 10,
} as const;
