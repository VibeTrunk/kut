-- Automated/local data must remain fictional.
insert into kut.players (id, slug, display_name, full_name, archetype)
values
  ('00000000-0000-4000-8000-000000000001', 'alex-example', 'Alex Example', 'Alex Example', 'finisher'),
  ('00000000-0000-4000-8000-000000000002', 'bea-test', 'Bea Test', 'Bea Test', 'playmaker'),
  ('00000000-0000-4000-8000-000000000003', 'charlie-fixture', 'Charlie Fixture', 'Charlie Fixture', 'defender')
on conflict (id) do nothing;

-- is_active is computed, not a literal true, so this stays safe if a real
-- active season (e.g. from 20260818000000_initial_tfh_roster_and_august_sessions.sql)
-- was already inserted by an earlier migration in this same reset — only one
-- season may be active at a time (kut.seasons_one_active_idx).
insert into kut.seasons (id, name, starts_on, is_active)
values (
  '00000000-0000-4000-8000-000000000010',
  'Test Season 2026',
  '2026-08-03',
  not exists (select 1 from kut.seasons where is_active)
)
on conflict (id) do nothing;

-- Seeds run after migrations, so create the matching Live editions here too.
-- This keeps a freshly reset local/CI database eligible for starter-pack tests.
insert into kut.card_editions (player_id, edition_type, title, is_live)
select id, 'live', display_name || ' Live', true
from kut.players
on conflict do nothing;
