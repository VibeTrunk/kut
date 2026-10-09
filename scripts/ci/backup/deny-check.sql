-- Denial check (ADR-141). Run as kut_backup: an insert into a kut table must
-- fail with insufficient_privilege (42501). Any other outcome fails the run.
-- READ WRITE overrides the role's read-only default, so this tests the
-- privilege itself rather than the read-only setting. Nothing is written
-- either way: the transaction is rolled back.

begin read write;
do $$
begin
  insert into kut.profiles (id, display_name)
  values ('00000000-0000-4000-8000-000000000000', 'kut_backup denial check');
  raise exception 'kut_backup was able to insert into kut.profiles';
exception
  when insufficient_privilege then
    raise notice 'insert denied as expected';
end
$$;
rollback;
