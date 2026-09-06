# Start the implementation session

Choose **5.6 Terra** with **High** reasoning in the new session and open this
same KUT workspace. The files below must be present; several are currently
untracked and will not arrive through a fresh clone until committed/carried over.

- `docs/IMPLEMENTATION_PLAN_NEXT_FEATURES.md`
- `docs/SPEC_NEXT_FEATURES.md`
- `docs/RATING_BALANCE_REVIEW.md`
- `design/features/` (complete directory, including assets)
- `docs/design/features/` (screen guide, PNGs and verification records)

Paste this:

```text
Implement all five KUT features described in
docs/IMPLEMENTATION_PLAN_NEXT_FEATURES.md, using
docs/SPEC_NEXT_FEATURES.md, docs/RATING_BALANCE_REVIEW.md and the revised
design/features/ gallery plus docs/design/features/ screens.

Read AGENTS.md and CLAUDE.md, follow the repository reading order, then read
the implementation plan and feature spec in full before editing. Preserve
the existing modified and untracked design/handoff files. Use the concrete
defaults in this package and record their adoption in ADRs/BUILD_SPEC.

Complete the implementation in this session, following slices A through E
and their validation gates. Keep separate reviewable units for each feature
as required by the repository's migration/RPC/invariant PR policy. Work
serially; don't stop after each slice to ask me whether to continue.

The scope is: Special-edition scaffolding with ZERO Special issuance;
duplicate Club Value at 100%/20%/5%/0%; basic packs at 175; private wants and
explicit trading availability that encourage WhatsApp conversation (NO
reciprocal matching or new trading/escrow engine); and self-reported
goals/kudos with 50 coins once per completed form, admin completion and
member/guest goal correction, versioned ratings and reliable finalization.
Match the current look and feel exactly, make every journey excellent on
mobile, and remove the avatar overflow in favor of direct Settings access
with visible destinations. No overflow menus for the new features.

Implement real database/server behavior and authenticated screens, not the
prototype fixtures. Test locally, including reward/pack concurrency,
SQL/TypeScript rating and history parity, privacy, admin corrections and
mobile journeys. Preserve legacy sessions and historical transactions.

Keep an execution record so resumed work continues from completed checkpoints.
Finish all work that can be done locally if an external prerequisite is
unavailable, and report any unrun check honestly. A critical or unmeasured
live-roster pack EV is an activation gate, not permission to alter the
requested price/odds or abandon unrelated implementation.

Do not push, publish PRs, merge, deploy, or mutate hosted Supabase. Prepare
the concrete per-slice review and operator handoff; hosted activation is a
later explicitly authorized step through VibeTrunk/supabase. End with what
was built, verification results, review locations and any remaining blockers.
```
