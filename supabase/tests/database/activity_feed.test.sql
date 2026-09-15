begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(19);

select has_view('kut', 'activity_feed', 'the activity feed view exists');

-- Fixtures --------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000009a201', 'feed-seller@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009a202', 'feed-buyer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009a203', 'feed-viewer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009a204', 'feed-superadmin@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-00000009a101', 'feed-fixture-one', 'Feed Fixture One', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a102', 'feed-fixture-two', 'Feed Fixture Two', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a103', 'feed-fixture-three', 'Feed Fixture Three', 'all_rounder'),
  -- ADR-073 trade fixtures: one listed card that changes hands, two cards
  -- offered back alongside coins, and a second listed card for a coins-only
  -- trade.
  ('00000000-0000-4000-8000-00000009a104', 'feed-traded', 'Feed Traded', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a105', 'feed-offered-a', 'Feed Offered A', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a106', 'feed-offered-b', 'Feed Offered B', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009a107', 'feed-traded-solo', 'Feed Traded Solo', 'all_rounder');

insert into kut.profiles (id, display_name, role, username)
values
  ('00000000-0000-4000-8000-00000009a201', 'Feed Seller', 'user', 'feed_seller'),
  ('00000000-0000-4000-8000-00000009a202', 'Feed Buyer', 'user', 'feed_buyer'),
  ('00000000-0000-4000-8000-00000009a203', 'Feed Viewer', 'user', 'feed_viewer'),
  -- KB-009: the superadmin demo/test account. Its own economy activity must
  -- never surface in the member-facing feed.
  ('00000000-0000-4000-8000-00000009a204', 'Feed Superadmin', 'superadmin', 'feed_superadmin');

insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-00000009a301', '00000000-0000-4000-8000-00000009a101', 'live', 'Feed Fixture One Live', true),
  ('00000000-0000-4000-8000-00000009a302', '00000000-0000-4000-8000-00000009a102', 'live', 'Feed Fixture Two Live', true),
  ('00000000-0000-4000-8000-00000009a303', '00000000-0000-4000-8000-00000009a103', 'live', 'Feed Fixture Three Live', true),
  ('00000000-0000-4000-8000-00000009a304', '00000000-0000-4000-8000-00000009a104', 'live', 'Feed Traded Live', true),
  ('00000000-0000-4000-8000-00000009a305', '00000000-0000-4000-8000-00000009a105', 'live', 'Feed Offered A Live', true),
  ('00000000-0000-4000-8000-00000009a306', '00000000-0000-4000-8000-00000009a106', 'live', 'Feed Offered B Live', true),
  ('00000000-0000-4000-8000-00000009a307', '00000000-0000-4000-8000-00000009a107', 'live', 'Feed Traded Solo Live', true);

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-00000009a401', '00000000-0000-4000-8000-00000009a301', '00000000-0000-4000-8000-00000009a202', 'pack'),
  ('00000000-0000-4000-8000-00000009a402', '00000000-0000-4000-8000-00000009a302', '00000000-0000-4000-8000-00000009a201', 'pack'),
  ('00000000-0000-4000-8000-00000009a403', '00000000-0000-4000-8000-00000009a303', '00000000-0000-4000-8000-00000009a204', 'pack'),
  ('00000000-0000-4000-8000-00000009a404', '00000000-0000-4000-8000-00000009a301', '00000000-0000-4000-8000-00000009a204', 'pack'),
  -- After the trade the listed cards sit with the proposer and the offered
  -- cards with the seller; the feed reads player names, not current owners.
  ('00000000-0000-4000-8000-00000009a405', '00000000-0000-4000-8000-00000009a304', '00000000-0000-4000-8000-00000009a202', 'pack'),
  ('00000000-0000-4000-8000-00000009a406', '00000000-0000-4000-8000-00000009a305', '00000000-0000-4000-8000-00000009a201', 'pack'),
  ('00000000-0000-4000-8000-00000009a407', '00000000-0000-4000-8000-00000009a306', '00000000-0000-4000-8000-00000009a201', 'pack'),
  ('00000000-0000-4000-8000-00000009a408', '00000000-0000-4000-8000-00000009a307', '00000000-0000-4000-8000-00000009a202', 'pack');

-- A sale where the seller is the superadmin (KB-009: must never surface).
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009a503', '00000000-0000-4000-8000-00000009a403', '00000000-0000-4000-8000-00000009a204', 77, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009a202');
insert into kut.market_sales (listing_id, card_id, edition_id, seller_id, buyer_id, sale_price, tax_amount, seller_receipt, buyer_idempotency_key)
values ('00000000-0000-4000-8000-00000009a503', '00000000-0000-4000-8000-00000009a403', '00000000-0000-4000-8000-00000009a303', '00000000-0000-4000-8000-00000009a204', '00000000-0000-4000-8000-00000009a202', 77, 4, 73, gen_random_uuid());

-- An active listing by the superadmin (KB-009: must never surface).
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at)
values ('00000000-0000-4000-8000-00000009a504', '00000000-0000-4000-8000-00000009a404', '00000000-0000-4000-8000-00000009a204', 88, 'active', now(), now() + interval '1 day');

-- A pack opened by the superadmin (KB-009: must never surface).
insert into kut.pack_openings (user_id, pack_id, price_paid, idempotency_key)
values ('00000000-0000-4000-8000-00000009a204', (select id from kut.pack_definitions limit 1), 999, gen_random_uuid());

-- A completed sale (seller -> buyer).
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009a501', '00000000-0000-4000-8000-00000009a401', '00000000-0000-4000-8000-00000009a201', 40, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009a202');
insert into kut.market_sales (listing_id, card_id, edition_id, seller_id, buyer_id, sale_price, tax_amount, seller_receipt, buyer_idempotency_key)
values ('00000000-0000-4000-8000-00000009a501', '00000000-0000-4000-8000-00000009a401', '00000000-0000-4000-8000-00000009a301', '00000000-0000-4000-8000-00000009a201', '00000000-0000-4000-8000-00000009a202', 40, 2, 38, gen_random_uuid());

-- An active listing (should surface as kind = 'listing').
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at)
values ('00000000-0000-4000-8000-00000009a502', '00000000-0000-4000-8000-00000009a402', '00000000-0000-4000-8000-00000009a201', 55, 'active', now(), now() + interval '1 day');

-- A published session.
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values ('00000000-0000-4000-8000-00000009a601', (select id from kut.seasons where is_active limit 1), date '2099-06-01', 'monday', 'published', now());

-- ADR-073: an accepted trade of 200 coins PLUS two cards. coins_to_seller is
-- the post-burn receipt (190); the feed must report the gross 200.
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009a505', '00000000-0000-4000-8000-00000009a405', '00000000-0000-4000-8000-00000009a201', 210, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009a202');
insert into kut.trade_offers (id, listing_id, proposer_id, seller_id, offered_coins, status, created_at, expires_at, resolved_at, proposer_idempotency_key, coins_to_seller, coins_burned, settled_card_id)
values ('00000000-0000-4000-8000-00000009a701', '00000000-0000-4000-8000-00000009a505', '00000000-0000-4000-8000-00000009a202', '00000000-0000-4000-8000-00000009a201', 200, 'accepted', now(), now() + interval '12 hours', now(), gen_random_uuid(), 190, 10, '00000000-0000-4000-8000-00000009a405');
insert into kut.trade_offer_cards (offer_id, card_id)
values
  ('00000000-0000-4000-8000-00000009a701', '00000000-0000-4000-8000-00000009a406'),
  ('00000000-0000-4000-8000-00000009a701', '00000000-0000-4000-8000-00000009a407');

-- A coins-only accepted trade: offered_card_names must be null rather than an
-- empty array, so the UI can branch on presence.
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009a506', '00000000-0000-4000-8000-00000009a408', '00000000-0000-4000-8000-00000009a201', 90, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009a202');
insert into kut.trade_offers (id, listing_id, proposer_id, seller_id, offered_coins, status, created_at, expires_at, resolved_at, proposer_idempotency_key, coins_to_seller, coins_burned, settled_card_id)
values ('00000000-0000-4000-8000-00000009a702', '00000000-0000-4000-8000-00000009a506', '00000000-0000-4000-8000-00000009a202', '00000000-0000-4000-8000-00000009a201', 80, 'accepted', now(), now() + interval '12 hours', now(), gen_random_uuid(), 76, 4, '00000000-0000-4000-8000-00000009a408');

-- An uninvolved member can read every event kind club-wide (ADR-038) --------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009a203';

select is(
  (select count(*)::int from kut.activity_feed
   where kind = 'sale' and card_name = 'Feed Fixture One'),
  1,
  'a non-participant member sees the completed sale in the feed');
select is(
  (select actor_name from kut.activity_feed where kind = 'sale' and card_name = 'Feed Fixture One'),
  'Feed Seller',
  'the sale row exposes the seller name club-wide');
select is(
  (select counterparty_name from kut.activity_feed where kind = 'sale' and card_name = 'Feed Fixture One'),
  'Feed Buyer',
  'the sale row exposes the buyer name club-wide');
select is(
  (select amount from kut.activity_feed where kind = 'sale' and card_name = 'Feed Fixture One'),
  40::bigint,
  'the sale row carries the sale price');
select is(
  (select count(*)::int from kut.activity_feed
   where kind = 'listing' and card_name = 'Feed Fixture Two'),
  1,
  'an active listing surfaces as a listing event');
select is(
  (select count(*)::int from kut.activity_feed
   where kind = 'session' and session_date = date '2099-06-01'),
  1,
  'a published session surfaces as a session event');
select is(
  (select count(*)::int from kut.activity_feed where kind = 'discard'),
  0,
  'discards are never in the feed');
select ok(
  (select bool_and(ts is not null) from kut.activity_feed),
  'every feed row has a sort timestamp');

-- ADR-073: a trade reports its FULL composition ---------------------------
select is(
  (select count(*)::int from kut.activity_feed where kind = 'trade' and card_name = 'Feed Traded'),
  1,
  'a non-participant member sees the accepted trade in the feed');
select is(
  (select amount from kut.activity_feed where kind = 'trade' and card_name = 'Feed Traded'),
  200::bigint,
  'the trade row reports the GROSS coins offered, not the post-burn receipt');
select is(
  (select offered_card_names from kut.activity_feed where kind = 'trade' and card_name = 'Feed Traded'),
  array['Feed Offered A', 'Feed Offered B'],
  'the trade row names every card offered back, alphabetically');
select is(
  (select offered_card_names from kut.activity_feed where kind = 'trade' and card_name = 'Feed Traded Solo'),
  null::text[],
  'a coins-only trade has no offered card names');
select is(
  (select amount from kut.activity_feed where kind = 'trade' and card_name = 'Feed Traded Solo'),
  80::bigint,
  'a coins-only trade still reports the gross coins');
select is(
  (select count(*)::int from kut.activity_feed
   where kind <> 'trade' and offered_card_names is not null),
  0,
  'only trade rows carry offered card names');
select is(
  (select count(*)::int from kut.market_sales sale
   join kut.trade_offers offer on offer.listing_id = sale.listing_id),
  0,
  'Part L #23: an accepted trade is never written to market_sales');

-- KB-009: a superadmin's own economy activity never surfaces club-wide -----
select is(
  (select count(*)::int from kut.activity_feed where kind = 'sale' and card_name = 'Feed Fixture Three'),
  0,
  'a sale by the superadmin is excluded from the feed');
select is(
  (select count(*)::int from kut.activity_feed where kind = 'listing' and card_name = 'Feed Fixture One' and amount = 88),
  0,
  'an active listing by the superadmin is excluded from the feed');
select is(
  (select count(*)::int from kut.activity_feed where kind = 'pack' and amount = 999),
  0,
  'a pack opened by the superadmin is excluded from the feed');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
