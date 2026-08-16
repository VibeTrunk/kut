begin;

create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public, kut;

select plan(1);

select has_schema('kut', 'KUT schema exists after migrations run');

select * from finish();
rollback;
