begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(21);

-- Schema surface (ADR-040) ------------------------------------------------
select has_column('kut', 'active_market_listings', 'photo_path',
  'the market listings view exposes the player photo path');
select has_column('kut', 'active_market_listings', 'seller_id',
  'the market listings view exposes the listing seller id');

-- Discard value (ADR-103, KB-027) -----------------------------------------
select has_column('kut', 'active_market_listings', 'discard_value',
  'the market listings view exposes the card''s discard value');
select is(
  (select column_name::text from information_schema.columns
   where table_schema = 'kut' and table_name = 'active_market_listings'
   order by ordinal_position desc limit 1),
  'discard_value',
  'discard_value is the last column, so every existing column keeps its place');
select is(
  (select reloptions from pg_class where oid = 'kut.active_market_listings'::regclass),
  array['security_invoker=false', 'security_barrier=true'],
  'the view stays a security-barrier definer view (never security_invoker, KB-013)');
select function_privs_are('kut', 'card_discard_value', array['uuid'], 'authenticated', array['EXECUTE'],
  'members can execute card_discard_value, which the view calls as them');
select function_privs_are('kut', 'card_discard_value', array['uuid'], 'service_role', array['EXECUTE'],
  'the service role can execute card_discard_value, so its reads of the view still work');
select function_privs_are('kut', 'card_discard_value', array['uuid'], 'anon', array[]::text[],
  'anon still cannot execute card_discard_value');

-- Fixtures --------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000a1201', 'art-seller@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000a1202', 'art-viewer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype, photo_path)
values
  ('00000000-0000-4000-8000-0000000a1101', 'art-with-photo', 'Art With Photo', 'all_rounder',
   'players/00000000-0000-4000-8000-0000000a1101/profile.webp'),
  ('00000000-0000-4000-8000-0000000a1102', 'art-no-photo', 'Art No Photo', 'all_rounder', null);

insert into kut.profiles (id, display_name, role, username)
values
  ('00000000-0000-4000-8000-0000000a1201', 'Art Seller', 'user', 'art_seller'),
  ('00000000-0000-4000-8000-0000000a1202', 'Art Viewer', 'user', 'art_viewer');

insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-0000000a1301', '00000000-0000-4000-8000-0000000a1101', 'live', 'Art With Photo Live', true),
  ('00000000-0000-4000-8000-0000000a1302', '00000000-0000-4000-8000-0000000a1102', 'live', 'Art No Photo Live', true);

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-0000000a1401', '00000000-0000-4000-8000-0000000a1301', '00000000-0000-4000-8000-0000000a1201', 'pack'),
  ('00000000-0000-4000-8000-0000000a1402', '00000000-0000-4000-8000-0000000a1302', '00000000-0000-4000-8000-0000000a1201', 'pack');

insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at)
values
  ('00000000-0000-4000-8000-0000000a1501', '00000000-0000-4000-8000-0000000a1401', '00000000-0000-4000-8000-0000000a1201', 60, 'active', now(), now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000a1502', '00000000-0000-4000-8000-0000000a1402', '00000000-0000-4000-8000-0000000a1201', 60, 'active', now(), now() + interval '1 day');

-- Any member browsing the market sees the photo path + seller id -----------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000a1202';

select is(
  (select photo_path from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1501'),
  'players/00000000-0000-4000-8000-0000000a1101/profile.webp',
  'a listing surfaces its player card photo path');
select is(
  (select photo_path from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1502'),
  null,
  'a listing for a player with no photo surfaces a null photo path');
select is(
  (select seller_id from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1501'),
  '00000000-0000-4000-8000-0000000a1201'::uuid,
  'a listing surfaces its seller id');

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Discard value fixtures (ADR-103) ------------------------------------------
-- A rated Live card (OVR 66 -> 160), a Special snapshot (OVR 57 x 1.5 -> 120),
-- and a Live card with no rating this season, where card_discard_value raises.
-- Plus the two callers ADR-079 denies: a JWT with no KUT profile, and a
-- disabled member.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000a1203', 'art-other-tool@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000a1204', 'art-disabled@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into kut.profiles (id, display_name, role, username)
values ('00000000-0000-4000-8000-0000000a1204', 'Art Disabled', 'user', 'art_disabled');
update kut.profiles set is_disabled = true where id = '00000000-0000-4000-8000-0000000a1204';

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-0000000a1103', 'discard-live', 'Discard Live', 'finisher'),
  ('00000000-0000-4000-8000-0000000a1104', 'discard-special', 'Discard Special', 'defender'),
  ('00000000-0000-4000-8000-0000000a1105', 'discard-unrated', 'Discard Unrated', 'tank');

update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('00000000-0000-4000-8000-0000000a1600', 'Discard Test Season', current_date - 14, true);
insert into kut.player_season_state (player_id, season_id, activity_score, form_score, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier)
values
  ('00000000-0000-4000-8000-0000000a1103', '00000000-0000-4000-8000-0000000a1600', 50, 0, 66, 68, 76, 63, 69, 58, 62, 'holo'),
  ('00000000-0000-4000-8000-0000000a1104', '00000000-0000-4000-8000-0000000a1600', 50, 0, 40, 40, 40, 40, 40, 40, 40, 'silver');

insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-0000000a1303', '00000000-0000-4000-8000-0000000a1103', 'live', 'Discard Live', true),
  ('00000000-0000-4000-8000-0000000a1305', '00000000-0000-4000-8000-0000000a1105', 'live', 'Discard Unrated', true);
insert into kut.card_editions (
  id, player_id, edition_type, title, is_live,
  snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy,
  snapshot_archetype, snapshot_rarity_tier, description, artwork_key, artwork_version,
  special_discard_multiplier, issued_at)
values (
  '00000000-0000-4000-8000-0000000a1304', '00000000-0000-4000-8000-0000000a1104', 'totw', 'Discard Special TOTW', false,
  57, 55, 50, 56, 53, 67, 61,
  'defender', 'gold', 'A frozen Team of the Week snapshot.', 'totw/discard-special', 1,
  1.5, now());

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-0000000a1403', '00000000-0000-4000-8000-0000000a1303', '00000000-0000-4000-8000-0000000a1201', 'pack'),
  ('00000000-0000-4000-8000-0000000a1404', '00000000-0000-4000-8000-0000000a1304', '00000000-0000-4000-8000-0000000a1201', 'pack'),
  ('00000000-0000-4000-8000-0000000a1405', '00000000-0000-4000-8000-0000000a1305', '00000000-0000-4000-8000-0000000a1201', 'pack');

insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at)
values
  ('00000000-0000-4000-8000-0000000a1503', '00000000-0000-4000-8000-0000000a1403', '00000000-0000-4000-8000-0000000a1201', 290, 'active', now(), now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000a1504', '00000000-0000-4000-8000-0000000a1404', '00000000-0000-4000-8000-0000000a1201', 300, 'active', now(), now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000a1505', '00000000-0000-4000-8000-0000000a1405', '00000000-0000-4000-8000-0000000a1201', 30, 'active', now(), now() + interval '1 day');

-- What the function itself says, read as the owner before any role switch.
select set_config('test.live_discard', kut.card_discard_value('00000000-0000-4000-8000-0000000a1403')::text, true);
select set_config('test.special_discard', kut.card_discard_value('00000000-0000-4000-8000-0000000a1404')::text, true);

-- An active member reads the function's value, not a second formula --------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000a1202';

select is(
  (select discard_value from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1503'),
  current_setting('test.live_discard')::bigint,
  'a Live listing''s discard_value equals kut.card_discard_value');
select is(
  (select discard_value from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1503'),
  160::bigint,
  'a Live card at OVR 66 discards for 160');
select is(
  (select discard_value from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1504'),
  current_setting('test.special_discard')::bigint,
  'a Special listing''s discard_value equals kut.card_discard_value');
select is(
  (select discard_value from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1504'),
  120::bigint,
  'a Special snapshot at OVR 57 with a 1.5 multiplier discards for 120');
select is(
  (select count(*)::int from kut.active_market_listings
   where listing_id = '00000000-0000-4000-8000-0000000a1505' and discard_value is null),
  1,
  'an unrated card stays listed with a null discard_value instead of breaking the market read');

-- The ADR-079 gate still holds with the new column --------------------------
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000a1203';
select is((select count(*)::int from kut.active_market_listings), 0,
  'a JWT with no KUT profile still reads no market listings');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000a1204';
select is((select count(*)::int from kut.active_market_listings), 0,
  'a disabled member still reads no market listings');

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role anon;
select throws_ok(
  $q$select discard_value from kut.active_market_listings$q$,
  '42501', null,
  'anon is still refused at the grant, before any row or function is read');
reset role;

-- service_role, last (its role claim would make a later deny pass vacuously).
-- Function privileges are checked against the caller even in a definer view,
-- so without its grant this read failed with zero rows or many.
set local role service_role;
set local request.jwt.claim.role = 'service_role';
select is(
  (select discard_value from kut.active_market_listings where listing_id = '00000000-0000-4000-8000-0000000a1503'),
  160::bigint,
  'the service role still reads the market, discard value included');
select lives_ok(
  $q$select count(*) from kut.my_wanted_cards$q$,
  'kut.my_wanted_cards, which reads this view, still works for the service role');
reset role;
select set_config('request.jwt.claim.role', '', true);

select * from finish();

rollback;
