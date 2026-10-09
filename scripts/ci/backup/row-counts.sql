-- Per-table row counts for schema kut, as one JSON object keyed by table name
-- (ADR-141). Read-only. The backup reads it inside the dump's snapshot; the
-- restore check reads it from the restored stack and compares.
select coalesce(
  json_object_agg(
    c.relname,
    (xpath('/row/n/text()',
       query_to_xml(format('select count(*) as n from %I.%I', n.nspname, c.relname),
                    false, true, '')))[1]::text::bigint
    order by c.relname),
  '{}')
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'kut' and c.relkind in ('r', 'p');
