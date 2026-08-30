begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(47);

select has_column('kut', 'profiles', 'username', 'profiles has a username column');
select has_function('kut', 'admin_set_profile_player', array['uuid', 'uuid'], 'admin link/unlink RPC exists');
select has_function('kut', 'admin_set_account_disabled', array['uuid', 'boolean'], 'admin disable/enable RPC exists');
select has_function('kut', 'admin_prepare_account_deletion', array['uuid'], 'admin delete-prep RPC exists');
select has_function('kut', 'admin_adjust_wallet', array['uuid', 'bigint', 'text'], 'admin coin faucet RPC exists');
select has_function('kut', 'admin_reset_account', array['uuid', 'uuid'], 'admin account reset RPC exists');
select has_table('kut', 'admin_account_events', 'the admin account audit table exists');

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000009d001', 'links-admin@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009d002', 'links-member-a@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009d003', 'links-member-b@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-00000009d004', 'links-member-c@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into kut.players (id, slug, display_name, archetype)
values
  ('00000000-0000-4000-8000-00000009c001', 'links-fixture-one', 'Links Fixture One', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009c002', 'links-fixture-two', 'Links Fixture Two', 'all_rounder'),
  ('00000000-0000-4000-8000-00000009c003', 'links-fixture-three', 'Links Fixture Three', 'all_rounder');

insert into kut.profiles (id, display_name, role, player_id, username)
values
  ('00000000-0000-4000-8000-00000009d001', 'Links Admin', 'admin', null, null),
  ('00000000-0000-4000-8000-00000009d002', 'Links Member A', 'user', null, 'links_member_a'),
  ('00000000-0000-4000-8000-00000009d003', 'Links Member B', 'user', '00000000-0000-4000-8000-00000009c002', 'links_member_b'),
  ('00000000-0000-4000-8000-00000009d004', 'Links Member C', 'user', '00000000-0000-4000-8000-00000009c003', 'links_member_c');

-- admin_set_profile_player ------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d001';

select lives_ok(
  $$ select kut.admin_set_profile_player('00000000-0000-4000-8000-00000009d002', '00000000-0000-4000-8000-00000009c001'); $$,
  'an admin can link an account to a player'
);
select throws_ok(
  $$ select kut.admin_set_profile_player('00000000-0000-4000-8000-00000009d002', '00000000-0000-4000-8000-00000009c002'); $$,
  'P0001',
  'that player is already linked to another account',
  'linking to an already-linked player is rejected'
);
select lives_ok(
  $$ select kut.admin_set_profile_player('00000000-0000-4000-8000-00000009d002', null); $$,
  'an admin can unlink an account'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select player_id from kut.profiles where id = '00000000-0000-4000-8000-00000009d002'),
  null,
  'the account is now unlinked'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d002';
select throws_ok(
  $$ select kut.admin_set_profile_player('00000000-0000-4000-8000-00000009d003', null); $$,
  '42501',
  'admin access required',
  'a non-admin cannot change links'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- Attendance reward writes an inbox message ------------------------------
insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values (
  '00000000-0000-4000-8000-00000009e001',
  (select id from kut.seasons where is_active limit 1),
  date '2099-03-02',
  'monday',
  'published',
  now()
);

-- Member C is linked to player three; recording their attendance fires the
-- reward + notification trigger.
insert into kut.attendance (session_id, player_id, goals)
values ('00000000-0000-4000-8000-00000009e001', '00000000-0000-4000-8000-00000009c003', 0);

select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009d004' and reason = 'attendance_reward'),
  1,
  'the linked member was credited an attendance reward'
);
select is(
  (select count(*)::int from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-00000009d004'
     and event_type = 'attendance_reward'
     and reference_id = '00000000-0000-4000-8000-00000009e001'),
  1,
  'an attendance-reward inbox message was created for that session'
);
select ok(
  (select body from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-00000009d004' and event_type = 'attendance_reward'
   limit 1) like '%02 Mar 2099%',
  'the message names the session date'
);

-- Leaderboard excludes accounts with admin privileges -------------------
insert into kut.wallets (user_id, balance) values
  ('00000000-0000-4000-8000-00000009d001', 500),
  ('00000000-0000-4000-8000-00000009d002', 400)
on conflict (user_id) do update set balance = excluded.balance;

select is(
  (select count(*)::int from kut.club_value_leaderboard where display_name = 'Links Admin'),
  0,
  'an admin account is absent from the club value leaderboard'
);
select is(
  (select count(*)::int from kut.club_value_leaderboard where display_name = 'Links Member A'),
  1,
  'a member account with a wallet still appears on the leaderboard'
);

-- admin_set_account_disabled ------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d001';

select lives_ok(
  $$ select kut.admin_set_account_disabled('00000000-0000-4000-8000-00000009d002', true); $$,
  'an admin can disable a member account'
);
select is(
  (select is_disabled from kut.profiles where id = '00000000-0000-4000-8000-00000009d002'),
  true,
  'the account is disabled'
);
select lives_ok(
  $$ select kut.admin_set_account_disabled('00000000-0000-4000-8000-00000009d002', false); $$,
  'an admin can re-enable a member account'
);
select is(
  (select is_disabled from kut.profiles where id = '00000000-0000-4000-8000-00000009d002'),
  false,
  'the account is enabled again'
);
select throws_ok(
  $$ select kut.admin_set_account_disabled('00000000-0000-4000-8000-00000009d001', true); $$,
  'P0001',
  'you cannot change your own account here',
  'an admin cannot disable their own account'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d002';
select throws_ok(
  $$ select kut.admin_set_account_disabled('00000000-0000-4000-8000-00000009d003', true); $$,
  '42501',
  'admin access required',
  'a non-admin cannot disable an account'
);
select throws_ok(
  $$ select kut.admin_prepare_account_deletion('00000000-0000-4000-8000-00000009d003'); $$,
  '42501',
  'admin access required',
  'a non-admin cannot prepare an account deletion'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- admin_prepare_account_deletion ----------------------------------------
-- Give member B a card, a sold listing and a completed sale.
insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values ('00000000-0000-4000-8000-00000009f001', '00000000-0000-4000-8000-00000009c002', 'live', 'Links Fixture Two Live', true);
insert into kut.user_cards (id, edition_id, owner_id, source)
values ('00000000-0000-4000-8000-00000009f101', '00000000-0000-4000-8000-00000009f001', '00000000-0000-4000-8000-00000009d003', 'admin');
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009f201', '00000000-0000-4000-8000-00000009f101', '00000000-0000-4000-8000-00000009d003', 10, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009d002');
insert into kut.market_sales (listing_id, card_id, edition_id, seller_id, buyer_id, sale_price, tax_amount, seller_receipt, buyer_idempotency_key)
values ('00000000-0000-4000-8000-00000009f201', '00000000-0000-4000-8000-00000009f101', '00000000-0000-4000-8000-00000009f001', '00000000-0000-4000-8000-00000009d003', '00000000-0000-4000-8000-00000009d002', 10, 1, 9, gen_random_uuid());

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d001';

select throws_ok(
  $$ select kut.admin_prepare_account_deletion('00000000-0000-4000-8000-00000009d001'); $$,
  'P0001',
  'you cannot delete your own account',
  'an admin cannot delete their own account'
);
select throws_ok(
  $$ select kut.admin_prepare_account_deletion('00000000-0000-4000-8000-00000009d003'); $$,
  'P0001',
  'account has completed market trades - disable it instead',
  'an account with a completed trade cannot be hard-deleted'
);
-- Member C has an attendance reward but no trades; prep clears the reward row.
select lives_ok(
  $$ select kut.admin_prepare_account_deletion('00000000-0000-4000-8000-00000009d004'); $$,
  'an account with no trades can be prepared for deletion'
);
select is(
  (select count(*)::int from kut.attendance_rewards where user_id = '00000000-0000-4000-8000-00000009d004'),
  0,
  'delete-prep clears the account''s attendance-reward records'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- admin_adjust_wallet (ADR-035) ---------------------------------------------
-- Member A (d002) has a 400-coin wallet from the leaderboard fixture above.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d002';
select throws_ok(
  $$ select kut.admin_adjust_wallet('00000000-0000-4000-8000-00000009d003', 100, 'nope'); $$,
  '42501', 'admin access required',
  'a non-admin cannot adjust a wallet'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d001';
select throws_ok(
  $$ select kut.admin_adjust_wallet('00000000-0000-4000-8000-00000009d001', 100, 'self'); $$,
  'P0001', 'you cannot adjust your own wallet',
  'an admin cannot adjust their own wallet'
);
select throws_ok(
  $$ select kut.admin_adjust_wallet('00000000-0000-4000-8000-00000009d002', 100001, 'too big'); $$,
  '22023', 'amount exceeds the per-adjustment limit of 100000 KUT Coins',
  'an adjustment over the per-call cap is rejected'
);
select throws_ok(
  $$ select kut.admin_adjust_wallet('00000000-0000-4000-8000-00000009d002', -500, 'overdraw'); $$,
  'P0001', 'adjustment would drop the balance below zero',
  'an adjustment that would go below zero is rejected'
);
select lives_ok(
  $$ select kut.admin_adjust_wallet('00000000-0000-4000-8000-00000009d002', 100, 'happy path grant'); $$,
  'an admin can credit a member wallet'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-00000009d002'),
  500::bigint,
  'the wallet was credited by the adjustment amount'
);
select is(
  (select count(*)::int from kut.wallet_ledger
   where user_id = '00000000-0000-4000-8000-00000009d002' and reason = 'admin_grant'),
  1,
  'one admin_grant ledger row was written'
);
select is(
  (select count(*)::int from kut.user_notifications
   where user_id = '00000000-0000-4000-8000-00000009d002' and event_type = 'admin_notice'),
  1,
  'the member got one admin_notice inbox row'
);
select is(
  (select count(*)::int from kut.admin_account_events
   where target_user_id = '00000000-0000-4000-8000-00000009d002' and action = 'wallet_adjust'),
  1,
  'one wallet_adjust audit row was written'
);

-- admin_reset_account (ADR-035) -------------------------------------------
-- Member E: linked, with a wallet, an owned card, a completed sale as seller,
-- and an attendance reward. The reset must burn the card, zero-then-re-grant
-- the wallet to 250, and keep the trade + reward rows.
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-00000009d005', 'links-member-e@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into kut.players (id, slug, display_name, archetype)
values ('00000000-0000-4000-8000-00000009c004', 'links-fixture-four', 'Links Fixture Four', 'all_rounder');
insert into kut.profiles (id, display_name, role, player_id, username)
values ('00000000-0000-4000-8000-00000009d005', 'Links Member E', 'user', '00000000-0000-4000-8000-00000009c004', 'links_member_e');
insert into kut.card_editions (id, player_id, edition_type, title, is_live)
values ('00000000-0000-4000-8000-00000009f002', '00000000-0000-4000-8000-00000009c004', 'live', 'Links Fixture Four Live', true);
insert into kut.user_cards (id, edition_id, owner_id, source)
values ('00000000-0000-4000-8000-00000009f102', '00000000-0000-4000-8000-00000009f002', '00000000-0000-4000-8000-00000009d005', 'pack');
insert into kut.market_listings (id, card_id, seller_id, price, status, listed_at, expires_at, sold_at, buyer_id)
values ('00000000-0000-4000-8000-00000009f202', '00000000-0000-4000-8000-00000009f102', '00000000-0000-4000-8000-00000009d005', 10, 'sold', now(), now() + interval '1 day', now(), '00000000-0000-4000-8000-00000009d002');
insert into kut.market_sales (listing_id, card_id, edition_id, seller_id, buyer_id, sale_price, tax_amount, seller_receipt, buyer_idempotency_key)
values ('00000000-0000-4000-8000-00000009f202', '00000000-0000-4000-8000-00000009f102', '00000000-0000-4000-8000-00000009f002', '00000000-0000-4000-8000-00000009d005', '00000000-0000-4000-8000-00000009d002', 10, 1, 9, gen_random_uuid());
insert into kut.wallets (user_id, balance) values ('00000000-0000-4000-8000-00000009d005', 400)
on conflict (user_id) do update set balance = excluded.balance;
-- An attendance-reward guard row + its immutable ledger entry, inserted
-- directly (not via the attendance trigger, which would re-process the whole
-- session). The reset must keep the guard row so invariant #9 holds.
with led as (
  insert into kut.wallet_ledger (user_id, amount, reason, reference_type, reference_id, idempotency_key)
  values (
    '00000000-0000-4000-8000-00000009d005', 250, 'attendance_reward', 'match_session',
    '00000000-0000-4000-8000-00000009e001', 'attendance:reset-fixture:e'
  )
  returning id
)
insert into kut.attendance_rewards (session_id, player_id, user_id, ledger_id)
select '00000000-0000-4000-8000-00000009e001', '00000000-0000-4000-8000-00000009c004',
       '00000000-0000-4000-8000-00000009d005', id
from led;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d002';
select throws_ok(
  $$ select kut.admin_reset_account('00000000-0000-4000-8000-00000009d005', '00000000-0000-4000-8000-0000000ade01'); $$,
  '42501', 'admin access required',
  'a non-admin cannot reset an account'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-00000009d001';
select throws_ok(
  $$ select kut.admin_reset_account('00000000-0000-4000-8000-00000009d001', '00000000-0000-4000-8000-0000000ade02'); $$,
  'P0001', 'you cannot reset your own account',
  'an admin cannot reset their own account'
);
select lives_ok(
  $$ select kut.admin_reset_account('00000000-0000-4000-8000-00000009d005', '00000000-0000-4000-8000-0000000ade03'); $$,
  'an admin can soft-reset a member who has traded'
);
select lives_ok(
  $$ select kut.admin_reset_account('00000000-0000-4000-8000-00000009d005', '00000000-0000-4000-8000-0000000ade03'); $$,
  'replaying the same idempotency key is a no-op'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select burned_at is not null from kut.user_cards where id = '00000000-0000-4000-8000-00000009f102'),
  true,
  'the reset burned the member''s previously owned card'
);
select is(
  (select count(*)::int from kut.user_cards
   where owner_id = '00000000-0000-4000-8000-00000009d005' and burned_at is null),
  3,
  'exactly three fresh starter cards were granted (idempotent replay did not double them)'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-00000009d005'),
  250::bigint,
  'the wallet was zeroed then re-granted the 250-coin starter'
);
select is(
  (select count(*)::int from kut.market_sales where seller_id = '00000000-0000-4000-8000-00000009d005'),
  1,
  'the cross-member sale row is left intact'
);
select is(
  (select count(*)::int from kut.attendance_rewards where user_id = '00000000-0000-4000-8000-00000009d005'),
  1,
  'the attendance-reward guard row is kept (invariant #9)'
);
select is(
  (select count(*)::int from kut.admin_account_events
   where target_user_id = '00000000-0000-4000-8000-00000009d005' and action = 'account_reset'),
  1,
  'only one account_reset audit row exists after the replayed call'
);

select * from finish();

rollback;
