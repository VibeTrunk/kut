# Integration review session

Review one complete feature across UI, auth/RLS, RPCs, database constraints,
concurrency, mobile behaviour, failure cleanup, and documentation. Prefer
fictional local fixtures. Confirm Part L invariants, service-role isolation,
idempotency and race behavior. Run `npm run verify:full` plus authenticated
mobile E2E when the full local Supabase stack is available.

Do not fix unrelated findings silently: register them or report them. Do not
push, merge, deploy, mutate production, or change external settings. End with
pass/fail evidence, precise gaps, and the candidate SHA or dirty-tree state.
