# Security

This repo handles real user data, backed by the shared Supabase project
(schema `kut`). Every table has row-level security enabled; the browser
never talks to Postgres directly — economically valuable operations (pack
opening, discard, market transactions, wallet changes, starter grants,
attendance rewards) run through tightly validated, server-authoritative
database functions or Edge Functions, never direct client writes. See
[`CLAUDE.md`](CLAUDE.md) and [`docs/INVARIANTS.md`](docs/INVARIANTS.md) for
the invariants (Part L) this must never violate, and
[`docs/PRODUCT.md`](docs/PRODUCT.md) for the backend model.

If you notice something suspicious (an RLS gap, a CSP bypass, a vulnerable
dependency, a leaked credential), report it to m.f.vanoostrom@gmail.com
rather than opening a public issue.

The `service_role` Supabase key must never be `PUBLIC_`-prefixed, never ships
to the browser, and never appears in any tracked file — only the
browser-safe publishable key does. See
[VibeTrunk/home](https://github.com/VibeTrunk/home)'s `docs/decisions.md`
for the reasoning behind the shared agent-safety and CI scaffolding this
repo copies.

The build spec's invite-only onboarding (Part VII) is also a security
control, not just a UX choice: this game is for TFH members only, and
account creation must stay gated behind an admin-issued, single-use invite
token — never open unrestricted public sign-up.
