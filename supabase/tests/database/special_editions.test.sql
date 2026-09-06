begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;
select plan(8);

select has_column('kut','card_editions','snapshot_archetype','Specials store a frozen archetype');
select has_column('kut','card_editions','snapshot_rarity_tier','Specials store a frozen rarity');
select has_column('kut','card_editions','artwork_version','Special artwork is versioned');
select is((select count(*) from kut.card_editions where not is_live), 0::bigint,
  'the scaffolding migration issues zero Special editions');

insert into kut.players(id,slug,display_name,archetype)
values ('00000000-0000-4000-8000-000000550001','special-fixture','Special Fixture','all_rounder');

select throws_ok($$
  insert into kut.card_editions(player_id,edition_type,title,is_live,snapshot_ovr)
  values ('00000000-0000-4000-8000-000000550001','totw','Incomplete',false,75)
$$, '23514', null, 'an incomplete Special fails closed');

insert into kut.card_editions(
  id,player_id,edition_type,title,is_live,snapshot_ovr,snapshot_pac,snapshot_sho,
  snapshot_pas,snapshot_dri,snapshot_def,snapshot_phy,snapshot_archetype,
  snapshot_rarity_tier,description,artwork_key,artwork_version,
  special_discard_multiplier,issued_at
) values (
  '00000000-0000-4000-8000-000000550002','00000000-0000-4000-8000-000000550001',
  'totw','Fixture TOTW',false,75,75,76,77,78,79,80,'playmaker','holo',
  'A frozen fixture.','special/totw-v1',1,1.5,now()
);

select lives_ok($$ update kut.card_editions set minted_count = 1 where id = '00000000-0000-4000-8000-000000550002' $$,
  'future supply accounting remains mutable');
select throws_ok($$ update kut.card_editions set snapshot_ovr = 76 where id = '00000000-0000-4000-8000-000000550002' $$,
  'P0001', 'frozen Special edition fields are immutable', 'frozen Special stats are immutable');
select throws_ok($$ update kut.card_editions set is_live = true where id = '00000000-0000-4000-8000-000000550002' $$,
  'P0001', 'card edition identity is immutable', 'a Special cannot be converted to Live');

select * from finish();
rollback;
