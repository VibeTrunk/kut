begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(13);

-- Schema surface (ADR-072) -------------------------------------------------
select has_function('kut', 'create_listing', array['uuid', 'bigint', 'integer'],
  'create_listing takes a duration argument');
select hasnt_function('kut', 'create_listing', array['uuid', 'bigint'],
  'the old two-argument create_listing signature is gone, not left as an overload');

-- Fixtures (created as the test superuser) --------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('0000000d-0000-4000-8000-000000000010', 'Listing Duration Test Season', date '2099-08-01', true);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000d0201', 'ld-seller@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-0000000d0101', 'ld-card-one', 'LD Card One', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000d0102', 'ld-card-two', 'LD Card Two', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000d0103', 'ld-card-three', 'LD Card Three', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000d0104', 'ld-card-four', 'LD Card Four', 'all_rounder');

insert into kut.player_season_state (player_id, season_id, activity_score, form_score, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier)
values
  ('00000000-0000-4000-8000-0000000d0101', '0000000d-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'),
  ('00000000-0000-4000-8000-0000000d0102', '0000000d-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'),
  ('00000000-0000-4000-8000-0000000d0103', '0000000d-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'),
  ('00000000-0000-4000-8000-0000000d0104', '0000000d-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver');

insert into kut.profiles (id, display_name, role, username)
values ('00000000-0000-4000-8000-0000000d0201', 'LD Seller', 'user', 'ld_seller');

insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-0000000d0301', '00000000-0000-4000-8000-0000000d0101', 'live', 'LD Card One Live', true),
  ('00000000-0000-4000-8000-0000000d0302', '00000000-0000-4000-8000-0000000d0102', 'live', 'LD Card Two Live', true),
  ('00000000-0000-4000-8000-0000000d0303', '00000000-0000-4000-8000-0000000d0103', 'live', 'LD Card Three Live', true),
  ('00000000-0000-4000-8000-0000000d0304', '00000000-0000-4000-8000-0000000d0104', 'live', 'LD Card Four Live', true);

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-0000000d0401', '00000000-0000-4000-8000-0000000d0301', '00000000-0000-4000-8000-0000000d0201', 'pack'),
  ('00000000-0000-4000-8000-0000000d0402', '00000000-0000-4000-8000-0000000d0302', '00000000-0000-4000-8000-0000000d0201', 'pack'),
  ('00000000-0000-4000-8000-0000000d0403', '00000000-0000-4000-8000-0000000d0303', '00000000-0000-4000-8000-0000000d0201', 'pack'),
  ('00000000-0000-4000-8000-0000000d0404', '00000000-0000-4000-8000-0000000d0304', '00000000-0000-4000-8000-0000000d0201', 'pack');

-- create_listing is security definer and only reads auth.uid()
-- (request.jwt.claim.sub), so these calls run as the test superuser.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000d0201';

-- === 72-hour listing ======================================================
select lives_ok($$
  select kut.create_listing('00000000-0000-4000-8000-0000000d0401', 40, 72)
$$, 'a seller can create a 72-hour listing');

select is(
  (select date_trunc('hour', expires_at - listed_at)
   from kut.market_listings where card_id = '00000000-0000-4000-8000-0000000d0401'),
  interval '72 hours',
  'the 72-hour listing expires 72 hours after it was listed');

-- === 24-hour listing still works =========================================
select lives_ok($$
  select kut.create_listing('00000000-0000-4000-8000-0000000d0402', 40, 24)
$$, 'a seller can still create a 24-hour listing');

select is(
  (select date_trunc('hour', expires_at - listed_at)
   from kut.market_listings where card_id = '00000000-0000-4000-8000-0000000d0402'),
  interval '24 hours',
  'the 24-hour listing expires 24 hours after it was listed');

-- === The duration defaults to 24 hours when omitted ======================
select lives_ok($$
  select kut.create_listing('00000000-0000-4000-8000-0000000d0403', 40)
$$, 'omitting the duration still works and keeps existing callers valid');

select is(
  (select date_trunc('hour', expires_at - listed_at)
   from kut.market_listings where card_id = '00000000-0000-4000-8000-0000000d0403'),
  interval '24 hours',
  'an omitted duration defaults to 24 hours');

-- === The returned payload describes the row that was actually written ====
-- The previous body returned a hardcoded `now() + interval '24 hours'` that was
-- never read back from the insert; with a variable duration that would be wrong.
-- The call must be its own statement: within a single statement the insert it
-- performs is not visible to a sibling subquery reading market_listings.
create temporary table ld_payload on commit drop as
  select kut.create_listing('00000000-0000-4000-8000-0000000d0404', 40, 72) as payload;

select is(
  (select (payload ->> 'expires_at')::timestamptz from ld_payload),
  (select expires_at from kut.market_listings where card_id = '00000000-0000-4000-8000-0000000d0404'),
  'the returned expires_at is the one actually stored on the listing');

-- === Durations outside the allow-list are refused ========================
select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-0000000d0401', 40, 168) $$,
  '22023', 'listing duration must be 24 or 72 hours',
  'a week-long listing is refused');

select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-0000000d0401', 40, 48) $$,
  '22023', 'listing duration must be 24 or 72 hours',
  'an unlisted duration such as 48 hours is refused');

select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-0000000d0401', 40, 0) $$,
  '22023', 'listing duration must be 24 or 72 hours',
  'a zero-hour listing is refused');

select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-0000000d0401', 40, null) $$,
  '22023', 'listing duration must be 24 or 72 hours',
  'a null duration is refused rather than silently defaulting');

select * from finish();
rollback;
