-- ADR-062: pull the member-reporting (rating v2) cutover a week earlier so
-- self-reported goals + kudos start with the football week of 2026-09-07.
--
-- The cutover is stored per season in kut.season_rating_rules.v2_starts_week
-- (a Monday date). This migration only rewrites the exact stale value the
-- hosted season was seeded with (the football week beginning 2026-09-28); any
-- other value is left untouched, so the statement is a safe no-op if the
-- cutover was already moved or seeded earlier.
--
-- Precondition (verified on hosted before deploy, see ADR-062): no session is
-- published in a football week >= 2026-09-07. Moving the cutover past an
-- already-published session would make kut._rebuild_season_core treat that v1
-- week as a v2 week with no session_report_results and zero its Form
-- contribution. `rating_rules_version` is stamped per session at publish time,
-- so already-published sessions keep their version and no rebuild is needed.
--
-- Rollback:
--   update kut.season_rating_rules set v2_starts_week = date '2026-09-28'
--    where v2_starts_week = date '2026-09-07';

update kut.season_rating_rules
   set v2_starts_week = date '2026-09-07'
 where v2_starts_week = date '2026-09-28';
