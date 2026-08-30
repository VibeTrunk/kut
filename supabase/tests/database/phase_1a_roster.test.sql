begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;

select plan(163);

select has_table('kut', 'players', 'players table exists');
select has_table('kut', 'match_sessions', 'match sessions table exists');
select has_table('kut', 'attendance', 'attendance table exists');
select has_table('kut', 'player_season_state', 'derived player state table exists');
select has_view('kut', 'public_live_ratings', 'public live ratings view exists');
select has_view('kut', 'my_collection_cards', 'private collection view exists');
select has_table('kut', 'invitations', 'invitations table exists');
select has_table('kut', 'session_corrections', 'session correction audit table exists');
select has_table('kut', 'session_status_events', 'session status audit table exists');
select has_table('kut', 'card_editions', 'card editions table exists');
select has_table('kut', 'user_cards', 'individual user cards table exists');
select has_table('kut', 'wallets', 'wallets table exists');
select has_table('kut', 'wallet_ledger', 'immutable wallet ledger table exists');
select has_table('kut', 'attendance_rewards', 'attendance reward idempotency table exists');
select has_table('kut', 'pack_definitions', 'pack definitions table exists');
select has_table('kut', 'pack_openings', 'pack opening audit table exists');
select has_table('kut', 'pack_opening_cards', 'persisted pack result table exists');
select has_table('kut', 'market_listings', 'market listings table exists');
select has_table('kut', 'market_sales', 'immutable market sales table exists');
select has_table('kut', 'user_notifications', 'private user notifications table exists');
select has_table('kut', 'password_reset_events', 'password reset audit table exists');
select has_view('kut', 'active_pack_offers', 'active pack offers view exists');
select has_view('kut', 'my_pack_opening_results', 'private pack result view exists');
select has_view('kut', 'pack_economy_health', 'admin pack economy health view exists');
select has_view('kut', 'active_market_listings', 'active market listings view exists');
select has_view('kut', 'my_club_value', 'private club value view exists');
select has_view('kut', 'club_value_leaderboard', 'club value leaderboard view exists');
select has_function(
  'kut',
  'claim_invitation',
  array['text', 'uuid', 'text'],
  'invite claim function exists'
);
select has_function(
  'kut',
  'publish_attendance_session',
  array['uuid', 'date', 'text', 'jsonb'],
  'atomic attendance publication function exists'
);
select has_function(
  'kut',
  'correct_published_attendance_session',
  array['uuid', 'date', 'text', 'jsonb', 'text'],
  'published attendance correction function exists'
);
select has_function(
  'kut',
  'cancel_published_session',
  array['uuid', 'text'],
  'published session cancellation function exists'
);
select has_function(
  'kut',
  'reactivate_cancelled_session',
  array['uuid', 'text'],
  'cancelled session reactivation function exists'
);
select has_function(
  'kut',
  'claim_starter_pack',
  array[]::text[],
  'starter claim function exists'
);
select has_function(
  'kut',
  'discard_card',
  array['uuid', 'uuid'],
  'server-authoritative card discard function exists'
);
select has_function(
  'kut',
  'open_pack',
  array['text', 'uuid'],
  'server-authoritative pack opening function exists'
);
select has_function('kut', 'get_listing_bounds', array['uuid'], 'listing-bound calculation function exists');
select has_function('kut', 'create_listing', array['uuid', 'bigint'], 'listing creation function exists');
select has_function('kut', 'cancel_listing', array['uuid'], 'listing cancellation function exists');
select has_function('kut', 'buy_listing', array['uuid', 'uuid'], 'atomic market purchase function exists');
select has_function('kut', 'mark_notifications_read', array['uuid[]'], 'notification read-state function exists');
select has_function(
  'kut',
  'create_password_reset_event',
  array['uuid', 'text'],
  'password reset audit creation function exists'
);
select has_function(
  'kut',
  'complete_password_reset_event',
  array['uuid', 'boolean'],
  'password reset audit completion function exists'
);
select is(
  (select relrowsecurity from pg_class where oid = 'kut.players'::regclass),
  true,
  'RLS is active for players'
);

insert into kut.match_sessions (id, season_id, session_date, session_type, status)
values (
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000010',
  '2099-01-07',
  'friday',
  'draft'
);

select throws_ok(
  $$
    insert into kut.attendance (session_id, player_id)
    values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001');
    insert into kut.attendance (session_id, player_id)
    values ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000001');
  $$,
  '23505',
  'duplicate key value violates unique constraint "attendance_session_id_player_id_key"',
  'only one attendance row exists per player and session'
);

set local role authenticated;
select lives_ok(
  $$ select count(*) from kut.players; $$,
  'authenticated users can read the fictional roster'
);
reset role;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000098',
  'correction-admin@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into kut.profiles (id, display_name, role)
values ('00000000-0000-4000-8000-000000000098', 'Correction Admin', 'admin');

insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
values (
  '00000000-0000-4000-8000-000000000030',
  '00000000-0000-4000-8000-000000000010',
  '2099-01-09',
  'friday',
  'published',
  now()
);

insert into kut.attendance (session_id, player_id, goals)
values ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000001', 0);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$
    select kut.correct_published_attendance_session(
      '00000000-0000-4000-8000-000000000030',
      '2099-01-12',
      'monday',
      '[{"player_id":"00000000-0000-4000-8000-000000000002","goals":2}]'::jsonb,
      'Alex was selected by mistake.'
    );
  $$,
  'an admin can correct a published session'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select session_date from kut.match_sessions where id = '00000000-0000-4000-8000-000000000030'),
  '2099-01-12'::date,
  'a correction updates the published session date'
);
select is(
  (select goals from kut.attendance where session_id = '00000000-0000-4000-8000-000000000030'),
  2,
  'a correction replaces the published attendance'
);
select is(
  (select previous_attendance -> 0 ->> 'player_id' from kut.session_corrections where session_id = '00000000-0000-4000-8000-000000000030'),
  '00000000-0000-4000-8000-000000000001',
  'the previous attendance is retained in the audit record'
);
select is(
  (select corrected_by from kut.session_corrections where session_id = '00000000-0000-4000-8000-000000000030'),
  '00000000-0000-4000-8000-000000000098'::uuid,
  'the correction audit records its admin'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is(
  (select count(*) from kut.session_corrections where session_id = '00000000-0000-4000-8000-000000000030'),
  1::bigint,
  'an admin can read the correction audit record'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$
    select kut.cancel_published_session(
      '00000000-0000-4000-8000-000000000030',
      'This test session was entered accidentally.'
    );
  $$,
  'an admin can cancel a published session'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select status from kut.match_sessions where id = '00000000-0000-4000-8000-000000000030'),
  'cancelled',
  'a cancelled session is retained instead of deleted'
);
select ok(
  (select published_at is null and cancelled_at is not null from kut.match_sessions where id = '00000000-0000-4000-8000-000000000030'),
  'a cancelled session no longer counts as published'
);
select is(
  (select cancellation_reason from kut.match_sessions where id = '00000000-0000-4000-8000-000000000030'),
  'This test session was entered accidentally.',
  'the cancellation reason is retained'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$
    select kut.correct_published_attendance_session(
      '00000000-0000-4000-8000-000000000030',
      '2099-01-12',
      'monday',
      '[{"player_id":"00000000-0000-4000-8000-000000000002","goals":3}]'::jsonb,
      'Correcting the record before reactivating it.'
    );
  $$,
  'an admin can edit a cancelled session before reactivation'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select goals from kut.attendance where session_id = '00000000-0000-4000-8000-000000000030'),
  3,
  'a cancelled session retains editable attendance'
);

select lives_ok(
  $$
    insert into kut.match_sessions (id, season_id, session_date, session_type, status)
    values (
      '00000000-0000-4000-8000-000000000031',
      '00000000-0000-4000-8000-000000000010',
      '2099-01-12',
      'monday',
      'draft'
    );
  $$,
  'a cancelled session no longer blocks a new session in its date/type slot'
);

update kut.match_sessions
set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Test duplicate slot cleanup.'
where id = '00000000-0000-4000-8000-000000000031';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$
    select kut.reactivate_cancelled_session(
      '00000000-0000-4000-8000-000000000030',
      'The original session was valid after all.'
    );
  $$,
  'an admin can reactivate a cancelled session'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select status from kut.match_sessions where id = '00000000-0000-4000-8000-000000000030'),
  'published',
  'a reactivated session returns to published status'
);
select is(
  (select count(*) from kut.session_status_events where session_id = '00000000-0000-4000-8000-000000000030'),
  2::bigint,
  'cancellation and reactivation are both retained in the status audit'
);

set local role authenticated;
select throws_ok(
  $$ select kut.claim_invitation(repeat('a', 64), '00000000-0000-4000-8000-000000000099', 'claimtester'); $$,
  '42501',
  'permission denied for function claim_invitation',
  'an authenticated browser caller cannot claim an invitation directly'
);
reset role;

set local role authenticated;
select throws_ok(
  $$
    select kut.correct_published_attendance_session(
      '00000000-0000-4000-8000-000000000030',
      '2099-01-12',
      'monday',
      '[{"player_id":"00000000-0000-4000-8000-000000000002","goals":0}]'::jsonb,
      'Not an admin.'
    );
  $$,
  '42501',
  'admin access required',
  'a non-admin cannot correct published attendance'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select kut.cancel_published_session('00000000-0000-4000-8000-000000000030', 'Not an admin.'); $$,
  '42501',
  'admin access required',
  'a non-admin cannot cancel a published session'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ select kut.reactivate_cancelled_session('00000000-0000-4000-8000-000000000030', 'Not an admin.'); $$,
  '42501',
  'admin access required',
  'a non-admin cannot reactivate a cancelled session'
);
reset role;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000099',
  'invite-claim-test@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into kut.invitations (player_id, token_hash)
values ('00000000-0000-4000-8000-000000000003', repeat('c', 64));

set local role service_role;
select lives_ok(
  $$ select kut.claim_invitation(repeat('c', 64), '00000000-0000-4000-8000-000000000099', 'ClaimUser_1'); $$,
  'the server-only claim function accepts a valid invitation'
);
reset role;

select is(
  (select player_id from kut.profiles where id = '00000000-0000-4000-8000-000000000099'),
  '00000000-0000-4000-8000-000000000003'::uuid,
  'claim links the new user profile to the invited player'
);
select is(
  (select username from kut.profiles where id = '00000000-0000-4000-8000-000000000099'),
  'claimuser_1',
  'claim stores the chosen username in lower case'
);
select is(
  (select consumed_by from kut.invitations where token_hash = repeat('c', 64)),
  '00000000-0000-4000-8000-000000000099'::uuid,
  'claim permanently consumes the invitation'
);
select ok(
  (select starter_claimed_at is not null from kut.profiles where id = '00000000-0000-4000-8000-000000000099'),
  'invite onboarding atomically claims the starter pack'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'),
  250::bigint,
  'starter claim grants exactly 250 coins'
);
select is(
  (select count(*) from kut.wallet_ledger where user_id = '00000000-0000-4000-8000-000000000099' and reason = 'starter'),
  1::bigint,
  'starter claim creates one ledger entry'
);
select is(
  (select count(*) from kut.user_cards where owner_id = '00000000-0000-4000-8000-000000000099' and source = 'starter'),
  3::bigint,
  'starter claim creates exactly three cards'
);
select is(
  (select count(distinct edition_id) from kut.user_cards where owner_id = '00000000-0000-4000-8000-000000000099' and source = 'starter'),
  3::bigint,
  'starter cards are distinct editions'
);
-- ADR-033 retired the untradeable concept: starter cards are ordinary copies.
-- The former "starter cards cannot be discarded / listed" assertions are gone;
-- discard/list eligibility now depends only on the universal rules (owned,
-- unburned, has a rating, no active listing), covered by the pack/special
-- fixtures below.

insert into kut.card_editions (
  id, player_id, edition_type, title, is_live,
  snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy,
  special_discard_multiplier
)
values (
  '00000000-0000-4000-8000-000000000050',
  '00000000-0000-4000-8000-000000000001',
  'totw', 'Discard Fixture', false,
  40, 40, 40, 40, 40, 40, 40,
  1.5
);
insert into kut.user_cards (id, edition_id, owner_id, source)
values (
  '00000000-0000-4000-8000-000000000051',
  '00000000-0000-4000-8000-000000000050',
  '00000000-0000-4000-8000-000000000099',
  'pack'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is(
  (select (kut.discard_card(
    '00000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000091'
  ) ->> 'coins')::bigint),
  32::bigint,
  'discard calculates the configured frozen-special value on the server'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select ok(
  (select burned_at is not null from kut.user_cards where id = '00000000-0000-4000-8000-000000000051'),
  'discard marks the card copy burned instead of deleting it'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'),
  282::bigint,
  'discard atomically credits the wallet'
);
select is(
  (select count(*) from kut.wallet_ledger where reference_id = '00000000-0000-4000-8000-000000000051' and reason = 'discard'),
  1::bigint,
  'discard creates exactly one immutable ledger record'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is(
  (select count(*) from kut.my_collection_cards where card_id = '00000000-0000-4000-8000-000000000051'),
  0::bigint,
  'a burned card no longer appears in the collection projection'
);
select is(
  (select (kut.discard_card(
    '00000000-0000-4000-8000-000000000051',
    '00000000-0000-4000-8000-000000000091'
  ) ->> 'coins')::bigint),
  32::bigint,
  'repeating the same discard key returns the original result without a second payout'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'),
  282::bigint,
  'an idempotent retry cannot duplicate the discard credit'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select lives_ok(
  $$ select kut.open_pack('tfh-pack', '00000000-0000-4000-8000-000000000092'); $$,
  'opening a pack persists its result before it is returned to the client'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from kut.pack_openings where user_id = '00000000-0000-4000-8000-000000000099'),
  1::bigint,
  'a successful opening creates one opening audit record'
);
select is(
  (select count(*) from kut.pack_opening_cards where opening_id = (select id from kut.pack_openings where user_id = '00000000-0000-4000-8000-000000000099')),
  3::bigint,
  'a TFH Pack creates exactly three persisted result cards'
);
select is(
  (select count(*) from kut.user_cards card join kut.pack_opening_cards result on result.card_id = card.id where card.owner_id = '00000000-0000-4000-8000-000000000099' and card.source = 'pack'),
  3::bigint,
  'pack result cards are copies owned by the opener'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'),
  32::bigint,
  'opening a pack debits its server-defined price exactly once'
);
select is(
  (select amount from kut.wallet_ledger where user_id = '00000000-0000-4000-8000-000000000099' and reason = 'pack_purchase'),
  (-250)::bigint,
  'pack payment has a matching negative immutable ledger entry'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select ok(
  (select (kut.open_pack('tfh-pack', '00000000-0000-4000-8000-000000000092') ->> 'opening_id')::uuid =
    (select id from kut.pack_openings where user_id = auth.uid() and idempotency_key = '00000000-0000-4000-8000-000000000092')),
  'repeating a pack key returns the saved opening rather than rerolling'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'),
  32::bigint,
  'a repeated pack key cannot debit coins twice'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select throws_ok(
  $$ select kut.open_pack('tfh-pack', '00000000-0000-4000-8000-000000000093'); $$,
  'P0001',
  'insufficient TF Coins for this pack',
  'insufficient balance cannot create a second pack opening'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from kut.pack_openings where user_id = '00000000-0000-4000-8000-000000000099'),
  1::bigint,
  'a failed pack payment leaves no opening record'
);

insert into kut.card_editions (
  id, player_id, edition_type, title, is_live,
  snapshot_ovr, snapshot_pac, snapshot_sho, snapshot_pas, snapshot_dri, snapshot_def, snapshot_phy,
  special_discard_multiplier
) values (
  '00000000-0000-4000-8000-000000000060',
  '00000000-0000-4000-8000-000000000001', 'totw', 'Market Fixture', false,
  40, 40, 40, 40, 40, 40, 40, 1
);
insert into kut.user_cards (id, edition_id, owner_id, source)
values ('00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000060', '00000000-0000-4000-8000-000000000099', 'pack');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is(
  (select (kut.get_listing_bounds('00000000-0000-4000-8000-000000000061') ->> 'minimum_price')::bigint),
  17::bigint,
  'listing bounds use the current server-calculated discard value'
);
select throws_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-000000000061', 166); $$,
  '22023', 'listing price is outside the current allowed range', 'listing price cannot exceed the server maximum'
);
select lives_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-000000000061', 100); $$,
  'an owner can create an in-range listing for an owned card'
);
select throws_ok(
  $$ select kut.discard_card('00000000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000094'); $$,
  'P0001', 'card has an active market listing', 'an active listing locks the card against discard'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is(
  (select count(*) from kut.active_market_listings where listing_id = (select id from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061')),
  1::bigint,
  'a different signed-in member can browse the narrow active market projection'
);
select is(
  (select seller_display_name from kut.active_market_listings where listing_id = (select id from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061')),
  'Charlie Fixture',
  'the active market projection exposes the seller display name'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select lives_ok(
  $$ select kut.cancel_listing((select id from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061' and status = 'active')); $$,
  'the seller can cancel an unsold listing'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select is(
  (select status from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061' order by listed_at limit 1),
  'cancelled', 'cancellation preserves listing history'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select lives_ok(
  $$ select kut.create_listing('00000000-0000-4000-8000-000000000061', 20); $$,
  'a cancelled card can be listed again'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into kut.wallets (user_id, balance)
values ('00000000-0000-4000-8000-000000000098', 75)
on conflict (user_id) do update set balance = excluded.balance;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$ select kut.buy_listing(
    (select id from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061' and status = 'active'),
    '00000000-0000-4000-8000-000000000095'
  ); $$,
  'a funded buyer can atomically purchase an active listing'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is((select status from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061' and status = 'sold'), 'sold', 'purchase marks the listing sold');
select is((select owner_id from kut.user_cards where id = '00000000-0000-4000-8000-000000000061'), '00000000-0000-4000-8000-000000000098'::uuid, 'purchase transfers the one card copy to the buyer');
select ok((select tax_amount = 1 and seller_receipt = 19 from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061'), 'market tax rounds up to five percent with a one-coin minimum');
select is((select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000098'), 55::bigint, 'buyer wallet is debited the full sale price');
select is((select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000099'), 51::bigint, 'seller receives sale price minus tax');
select is((select sum(amount)::bigint from kut.wallet_ledger where reference_type = 'market_sale' and reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), (-1)::bigint, 'market ledgers reconcile the one-coin tax burn');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is((select card_count from kut.my_club_value), 1, 'club value includes the buyer''s active card copy');
select ok((select club_value > wallet_balance from kut.my_club_value), 'club value includes card reference value in addition to wallet coins');
select ok((select not exists (select 1 from kut.club_value_leaderboard where display_name = 'Correction Admin')), 'an account with admin privileges is excluded from the club value leaderboard');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is((select event_type from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), 'market_sale', 'the seller receives a market sale notification');
select ok((select position('Correction Admin' in body) > 0 from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), 'the seller notification names the buyer');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is((select event_type from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), 'market_purchase', 'the buyer receives a market purchase notification');
select lives_ok($$ select kut.mark_notifications_read(array[(select id from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061'))]); $$, 'a member can mark their own notification as read');
select ok((select read_at is not null from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), 'marking a message read does not require direct table updates');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$ select kut.buy_listing(
    (select id from kut.market_listings where card_id = '00000000-0000-4000-8000-000000000061' and status = 'sold'),
    '00000000-0000-4000-8000-000000000095'
  ); $$,
  'repeating a purchase key returns the persisted market sale'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select is((select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000098'), 55::bigint, 'purchase retry cannot debit the buyer twice');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is((select count(*) from kut.user_notifications where reference_id = (select id from kut.market_sales where card_id = '00000000-0000-4000-8000-000000000061')), 1::bigint, 'purchase retry cannot create a duplicate buyer message');
select is(kut.mark_notifications_read(array[(select id from kut.user_notifications where user_id = '00000000-0000-4000-8000-000000000099')]), 0, 'a member cannot mark another member''s message read');
select throws_ok(
  $$ update kut.user_notifications set read_at = now() where user_id = '00000000-0000-4000-8000-000000000099'; $$,
  '42501', 'permission denied for table user_notifications', 'a browser caller cannot directly update another member''s messages'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select ok((select read_at is null from kut.user_notifications where user_id = '00000000-0000-4000-8000-000000000099'), 'another member''s unread state remains unchanged');

update kut.wallets set balance = 0 where user_id = '00000000-0000-4000-8000-000000000098';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select ok(
  (select expected_discard_return_ratio is not null and eligible_live_count >= 3 from kut.pack_economy_health where slug = 'tfh-pack'),
  'an admin can read the current weighted pack economy health'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is(
  (select count(*) from kut.pack_economy_health),
  0::bigint,
  'a normal member cannot read the admin economy projection'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select throws_ok(
  $$ update kut.user_cards
     set burned_at = now()
     where id = (select id from kut.user_cards where owner_id = auth.uid() and burned_at is null limit 1); $$,
  '42501',
  'permission denied for table user_cards',
  'a browser caller cannot burn a card directly'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select is(
  (select count(*) from kut.my_collection_cards where source = 'starter'),
  3::bigint,
  'a member can read their three starter cards through the private collection view'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select is(
  (select count(*) from kut.my_collection_cards where card_id in (
    select id from kut.user_cards where owner_id = '00000000-0000-4000-8000-000000000099' and source = 'starter'
  )),
  0::bigint,
  'the private collection view does not expose another member starter cards to an admin'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000099';
select throws_ok(
  $$ select kut.claim_starter_pack(); $$,
  'P0001',
  'starter pack already claimed',
  'starter claim is idempotent for an already-onboarded user'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

insert into kut.players (id, slug, display_name, archetype)
values ('00000000-0000-4000-8000-000000000004', 'reward-fixture', 'Reward Fixture', 'all_rounder');

update kut.profiles
set player_id = '00000000-0000-4000-8000-000000000004'
where id = '00000000-0000-4000-8000-000000000098';
insert into kut.match_sessions (id, season_id, session_date, session_type, status, created_by)
values (
  '00000000-0000-4000-8000-000000000040',
  '00000000-0000-4000-8000-000000000010',
  '2099-02-01',
  'monday',
  'draft',
  '00000000-0000-4000-8000-000000000098'
);
insert into kut.attendance (session_id, player_id, goals)
values ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000004', 0);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$ select kut.publish_session('00000000-0000-4000-8000-000000000040'); $$,
  'publishing an attended session processes attendance rewards'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000098'),
  250::bigint,
  'attendance reward credits exactly 250 coins'
);
select is(
  (select count(*) from kut.attendance_rewards where session_id = '00000000-0000-4000-8000-000000000040' and player_id = '00000000-0000-4000-8000-000000000004'),
  1::bigint,
  'attendance reward creates one idempotency record per player/session'
);

update kut.attendance set goals = 1
where session_id = '00000000-0000-4000-8000-000000000040';

select is(
  (select count(*) from kut.wallet_ledger where user_id = '00000000-0000-4000-8000-000000000098' and reason = 'attendance_reward'),
  1::bigint,
  'reprocessing published attendance does not duplicate its ledger reward'
);
select is(
  (select balance from kut.wallets where user_id = '00000000-0000-4000-8000-000000000098'),
  250::bigint,
  'reprocessing published attendance does not duplicate wallet coins'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$ select kut.create_password_reset_event('00000000-0000-4000-8000-000000000099', 'Member asked for local password recovery.'); $$,
  'an admin can record a password reset attempt for a normal user'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select status from kut.password_reset_events where target_user_id = '00000000-0000-4000-8000-000000000099'),
  'pending',
  'a password reset audit starts pending before Auth is changed'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok(
  $$
    select kut.complete_password_reset_event(
      (select id from kut.password_reset_events where target_user_id = '00000000-0000-4000-8000-000000000099'),
      true
    );
  $$,
  'the creating admin can complete the password reset audit'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select status from kut.password_reset_events where target_user_id = '00000000-0000-4000-8000-000000000099'),
  'completed',
  'a completed password reset audit never records a password'
);

set local role authenticated;
select throws_ok(
  $$ select kut.create_password_reset_event('00000000-0000-4000-8000-000000000099', 'No privileges.'); $$,
  '42501',
  'admin access required',
  'a normal user cannot create a password reset audit event'
);
reset role;

set local role authenticated;
select throws_ok(
  $$ insert into kut.wallets (user_id, balance) values ('00000000-0000-4000-8000-000000000099', 999999); $$,
  '42501',
  'permission denied for table wallets',
  'an authenticated browser caller cannot mint wallet coins directly'
);
reset role;

select throws_ok(
  $$
    insert into kut.invitations (player_id, token_hash)
    values ('00000000-0000-4000-8000-000000000001', repeat('b', 64));
    insert into kut.invitations (player_id, token_hash)
    values ('00000000-0000-4000-8000-000000000002', repeat('b', 64));
  $$,
  '23505',
  'duplicate key value violates unique constraint "invitations_token_hash_key"',
  'only one invitation can have a token hash'
);

set local role anon;
select throws_ok(
  $$ select * from kut.public_live_ratings; $$,
  '42501',
  'permission denied for view public_live_ratings',
  'anonymous users cannot read Live Ratings'
);
select throws_ok(
  $$ select * from kut.players; $$,
  '42501',
  'permission denied for table players',
  'anonymous users cannot read the roster'
);
reset role;

set local role authenticated;
select throws_ok(
  $$
    select kut.publish_attendance_session(
      '00000000-0000-4000-8000-000000000010',
      '2026-08-14',
      'friday',
      '[{"player_id":"00000000-0000-4000-8000-000000000001","goals":0}]'::jsonb
    );
  $$,
  '42501',
  'admin access required',
  'a non-admin cannot publish attendance'
);
reset role;

-- admin_add_player
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';
select lives_ok($$ select kut.admin_add_player('Test Newbie', 'speedster') $$,
  'an admin can add a player');
select is((select archetype from kut.players where slug = 'test-newbie'),
  'speedster', 'archetype is stored');
select is((select count(*) from kut.card_editions ce
           join kut.players p on p.id = ce.player_id
           where p.slug = 'test-newbie' and ce.is_live), 1::bigint,
  'a Live edition is created for the new player');
select is((select count(*) from kut.player_season_state pss
           join kut.players p on p.id = pss.player_id
           where p.slug = 'test-newbie'), 1::bigint,
  'a baseline season-state row exists after add');
select lives_ok($$ select kut.admin_add_player('Test Newbie', 'defender') $$,
  'a duplicate display name is allowed');
select is((select count(*) from kut.players where slug in ('test-newbie','test-newbie-2')),
  2::bigint, 'slug collision is suffixed');
select throws_ok($$ select kut.admin_add_player('   ', 'all_rounder') $$,
  '22023', null, 'blank display name is rejected');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select throws_ok($$ select kut.admin_add_player('Nope', 'all_rounder') $$,
  '42501', 'admin access required',
  'a non-admin cannot add a player');
reset role;

-- admin_set_player_active / admin_delete_player
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000098';

select lives_ok($$ select kut.admin_set_player_active(
    (select id from kut.players where slug = 'test-newbie'), false) $$,
  'an admin can deactivate a player');
select is((select is_active from kut.players where slug = 'test-newbie'), false,
  'deactivation clears is_active');
select is((select count(*) from kut.public_live_ratings where slug = 'test-newbie'), 0::bigint,
  'a deactivated player drops out of Live Ratings');
select lives_ok($$ select kut.admin_set_player_active(
    (select id from kut.players where slug = 'test-newbie'), true) $$,
  'an admin can reactivate a player');
select is((select is_active from kut.players where slug = 'test-newbie'), true,
  'reactivation restores is_active');

select kut.admin_add_player('Delete Me Please', 'tank');
select lives_ok($$ select kut.admin_delete_player(
    (select id from kut.players where slug = 'delete-me-please')) $$,
  'an admin can hard-delete a never-used player');
select is((select count(*) from kut.players where slug = 'delete-me-please'), 0::bigint,
  'the deleted player row is gone');
select is((select count(*) from kut.card_editions where title = 'Delete Me Please Live'), 0::bigint,
  'the deleted player Live edition is gone too');
select is((select count(*) from kut.player_season_state pss
           where pss.player_id not in (select id from kut.players)), 0::bigint,
  'no orphan season-state row survives the delete');

select throws_ok($$ select kut.admin_delete_player('00000000-0000-4000-8000-000000000001') $$,
  'P0001', null, 'a player with attendance cannot be hard-deleted');
select is((select count(*) from kut.players where id = '00000000-0000-4000-8000-000000000001'),
  1::bigint, 'the blocked delete leaves the player in place');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select throws_ok($$ select kut.admin_set_player_active('00000000-0000-4000-8000-000000000001', false) $$,
  '42501', 'admin access required', 'a non-admin cannot deactivate a player');
select throws_ok($$ select kut.admin_delete_player('00000000-0000-4000-8000-000000000001') $$,
  '42501', 'admin access required', 'a non-admin cannot delete a player');
reset role;

select * from finish();
rollback;
