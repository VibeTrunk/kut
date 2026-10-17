# Decisions — FLUT

ADRs record game, economy, schema or security rules: context, decision and
consequences, about 20 lines at most. Newest last, continuing from ADR-142.
ADR-001–141: tag `docs-archive-2026-10`, `docs/archive/decisions-2026.md`.
The ADRs below are current. A closed plan's ADRs are folded into one, a bullet
per old number, so `rg "ADR-NNN"` still finds each (ADR-142).

## ADR-140 — Process reset: merge to main deploys

Date: 2026-10-09, extended 2026-10-10 by S4 (VibeTrunk/kut#212). The original
text, with the transition rules S1–S3 ran under, is at the tag `docs-archive-2026-10`.

- A merge to `main` deploys to production through Vercel's Git integration.
  PR validation is the release check: `merge-gate` and `scan`, with the branch
  up to date. The CI authenticated E2E job (S2) replaced the local gate's
  browser run. Accepted: Vercel does not wait for the main-branch CI run.
- The merge authorizes that deployment only. No deployment records are kept.
  `docs/RELEASING.md` has the flow and the rollback.
- Superseded: ADR-071, 108, 123, 124, 128–134 and the deployment-record part
  of ADR-126 (full main CI stays); their titles are at the tag.
- ADR-135 (cleanup) and the 14-day package-age rule were replaced by ADR-142.

## ADR-141 — Nightly encrypted kut backup in GitHub Actions, kut only

Date: 2026-10-09 (S3 spike, VibeTrunk/kut#212). Full text at the tag `docs-archive-2026-10`.

- No read-only role can read the auth tables on hosted (`postgres` has no grant
  option on schema `auth`), so the backup covers schema `kut` only.
- `.github/workflows/backup.yml` runs nightly at 03:41 UTC as the read-only
  `kut_backup` role through the Session pooler. A privilege audit and a
  denied-insert check come first; the role never holds write or migration
  rights, and never the `postgres` credential (which ADR-144 allows only in
  the `VibeTrunk/supabase` migration workflow).
- 2026-10-11: moved from 03:17 UTC, whose runs started about 6.5 h late.
- The dump and its manifest come from one snapshot, are age-encrypted to the
  owner's key and kept 30 days. A restore check in a disposable `kut_restore`
  stack must match the schema and row counts and sign a stand-in member in.
- Six PUBLIC-executable `kut` SECURITY DEFINER functions are reviewed
  exceptions in the audit. Revoking them is a later migration.
- 2026-10-11: after scheduled runs and the owner's drill passed, the old local
  backup and its DPAPI invariant are retired. Its decrypt script and credential
  store stay in `scripts/legacy/` for the old `.sql.enc` files until 2027-01-01.
- The agents' start-up check ignores `pull_request` successes: those runs test
  a fixture and could mask a missing nightly.

## ADR-142 — Archive-first tidy, deletion tiers and doc size limits

Date: 2026-10-10 (#212 S7). Supersedes ADR-135 and the 14-day package-age hook.

- Local Git state (branches, worktrees, stashes) is removed only by
  `node scripts/tidy.mjs`. Its dry run inventories from Git alone. `--apply`
  bundles every selected item, proves the bundle in an empty repository,
  rechecks each SHA and removes only unchanged items. Dirty worktrees are
  refused; untracked and ignored files are listed, never deleted.
- Agents run the dry run only: both hooks deny `tidy --apply`, and the owner
  runs the printed line (`--apply` first, with the dry run's SHAs) in their own
  terminal. Codex hooks can only allow or deny, so this is the one route that
  behaves the same in both agents (ADR-143). The ask and prompt rules stay as a
  fallback. Direct `git branch -D`, `worktree remove` and `push --delete` stay
  blocked. Accepted residual risk: an agent with a shell isn't fully
  containable; the archive makes mistakes recoverable.
- Tiers: tracked files are deleted freely in a PR; untracked or ignored files
  move to the archive with the owner's OK; remote branches need
  `tidy --remote` and approval; hosted data is owner-only.
- Dependabot version updates wait 5 days (`cooldown`); security updates are
  exempt and manual installs are reviewed in the PR diff.
- `npm run policy:check` caps PRODUCT.md at 25 KB, decisions.md at 30 KB and
  25 lines per ADR, AGENTS.md + CLAUDE.md at 11 KB. Few ADRs are superseded, so
  a closed plan's fold into one: rules and reasons, a bullet per old number.

## ADR-143 — One safety system for Claude and Codex

Date: 2026-10-10 (#212); extended 2026-10-17 (#334).

- Hooks match except launcher (tested); shell tools only, crash/timeout allows.
  Supabase repos/template deny real db push/reset and secrets set; dry runs
  and listing work. Migrations: ADR-144. Prompt rules alone fail.
- Sandbox blocks `.git` writes/network: commit/push escalations reach the
  configured reviewer.
- Setup/defaults/probes: global `~/.codex/AGENTS.md`, "Agent safety policy".
  Trust hook; start at repo root; probe hook/trust changes.
- Automatic review: custom profile, no `extra_policy` (enforcement unproven).
  Per-change consent stays; publication covers commit/push/PR, never merge.
  Hosted work: reviewer `user` or owner.
- Accepted: low/medium risk may pass without consent: feature-branch
  commit/push, issue/PR edits, hosted work outside hook denies. Other merges/
  hosted work depend on assessed risk (global thresholds). Running hook denies
  and branch protection remain.
- Inspector labels aren't proof of consent; missing evidence is incomplete.
  Future extra_policy needs a passing paired canary and separate OK.

## ADR-144 — Hosted migrations through a workflow in VibeTrunk/supabase

Date: 2026-10-10 (process reset S9, VibeTrunk/kut#212). Amends ADR-141's
credential rule.

- `apply-migrations.yml` in `VibeTrunk/supabase` applies hosted migrations. It
  is dispatched with a catalogue commit on main and the kut commit holding the
  same files. The plan job runs `migration list` and `db push --dry-run` and
  refuses any pending migration without a byte-identical copy in kut. The apply
  job plans the same commit again, needs the identical list and a kut backup
  under an hour old, pushes, and checks that nothing is left pending.
- Only `postgres` can apply kut migrations; a dedicated role cannot inherit it
  (no ADMIN option on `postgres` in Postgres 17). Its password is therefore a
  secret of that repo's `production` environment only: main only, with the
  owner as required reviewer of both jobs. It reaches the CLI through
  `PGPASSWORD`. The backup route still never holds it. Accepted: a compromised
  dependency of an approved job could read it, so actions are pinned by SHA
  and the CLI by version.
- Each approval of the apply job is the explicit yes for that push; a merge
  still authorizes none.
- kut CI's required `catalogue-parity` job checks every kut migration against
  the catalogue's main, replacing `test-catalogue-parity.ps1`. A migration PR
  stays red there until its catalogue PR merges (`docs/RELEASING.md`).
- A local `db push` from `VibeTrunk/supabase` stays a fallback, with the
  owner's OK.

## ADR-145, 147–151 — Midweek Madness 3.0: every match live, clubs named

Folded 2026-10-17 once #267 closed (design `design/mm3/HANDOFF.md`); full text
`git show f0fe929:docs/decisions.md`. Amends ADR-111, 115, 117, 118 and DR3-6.

- **ADR-145:** four Midweek views add the club beside the account name
  (`side_*_club`, `club_name`, `champion_club`). It is the current name with
  the value leaderboard's fallback (`<name>'s Club`), not a lock snapshot.
- **ADR-147:** every match in play is live on its page; only what is due by
  real time leaves the server. The clock is the device's, corrected by the
  server's render time, held at 90′; penalties and full time come only from
  the server. Polls: the match 10 s (5 s in a shoot-out), other pages 20 s.
- **ADR-148:** rows in play count the score so far from one member read of
  `midweek_events_public`; a failed read degrades to `Live`. No report per row.
- **ADR-149:** a later pairing's pre-match is addressed by round and pairing (a
  match id is public only from kick-off) and opens once both feeders end. It
  shows member-readable data only, never the win chance or day rolls, so a
  call stays a judgement. Calls can be made there; the trigger refuses late ones.
- **ADR-150:** a match's ratings show from its full time (`matchRatings` is pure
  and includes the result); the night's rating, line and `★ Best` still wait
  for the week to be complete.
- **ADR-151:** the club where the team plays, wins or goes through; the account
  where the member acts, and for trialists. Reads are tolerant (`clubName`,
  `sideClub`). Names are live: a rename also renames past weeks.

## ADR-146 — Hosted smoke query only for data-changing migrations

Date: 2026-10-11 (after Midweek Madness 3.0 S2). Amends `docs/OPERATIONS.md`.

- The owner runs a read-only hosted smoke query only after a data-changing
  migration (`docs/OPERATIONS.md` tiers). For an additive one, CI on a fresh
  stack and the `apply-migrations` checks (ADR-144) suffice. An access change
  still gets a member smoke test of the page. In-job smoke: VibeTrunk/supabase#87.

## ADR-152 — Active membership on base-table and player-photo reads

Date: 2026-10-12 (VibeTrunk/kut#286). Extends ADR-079 to direct reads.

- The shared project's `authenticated` role includes other tools' accounts.
  Local policy/grant inspection at `69b3c38` confirmed broad reads and disabled
  accounts' own-row reads lacked membership checks. Hosted parity is unverified.
- One restrictive SELECT policy on each of the 31 ungated member-readable
  tables ANDs `kut.is_active_member()` with existing visibility rules. No
  grant, write policy, function or view changes; denied reads return zero rows.
- Own-profile reads remain for login's disabled-account check. Admin-only
  policies already require enabled admins; rating rules and comeback inputs
  already require membership. Midweek base tables have no authenticated read
  grant. Definer projections retain their gates and owner rights (KB-013).
- The private `player-photos` SELECT policy also requires active membership;
  other buckets and photo write policies are unchanged. Previously issued
  signed URLs remain valid until expiry (the app uses one hour).
- Active admins pass the same predicate; service role retains BYPASSRLS.
  pgTAP covers profileless/disabled accounts, members, admins and service role,
  populated base reads, photos, invoker/definer projections and existing scopes.
- Access-only migration `20261021000000_active_member_base_reads.sql`: central
  catalogue first, then ADR-144's approved workflow and a member page smoke.

## ADR-153–156, 158–161 — The DR5 UI pass: one type scale, calmer pages

Folded 2026-10-17 once #294 closed (design `design/ui-pass/HANDOFF.md`); full
text, with the ADRs each amended, `git show f0fe929:docs/decisions.md`.

- **ADR-153:** six type roles in `globals.css` (Title, Figure, Heading, Body,
  Small, and Label at 12 px, the floor); weights 400, 600, 800. Weight 900 and
  tracked capitals only on the card face and crest. Primitives live in
  `src/components/ui/`; `SectionNav` badges show only on tabs you are not on.
- **ADR-154:** `/midweek` is a hub (one Now block, four fixed tiles), the picker
  is `/midweek/pick`, and Home has one Midweek block by the hub's rules.
- **ADR-155:** a week page is a finished week (in play it redirects to the
  hub); bracket, night, calls and picks are pages of their own. No gate moved.
- **ADR-156:** the report's Match and Teams tabs are links (`?tab=teams`), so a
  poll keeps the tab; both render, side by side from `lg`. A focused or tapped
  factor tip outranks hover (#279).
- **ADR-158, ADR-159, ADR-160:** every other page uses the primitives, one Now
  block where something is due and Filter sheets; cut explanations moved to How
  it works anchors. A failed Trading summary read degrades; core reads stay fatal (#309).
- **ADR-161:** `check-type-scale.mjs` (`policy:check`) holds off-scale text
  outside cards and crest at zero. The FAQ is six topics, Privacy one of them.
- The pass changed no migration, economy rule, server action, privacy or timing.

## ADR-157 — Reduce speculative authenticated navigation requests

Date: 2026-10-13.

- Shared navigation, card lists, filters, album controls, Home's directory
  and detail back links use `Link prefetch={false}`; clicks stay client-side.
- Local Next 16.3.8 production probes: viewport prefetches (Players 49, album
  48, manage 36, Market 26 route shells) fell to zero.
- Cookie-dependent pages and nonce CSP remain dynamic/private/no-store.
  No shared member/photo cache, auth bypass, or change to live polling or lazy
  jobs. This preserves membership revocation, ownership and market freshness.
- Production savings are unproven: compare equal traffic windows, counting
  prefetch RSC requests (`Next-Router-Prefetch`) apart from navigations.

## ADR-162 — Safe Hands on newly opened session reports

Date: 2026-10-14 (#264). Amends ADR-059/063/068 (kudos ballots and recognition).

- New surveys snapshot three rotating categories plus Safe Hands last (version
  3). Existing version 2 ballots keep three slots; no historical backfill.
- Prompt: “Who impressed you most in goal?” Any other attendee, any archetype;
  no keeper-role/statistics records or admin work. Safe Hands may repeat a
  regular pick; a partial unique index/RPC keep regular nominees distinct.
- Submission requires a nominee or explicit Skip in every slot; drafts may
  omit slots. The RPC rejects category keys outside the recorded ballot.
- One winner across both teams: outright leader, ≥2 distinct submitted
  nominators, ≥3 submitted reporters giving any kudos. Ties get no award;
  draft keeper votes do not count. Ordinary category recognition is unchanged.
- Safe Hands uses ordinary 0/1/1.5/2 kudos scoring for 0/1/2/3+ categories.
  G+A, fading, 3.5 session cap, 8 Form cap and once-only 50 coins stay unchanged.
  Re-finalization uses the ballot snapshot and recorded nominations.
- Existing design tokens; G+A/actions beside kudos on desktop, stacked on
  phones. Safe Hands follows regular picks with collapsed rules.
- Tolerant UI first, catalogue migration second; no hosted changes authorised.

## ADR-163–164 — Pack tiers: Regular, Silver and Gold

Folded 2026-10-17 once #223 closed (design `design/pack-tiers/`, open reviews
#340); full text, `git show 3cb5908:docs/decisions.md`.

- **ADR-163:** art by slug (unknown: paper); promise from `min_tier`, none on
  the old schema. Openings start sealed: tier and rating advance on their own,
  each card waits for a tap. Skip, replay, reload and reduced motion show only
  the stored result. Receipts keep the stored title and paid price, and add
  "Gold 64 when opened" only if the tier moved. Home folds by slug and price.
- **ADR-164:** Regular (`tfh-pack`) 250/on, Silver 500, Gold 750/off. Three
  Live draws; the last is restricted only if needed for one Silver+/Gold+.
  Weights, duplicates and low companions stay. Seeded Silver off (the shop
  lists every active offer); the owner enables it at launch.
- **ADR-164:** one `pack_draw_pool()` per opening; an empty floor fails before
  the debit. Opening snapshots slug, title, floor, tier and OVR. The audited
  settings RPC uses a revision token (migration `20261023000000`).
- **ADR-164:** `/admin/economy` shows SQL metrics (off packs too) on load or
  Refresh. The draft Regular price drives the 75%/10%/round-up-25 suggestions,
  which only fill the form. Apply saves valid settings despite warnings;
  conflicts reload. Paid-price usage and the enabled non-superadmin cohort;
  escrow is not a sink and period discards are not pack ROI. Changes are manual.

## ADR-165 — Academy: Talent, First Team and Retired

Date: 2026-10-17 (#246). Accepted, not yet live: S2 adds the schema (20261024000000), S4 go-live.
Rules: [#246 comment](https://github.com/VibeTrunk/kut/issues/246#issuecomment-6238677630).

- Stages Talent, First Team, Retired; At risk is a derived warning. A counted
  week is a football week with a published session. Progress is distinct real
  weeks in the last 8 counted weeks plus up to 2 audited credits (no attendance,
  rating, coins or Chronicle). Promotion at 3 with one real week; permanent.
- Retired after 12 counted weeks absent (At risk at 8), recomputed from current
  attendance and injury periods (unlinked Players too); return by re-promotion.
- Supply: new copies only of active First Team. Retirement never burns, moves,
  freezes or delists a copy; Retired cards can't play Midweek (lock, save,
  picker) and wear a "Retired" stamp on current card surfaces, not snapshots.
- Go-live is activation; absence counts from it. Existing Players become
  founding First Team in the migration. Named trialists are names only.
- Part L 29-31 in `docs/INVARIANTS.md` (S2): (1) promotion is
  server-authoritative, from published attendance plus audited credits or an
  audited admin promotion, permanent, and re-evaluation never duplicates
  events or messages; (2) a lifecycle change never mints, burns, moves or
  freezes a copy, touches a listing or escrow, or rewrites a locked Midweek
  entry (promotion may create an edition, never a copy); (3) the server caps
  credits at 2, and they never create attendance, rating input, rewards or
  Chronicle entries.
