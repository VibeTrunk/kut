begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(20);

-- Schema surface (ADR-041) ----------------------------------------------------
select has_column('kut', 'my_club_value', 'owned_cards_value',
  'my_club_value exposes the owned-cards subtotal');
select has_column('kut', 'my_club_value', 'personal_card_weight',
  'my_club_value exposes the personal-card weight');
select has_column('kut', 'my_club_value', 'personal_card_base_value',
  'my_club_value exposes the personal-card base value');
select has_column('kut', 'my_club_value', 'personal_card_bonus',
  'my_club_value exposes the personal-card bonus');
select has_column('kut', 'club_value_leaderboard', 'club_value',
  'club_value_leaderboard still exposes club_value');

-- Fixtures ------------------------------------------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('0000000d-0000-4000-8000-000000000010', 'Club Value Test Season', date '2099-04-01', true);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000d0201', 'cv-linked@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000d0202', 'cv-unlinked@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-0000000d0101', 'cv-personal', 'CV Personal', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000d0102', 'cv-owned-a', 'CV Owned A', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000d0103', 'cv-owned-b', 'CV Owned B', 'all_rounder');

-- The linked player rates at OVR 60 -> base value round(10 * 1.08^30) = 101.
insert into kut.player_season_state (player_id, season_id, activity_score, form_score, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier)
values
  ('00000000-0000-4000-8000-0000000d0101', '0000000d-0000-4000-8000-000000000010', 50, 0, 60, 60, 60, 60, 60, 60, 60, 'gold'),
  -- An owned live card's player rates at OVR 50 -> discard round(10 * 1.08^20) = 47.
  ('00000000-0000-4000-8000-0000000d0103', '0000000d-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver');

insert into kut.profiles (id, display_name, role, player_id, username)
values
  ('00000000-0000-4000-8000-0000000d0201', 'CV Linked', 'user', '00000000-0000-4000-8000-0000000d0101', 'cv_linked'),
  ('00000000-0000-4000-8000-0000000d0202', 'CV Unlinked', 'user', null, 'cv_unlinked');

insert into kut.wallets (user_id, balance)
values
  ('00000000-0000-4000-8000-0000000d0201', 500),
  ('00000000-0000-4000-8000-0000000d0202', 500);

-- A special edition of Owned A frozen at OVR 40 -> discard round(10 * 1.08^10 * 1) = 22.
insert into kut.card_editions (id, player_id, edition_type, title, is_live, snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy, special_discard_multiplier, snapshot_archetype, snapshot_rarity_tier, description, artwork_key, artwork_version, issued_at)
values ('00000000-0000-4000-8000-0000000d0301', '00000000-0000-4000-8000-0000000d0102', 'other', 'CV Owned A Special', false, 40, 40, 40, 40, 40, 40, 40, 1, 'all_rounder', 'bronze', 'Club Value test fixture.', 'tests/club-value', 1, now());
-- A live edition of Owned B (rating comes from player_season_state above).
insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values ('00000000-0000-4000-8000-0000000d0302', '00000000-0000-4000-8000-0000000d0103', 'live', 'CV Owned B Live', true);

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-0000000d0401', '00000000-0000-4000-8000-0000000d0301', '00000000-0000-4000-8000-0000000d0201', 'pack'),
  ('00000000-0000-4000-8000-0000000d0402', '00000000-0000-4000-8000-0000000d0302', '00000000-0000-4000-8000-0000000d0201', 'pack');

-- my_club_value for the linked member ------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000d0201';

select is((select owned_cards_value from kut.my_club_value), 69::bigint,
  'owned-cards value is the sum of the two card discard values (22 + 47)');
select is((select personal_card_base_value from kut.my_club_value), 101::bigint,
  'personal-card base value is the linked player Live discard value at OVR 60');
select is((select personal_card_weight from kut.my_club_value), 4,
  'personal-card weight is 4');
select is((select personal_card_bonus from kut.my_club_value), 404::bigint,
  'personal-card bonus is 4x the base value');
select is((select club_value from kut.my_club_value), 973::bigint,
  'club value is coins (500) + owned cards (69) + personal bonus (404)');
select is((select card_count from kut.my_club_value), 2,
  'card count counts both owned cards');
select is((select personal_card_player_name from kut.my_club_value), 'CV Personal',
  'the linked player name is exposed for the breakdown page');

-- my_club_value for the unlinked member -------------------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000d0202';
select is((select personal_card_bonus from kut.my_club_value), 0::bigint,
  'a member with no linked player has a zero personal-card bonus');
select is((select club_value from kut.my_club_value), 500::bigint,
  'the unlinked member club value is just their wallet balance');

-- Leaderboard ranks the personal-card weighting ---------------------------
select is(
  (select club_value from kut.club_value_leaderboard where display_name = 'CV Linked'),
  973::bigint,
  'the leaderboard uses the same v2 total');
select cmp_ok(
  (select rank from kut.club_value_leaderboard where display_name = 'CV Linked'),
  '<',
  (select rank from kut.club_value_leaderboard where display_name = 'CV Unlinked'),
  'the linked member outranks the unlinked member on equal coins');

-- Custom club name (ADR-044) is presentation only ------------------------
select is(
  (select club_name from kut.club_value_leaderboard where display_name = 'CV Linked'),
  'CV Linked''s Club',
  'club_name defaults to the synthesised "<name>''s Club"');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000d0201';
select kut.set_own_club_name('Relegation FC');

select is(
  (select club_name from kut.club_value_leaderboard where display_name = 'CV Linked'),
  'Relegation FC',
  'a custom club name replaces the default on the leaderboard');
select is(
  (select club_value from kut.club_value_leaderboard where display_name = 'CV Linked'),
  973::bigint,
  'setting a club name does not change club_value');
select cmp_ok(
  (select rank from kut.club_value_leaderboard where display_name = 'CV Linked'),
  '<',
  (select rank from kut.club_value_leaderboard where display_name = 'CV Unlinked'),
  'setting a club name does not change the ranking');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
