-- Synthetic data for the backup self-test (ADR-141). Fictional users only,
-- loaded into the runner's throwaway source stack, never a real database.
-- It gives the restore check auth-referencing rows to stub and a member to
-- sign in as.
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'backup-selftest-1@example.test', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'backup-selftest-2@example.test', '{}', '{}', now(), now());

insert into kut.profiles (id, display_name)
values
  ('00000000-0000-4000-8000-00000000b001', 'Backup Selftest One'),
  ('00000000-0000-4000-8000-00000000b002', 'Backup Selftest Two');

insert into kut.invitations (player_id, token_hash, consumed_at, consumed_by)
values ('00000000-0000-4000-8000-000000000001', repeat('b', 64), now(),
        '00000000-0000-4000-8000-00000000b001');
