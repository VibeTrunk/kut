-- Automated/local data must remain fictional.
insert into kut.players (id, slug, display_name, full_name, archetype)
values
  ('00000000-0000-4000-8000-000000000001', 'alex-example', 'Alex Example', 'Alex Example', 'finisher'),
  ('00000000-0000-4000-8000-000000000002', 'bea-test', 'Bea Test', 'Bea Test', 'playmaker'),
  ('00000000-0000-4000-8000-000000000003', 'charlie-fixture', 'Charlie Fixture', 'Charlie Fixture', 'defender')
on conflict (id) do nothing;

insert into kut.seasons (id, name, starts_on, is_active)
values ('00000000-0000-4000-8000-000000000010', 'Test Season 2026', '2026-08-03', true)
on conflict (id) do nothing;
