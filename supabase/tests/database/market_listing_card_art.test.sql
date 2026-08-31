begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(5);

-- Schema surface (ADR-040) ------------------------------------------------
select has_column('kut', 'active_market_listings', 'photo_path',
  'the market listings view exposes the player photo path');
select has_column('kut', 'active_market_listings', 'seller_id',
  'the market listings view exposes the listing seller id');

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

select * from finish();

rollback;
