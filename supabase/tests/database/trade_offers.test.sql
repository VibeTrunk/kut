begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(48);

-- Schema surface (ADR-042) --------------------------------------------------
select has_table('kut', 'trade_offers', 'trade_offers table exists');
select has_table('kut', 'trade_offer_cards', 'trade_offer_cards table exists');
select has_column('kut', 'user_cards', 'held_by_offer_id', 'user_cards has the escrow-lock column');
select has_view('kut', 'my_trade_offers', 'the my_trade_offers projection exists');
select has_function('kut', 'propose_trade', array['uuid', 'bigint', 'uuid[]', 'uuid'], 'propose_trade exists');
select has_function('kut', 'respond_to_trade', array['uuid', 'boolean', 'uuid'], 'respond_to_trade exists');
select has_function('kut', 'withdraw_trade', array['uuid'], 'withdraw_trade exists');
select has_function('kut', 'expire_trade_offers', 'expire_trade_offers exists');

-- Fixtures (created as the test superuser) --------------------------------
update kut.seasons set is_active = false where is_active;
insert into kut.seasons (id, name, starts_on, is_active)
values ('0000000e-0000-4000-8000-000000000010', 'Trade Offers Test Season', date '2099-07-01', true);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000e0201', 'to-seller@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000e0202', 'to-proposer@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-0000000e0203', 'to-third@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-0000000e0101', 'to-listed-1', 'TO Listed One', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000e0102', 'to-listed-2', 'TO Listed Two', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000e0103', 'to-listed-3', 'TO Listed Three', 'all_rounder'),
  ('00000000-0000-4000-8000-0000000e0104', 'to-proposer-card', 'TO Proposer Card', 'all_rounder');

insert into kut.player_season_state (player_id, season_id, activity_score, form_score, live_ovr, pac, sho, pas, dri, def, phy, rarity_tier)
values
  ('00000000-0000-4000-8000-0000000e0101', '0000000e-0000-4000-8000-000000000010', 40, 0, 55, 55, 55, 55, 55, 55, 55, 'silver'),
  ('00000000-0000-4000-8000-0000000e0102', '0000000e-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'),
  ('00000000-0000-4000-8000-0000000e0103', '0000000e-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver'),
  ('00000000-0000-4000-8000-0000000e0104', '0000000e-0000-4000-8000-000000000010', 40, 0, 50, 50, 50, 50, 50, 50, 50, 'silver');

insert into kut.profiles (id, display_name, role, username)
values
  ('00000000-0000-4000-8000-0000000e0201', 'TO Seller', 'user', 'to_seller'),
  ('00000000-0000-4000-8000-0000000e0202', 'TO Proposer', 'user', 'to_proposer'),
  ('00000000-0000-4000-8000-0000000e0203', 'TO Third', 'user', 'to_third');

insert into kut.wallets (user_id, balance)
values
  ('00000000-0000-4000-8000-0000000e0201', 0),
  ('00000000-0000-4000-8000-0000000e0202', 1000),
  ('00000000-0000-4000-8000-0000000e0203', 1000);

insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values
  ('00000000-0000-4000-8000-0000000e0301', '00000000-0000-4000-8000-0000000e0101', 'live', 'TO Listed One Live', true),
  ('00000000-0000-4000-8000-0000000e0302', '00000000-0000-4000-8000-0000000e0102', 'live', 'TO Listed Two Live', true),
  ('00000000-0000-4000-8000-0000000e0303', '00000000-0000-4000-8000-0000000e0103', 'live', 'TO Listed Three Live', true),
  ('00000000-0000-4000-8000-0000000e0304', '00000000-0000-4000-8000-0000000e0104', 'live', 'TO Proposer Card Live', true);

insert into kut.user_cards (id, edition_id, owner_id, source)
values
  ('00000000-0000-4000-8000-0000000e0401', '00000000-0000-4000-8000-0000000e0301', '00000000-0000-4000-8000-0000000e0201', 'pack'),
  ('00000000-0000-4000-8000-0000000e0402', '00000000-0000-4000-8000-0000000e0302', '00000000-0000-4000-8000-0000000e0201', 'pack'),
  ('00000000-0000-4000-8000-0000000e0403', '00000000-0000-4000-8000-0000000e0303', '00000000-0000-4000-8000-0000000e0201', 'pack'),
  ('00000000-0000-4000-8000-0000000e0404', '00000000-0000-4000-8000-0000000e0304', '00000000-0000-4000-8000-0000000e0202', 'pack');

insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at)
values
  ('00000000-0000-4000-8000-0000000e0501', '00000000-0000-4000-8000-0000000e0401', '00000000-0000-4000-8000-0000000e0201', 200, 'active', now(), now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000e0502', '00000000-0000-4000-8000-0000000e0402', '00000000-0000-4000-8000-0000000e0201', 100, 'active', now(), now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000e0503', '00000000-0000-4000-8000-0000000e0403', '00000000-0000-4000-8000-0000000e0201', 120, 'active', now(), now() + interval '1 day');

-- The RPCs are security definer and only read auth.uid() (request.jwt.claim.sub);
-- they do not require the `authenticated` role, so every call and assertion here
-- runs as the test superuser and sees final state without RLS in the way.

-- === Scenario 1: propose coins + a card, then accept ======================
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select lives_ok($$
  select kut.propose_trade(
    '00000000-0000-4000-8000-0000000e0501',
    150,
    array['00000000-0000-4000-8000-0000000e0404']::uuid[],
    '00000000-0000-4000-8000-0000000eaa01'
  )
$$, 'proposer can make a coins + card offer');

select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  850::bigint,
  'the offered coins left the proposer wallet at propose time');
select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-0000000e0202' and reason = 'trade_escrow'),
  1,
  'a trade_escrow ledger row was written');
select is(
  (select held_by_offer_id is not null from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0404'),
  true,
  'the offered card is locked by the offer');
select is(
  (select count(*)::int from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-0000000e0201' and event_type = 'trade_offer'),
  1,
  'the seller was notified of the new offer');

-- Held-card guards (still acting as the proposer/owner)
select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-0000000e0404', 40) $$,
  'P0001', 'card is committed to a pending trade offer',
  'a held card cannot be listed');
select throws_ok(
  $$ select kut.discard_card('00000000-0000-4000-8000-0000000e0404', '00000000-0000-4000-8000-0000000eff01') $$,
  'P0001', 'card is committed to a pending trade offer',
  'a held card cannot be discarded');

-- A non-seller cannot respond
select throws_ok(
  $$ select kut.respond_to_trade(
       (select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa01'),
       true, '00000000-0000-4000-8000-0000000ebb99') $$,
  '42501', 'only the listing seller can respond to this offer',
  'a non-seller cannot respond to an offer');

-- Seller accepts
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0201';
select lives_ok($$
  select kut.respond_to_trade(
    (select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa01'),
    true, '00000000-0000-4000-8000-0000000ecc01')
$$, 'the seller can accept the offer');

select is(
  (select owner_id from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0401'),
  '00000000-0000-4000-8000-0000000e0202'::uuid,
  'the listed card moved to the proposer');
select is(
  (select owner_id from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0404'),
  '00000000-0000-4000-8000-0000000e0201'::uuid,
  'the offered card moved to the seller');
select is(
  (select held_by_offer_id from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0404'),
  null,
  'the offered card hold was released on accept');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0201'),
  142::bigint,
  'the seller received the offered coins minus the 5% burn (150 - 8)');
select is(
  (select status from kut.market_listings where id = '00000000-0000-4000-8000-0000000e0501'),
  'sold',
  'the listing is marked sold');
select is(
  (select status || ':' || coins_to_seller || ':' || coins_burned
   from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa01'),
  'accepted:142:8',
  'the offer records accepted with the split');
select is(
  (select count(*)::int from kut.market_sales where listing_id = '00000000-0000-4000-8000-0000000e0501'),
  0,
  'an accepted trade is NOT written to market_sales (reference value unaffected)');
select is(
  (select count(*)::int from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-0000000e0202' and event_type = 'trade_response'),
  1,
  'the proposer was notified of the acceptance');

-- === Scenario 2: sibling offers, one accept refunds the rest =============
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0502', 80, '{}'::uuid[], '00000000-0000-4000-8000-0000000eaa02');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0203';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0502', 90, '{}'::uuid[], '00000000-0000-4000-8000-0000000eaa03');

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0201';
select kut.respond_to_trade(
  (select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa03'),
  true, '00000000-0000-4000-8000-0000000ecc03');

select is(
  (select status from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa02'),
  'rejected',
  'the losing sibling offer was auto-rejected');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  850::bigint,
  'the losing proposer was refunded (back to 850 after scenario 1)');
select is(
  (select owner_id from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0402'),
  '00000000-0000-4000-8000-0000000e0203'::uuid,
  'the winning proposer received the card');

-- === Scenario 3: withdraw refunds the escrow ============================
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0503', 60, '{}'::uuid[], '00000000-0000-4000-8000-0000000eaa04');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  790::bigint,
  'the escrow left the wallet on propose (850 - 60)');
select kut.withdraw_trade(
  (select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa04'));
select is(
  (select status from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa04'),
  'withdrawn',
  'the offer is withdrawn');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  850::bigint,
  'withdraw refunded the escrow');

-- === Scenario 4: expiry sweep refunds ==================================
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0203';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0503', 70, '{}'::uuid[], '00000000-0000-4000-8000-0000000eaa05');
reset role;
update kut.trade_offers set expires_at = now() - interval '1 hour'
where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa05';

select set_config('request.jwt.claim.sub', '', true);
select is(kut.expire_trade_offers(), 1, 'the expiry sweep resolved one due offer');
select is(
  (select status from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa05'),
  'expired',
  'the due offer is marked expired');
-- TO Third started at 1000, spent 90 winning the scenario-2 accept, and the
-- scenario-4 offer (70) was refunded by the sweep -> 910.
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0203'),
  910::bigint,
  'the expired offer refunded its escrow');

-- === Scenario 5: explicit decline refunds ==============================
-- L3 (00000000-0000-4000-8000-0000000e0503) is still active.
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0503', 45, '{}'::uuid[], '00000000-0000-4000-8000-0000000eaa06');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0201';
select kut.respond_to_trade(
  (select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa06'),
  false, '00000000-0000-4000-8000-0000000ecc06');
select is(
  (select status from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa06'),
  'rejected', 'an explicit decline marks the offer rejected');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  850::bigint, 'an explicit decline refunds the escrow');
select is(
  (select status from kut.market_listings where id = '00000000-0000-4000-8000-0000000e0503'),
  'active', 'the listing is still active after a decline');

-- === Scenario 6: cancelling a listing unwinds its pending offers =======
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select kut.propose_trade('00000000-0000-4000-8000-0000000e0503', 55,
  array['00000000-0000-4000-8000-0000000e0401']::uuid[], '00000000-0000-4000-8000-0000000eaa07');
select is(
  (select held_by_offer_id is not null from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0401'),
  true, 'the proposer card is held while the offer is pending');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0201';
select kut.cancel_listing('00000000-0000-4000-8000-0000000e0503');
select is(
  (select status from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa07'),
  'rejected', 'cancelling the listing auto-rejected the pending offer');
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-0000000e0202'),
  850::bigint, 'cancelling the listing refunded the escrowed coins');
select is(
  (select held_by_offer_id from kut.user_cards where id = '00000000-0000-4000-8000-0000000e0401'),
  null, 'cancelling the listing released the escrowed card');

-- === Guard checks: self-offer, coin ceiling, empty offer ==============
-- L2 was sold in scenario 2; re-open it (still owned on paper by the seller)
-- so the guards below hit their own checks rather than "listing not active".
reset role;
select set_config('request.jwt.claim.sub', '', true);
update kut.market_listings set status = 'active', sold_at = null, buyer_id = null
where id = '00000000-0000-4000-8000-0000000e0502';

set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0201';
select throws_ok(
  $$ select kut.propose_trade('00000000-0000-4000-8000-0000000e0502', 10, '{}'::uuid[], '00000000-0000-4000-8000-0000000ead01') $$,
  'P0001', 'you cannot make an offer on your own listing',
  'a seller cannot offer on their own listing');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0203';
select throws_ok(
  $$ select kut.propose_trade('00000000-0000-4000-8000-0000000e0502', 999999, '{}'::uuid[], '00000000-0000-4000-8000-0000000ead03') $$,
  '22023', 'offered coins exceed the allowed maximum for this card',
  'a coin offer above the ceiling is rejected');
select throws_ok(
  $$ select kut.propose_trade('00000000-0000-4000-8000-0000000e0502', 0, '{}'::uuid[], '00000000-0000-4000-8000-0000000ead04') $$,
  'P0001', 'an offer must include coins or at least one card',
  'an offer of nothing is rejected');

-- === my_trade_offers projection shape ================================
reset role;
select set_config('request.jwt.claim.sub', '', true);
select has_column('kut', 'my_trade_offers', 'offered_cards', 'the offers view exposes the offered-card list');
select has_column('kut', 'my_trade_offers', 'is_outgoing', 'the offers view marks direction');
set local request.jwt.claim.sub = '00000000-0000-4000-8000-0000000e0202';
select is(
  (select count(*)::int from kut.my_trade_offers where offer_id in (
    select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa01')),
  1, 'the proposer sees their accepted offer in my_trade_offers');
select is(
  (select is_outgoing from kut.my_trade_offers where offer_id in (
    select id from kut.trade_offers where proposer_idempotency_key = '00000000-0000-4000-8000-0000000eaa01')),
  true, 'the proposer''s own offer is flagged outgoing');

select * from finish();

rollback;
