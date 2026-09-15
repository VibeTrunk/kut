# Migration feature session

Implement exactly one previously specified migration slice. Never edit, rename,
copy, or delete an existing migration. Add one new migration plus relevant
pgTAP proof, or a reviewed machine-readable exemption. Re-read Part L and the
latest bodies of every RPC/view being replaced; classify additive versus
data-changing under `docs/OPERATIONS.md`; declare the predecessor migration and
all ordering dependencies; include practical rollback DDL.

Run the migration policy, fast verification, pgTAP, and relevant integration
tests. Do not link a hosted project, apply a migration, push, merge, deploy, or
change branch protection. End with exact hashes, test results, risk tier,
catalogue work still needed, backup requirement, and all separately authorized
hosted steps.
