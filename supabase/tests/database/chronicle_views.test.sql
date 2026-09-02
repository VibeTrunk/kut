begin;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, kut, public;
select plan(4);

select has_view('kut', 'chronicle_weeks', 'Chronicle weekly projection exists');
select has_view('kut', 'chronicle_tier_changes', 'Chronicle tier-change projection exists');
select table_privs_are('kut', 'chronicle_weeks', 'authenticated', array['SELECT'], 'Members can read Chronicle weeks');
select table_privs_are('kut', 'chronicle_tier_changes', 'authenticated', array['SELECT'], 'Members can read Chronicle tier changes');

select * from finish();
rollback;
