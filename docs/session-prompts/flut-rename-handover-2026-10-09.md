# FLUT rename handover — 9 October 2026

Slices 1–4 of the KUT → FLUT rename are live: the in-app branding (#208), the
`flut.vibetrunk.com` domain and redirect (#210) and the vibetrunk.com listing
(home #5). This note is for the owner and the next agent session that continues
the rename: slice 5 and the optional template migration. It starts with the
slice 1 picture, then dated status updates below. ADR-137 holds the
decisions, and ROADMAP "FLUT rename — remaining slices" tracks the status.

## Prompt for the fresh session

> Read `CLAUDE.md`, the mandatory project documents in its reading order, and `docs/session-prompts/flut-rename-handover-2026-10-09.md`. FLUT slice 1 (PR #208, ADR-137, ADR-138) is live at `f23ee2af28f2ea6af9d035e40376a3b8a9f8566c`. Continue the FLUT rename only, starting with the "Before anything else" list in the handover. Slices 2–5 each need my explicit authorization for their external or published steps. Ask me which slice to start, and prepare the read-only checks for it first. Keep internal `kut` names. Do not widen the auth cookie domain, and never schedule a cutover on a Midweek Wednesday evening.

## Prompt for the slice 4 session

> Read `CLAUDE.md`, the mandatory project documents in its reading order, and `docs/session-prompts/flut-rename-handover-2026-10-09.md`. FLUT slices 1–3 are live: #208 (branding) and #210 (`flut.vibetrunk.com` primary, `kut.vibetrunk.com` 307-redirects, ADR-139), with production at `b371932b0690ed9c87d2e37b1692de134bdecc38` (`dpl_EXNx6zGYJAR3qgQe8dggvh54L9wP`). Work on FLUT slice 4 only: the `VibeTrunk/home` listing. Keep internal `kut` names.
>
> **Before editing, check read-only and report:**
> 1. The kut ordinary checkout is on `main` at `b371932` with unpublished records: the #210 deployment record in `docs/DEPLOYMENTS.md`, plus edits to `docs/ROADMAP.md`, `docs/PRODUCTION_SAFETY.md` and this handover. Keep them; never stash-pop or discard them. Run `node scripts/release/check-vercel-deployment.mjs --candidate b371932b0690ed9c87d2e37b1692de134bdecc38` and confirm `candidate_live` with `legacy_redirect.verified: true`.
> 2. The sibling `VibeTrunk/home` checkout (`..\home`, Astro) is still on `feat/kut-live`. That branch was squash-merged as home #4 and its remote is gone. Read home's `CLAUDE.md` and `AGENTS.md`. Fetch, then check that the working tree is clean before switching to an up-to-date `main` (fast-forward only). Deleting the old branch is owner-only: the hook blocks agent branch deletion.
> 3. On home `main`, `src/data/tools.ts` lists `Kelderklasse Ultimate Team`, the blurb "Collectible football cards for Kelderklasse — showing up matters as much as scoring." and `https://kut.vibetrunk.com`, status `live`. Confirm this is unchanged, and find out how home deploys after a merge (Vercel project, and whether `main` auto-deploys).
>
> **The change (ADR-137 slice 4), on branch `feat/flut-listing` in home:** change only the KUT entry. It becomes name `FLUT`, blurb `Collectible football cards for TFH — showing up matters.` (56 characters; the file asks for fewer than about 70) and url `https://flut.vibetrunk.com`, with status `live`. Leave Cogitster and the rest of the file alone, and add no other coupling to kut. Verify with `npm run check` and `npm run build`, and look at the built page (local preview) to confirm the card text and link. Then stop and ask me before committing, pushing or opening the PR. I review and merge home PRs.
>
> **After my merge:** check read-only that `https://vibetrunk.com` shows the FLUT card linking to `https://flut.vibetrunk.com`. Then prepare a kut docs PR, `docs/flut-slice-4`, that carries the unpublished records from step 1. It should also:
> - mark slice 4 done in `docs/ROADMAP.md`;
> - remove the out-of-date "home tools-grid blurb" one-off item from ROADMAP and from `docs/decisions.md` "Open items" (it was added in home #4 and is now replaced);
> - add a dated `docs/PROGRESS.md` entry and update this handover.
>
> That PR is documentation-only, so it needs no gate or deployment unless I ask (ADR-124 amendment of 2026-10-05). Say so in the PR body, and record in `DEPLOYMENTS.md` that production stays at `b371932`. Publishing it also needs my go.
>
> Not in scope: slice 5 (307 → 308) and the optional server template migration. Ask before any external or published step.

## Current state

| Item | Value |
| --- | --- |
| PR | [#208](https://github.com/VibeTrunk/kut/pull/208), merged by MartinFloris 2026-10-09T08:00:03Z |
| Live SHA | `f23ee2af28f2ea6af9d035e40376a3b8a9f8566c` on `kut.vibetrunk.com` |
| Vercel deployment | `dpl_Co8cziBQFT6E3Bt1gW2nFuWLvcj7`, verified `candidate_live` 08:16:55Z |
| Previous production | #207, `dpl_DXBqscbVCbR5tLUvBazn6DSXqkcq` (`c919037`) |
| Gate | `.release-evidence/gates/f23ee2a…/gate-20261009-101448.json`: 175 passed, 2 approved skips |
| Backup | `kut-backup-20261009-100158.sql.enc`, cold-verified twice |
| Latest hosted migration | unchanged: `20261019000000_basic_pack_price_250.sql` |
| Domain | still `kut.vibetrunk.com`; `BRAND.publicUrl` names `flut.vibetrunk.com`, but nothing routes on it |

What shipped in #208:

- **Brand module and copy:** `src/lib/brand.ts`, plus every rename in `design/flut/HANDOFF.md` §1–§7.
- **Notification adapter:** `src/lib/notification-copy.ts` translates server "KUT Coins" text at display time in `MessageRow` and in the admin RPC errors.
- **Guard tests:** `notification-copy.test.ts` (parses the migrations) and `brand-copy.test.ts` (keeps the old name out of `src/**`).
- **Next.js 16.3.8:** ADR-138 records the one-time package-age exception, owner-approved, for the six high-severity advisories.

## Status update — 9 October 2026, later the same day

- Items 1–5 below are settled. The records stay unpublished for the slice 3 PR.
  Backups: the owner made it a general rule that the merge covers the gate's
  fresh backup (ADR-124 owner amendment, PRODUCTION_SAFETY.md). The owner
  checked the member view: messages read "FLUT Coins", including very old
  ones. Dependabot closed #162 itself at 08:02:47Z. The owner removed
  `feat/flut-branding` locally.
- **Slice 2:** the owner attached `flut.vibetrunk.com` to Vercel project `kut`
  and added its Porkbun CNAME. A read-only check at about 09:07Z passed. The
  CNAME is `ec77f21e393e28c9.vercel-dns-017.com`, the same as `kut.`, and a
  specific record overrides Porkbun's catch-all `*` parking record. The
  Let's Encrypt certificate for `flut.vibetrunk.com` is valid until
  2027-01-07. `vercel inspect` gives `dpl_Co8cziBQFT6E3Bt1gW2nFuWLvcj7` for
  both hosts. `/`, `/login` and `/favicon.ico` return 200 on both, with no
  Vercel-level redirect. The release checker still reports `candidate_live`.
  **Open:** Production `APP_URL`. It takes effect only at the next
  deployment, so slice 3's gated release carries it.
- No app flow uses a Supabase Auth redirect (password sign-in, admin-assisted
  reset, invite links from `APP_URL`), so the redirect allow-list needs no
  entry for `flut.`. OPERATIONS.md shows that the list was already narrowed on
  2026-09-02, so the ROADMAP one-off item is out of date. Fix it in the slice 3
  PR, along with the ROADMAP note that slice 1 was "built in PR".
- The auto-mode classifier blocks agent Vercel domain and env changes, and the
  repository hook blocks local branch deletion. The owner runs those steps.
- **Slice 3 is live.** #210 was merged at 09:51:48Z as `b371932`. The gate
  passed (175 cases, the 2 approved skips), and `dpl_EXNx6zGYJAR3qgQe8dggvh54L9wP`
  was verified at 10:07:46Z with the legacy redirect probe passing (307).
  The record is in `DEPLOYMENTS.md`, unpublished; it goes into the next PR.
  Still to check: a newly created invite link starts with `https://flut.`.
  Next are slice 4 (`VibeTrunk/home`) and slice 5 (308), each with its own
  authorization. The slice 3 notes below are kept for history.
- **Slice 4 is live.** Home #5 (`600d958`, merged by the owner at 10:23:42Z)
  lists FLUT, "Collectible football cards for TFH — showing up matters.",
  linking to `https://flut.vibetrunk.com`. Vercel project `home` deploys
  `main` from Git: `dpl_9jeSQ31CEwpe5LmBrhYbPsgHxEQT` was READY within
  seconds, and a read-only check of vibetrunk.com confirmed the card. The
  home checkout is on an up-to-date `main`. Its old local branches
  (`feat/kut-live`, `feat/flut-listing`, `docs/branch-protection-status`,
  `docs/dedupe-agent-safety-docs`) are for the owner to delete. The kut docs
  PR `docs/flut-slice-4` carries the #210 record and the slice 4 notes. It is
  documentation-only, so production stays at `b371932`.
- **Still open:** slice 5 (307 → 308) and the optional server template
  migration, each needing its own authorization, plus the check that a new
  invite link starts with `https://flut.`.
- Slice 3 as built: on `feat/flut-domain` (ADR-139). It has the 307 in
  `next.config.ts`, the checker on `flut.` with the legacy-binding check and
  the live redirect probe, a verification command that requires the probe,
  tests and docs. `verify:fast` passes (746). It carries this session's
  records and is not yet published. After the owner's merge, the ADR-124
  gate and deployment run as usual. The verification step then proves the
  redirect live. Before the cutover, members get this notice:

  > FLUT has a new address: https://flut.vibetrunk.com. The old kut link
  > forwards you there automatically. You'll need to sign in once more on
  > the new address, with the same username and password. Your cards, coins
  > and squad are unchanged.

## Before anything else

1. **Uncommitted records in the ordinary checkout** (on `main` at `f23ee2a`):
   `docs/DEPLOYMENTS.md` holds the #208 release record, and this handover plus
   its `docs/README.md` row are new. Per CLAUDE.md, they go into the next PR
   opened for other work, never a standalone record PR. Check them with
   `git status` and keep them. A private copy of the record is in
   `.release-evidence/gates/f23ee2a…/deployment-record.md`.
2. **Owner decision pending: backup approval.** For #208 the agent created the
   gate's fresh backup under the merge authorization, without a separate yes.
   For #206 the owner had approved that step separately. Ask which the owner
   wants from now on.
3. **Not yet checked on production: a signed-in member view.** Only the public
   pages and icons were smoke-tested live. Check as a member: an old "KUT
   Coins" notice in `/messages` should read "FLUT Coins", and the coin pill,
   nav, Chronicle and How it works should show FLUT.
4. **Dependabot #162** bumps Next to 16.3.7, which is below what is now pinned
   and still vulnerable. Close it, or let Dependabot rebase it, as the owner
   prefers.
5. **Leftover local branch:** `feat/flut-branding`. It is merged and its remote
   copy is deleted; delete it locally only with owner approval (CLEANUP.md).

## Remaining slices (each needs its own authorization)

### Slice 2 — attach `flut.vibetrunk.com`

- Add the domain to Vercel project `kut`, set up DNS, and verify TLS. Find out
  first who controls the `vibetrunk.com` DNS records.
- Set Production `APP_URL`. `src/app/(app)/admin/invites/actions.ts` builds
  invite links from it, so new invites will point at the FLUT domain. That
  domain must already serve the app before `APP_URL` changes.
- Supabase Auth Site URL is shared by every VibeTrunk tool: verify only, never
  change it for KUT. Sign-in uses a password, but check the redirect
  allow-list for any flow that emails a link (ROADMAP also has an open item to
  narrow that allow-list).
- Read-only first: `node scripts/release/check-vercel-deployment.mjs --candidate <sha>`
  confirms access.

### Slice 3 — PR `feat/flut-domain`

- In `next.config.ts`, add an exact-host 307 from `kut.vibetrunk.com/:path*`
  to `https://flut.vibetrunk.com/:path*`.
- Move the release checker (`scripts/release/check-vercel-deployment.mjs`,
  `scripts/release/vercel-deployment-contract.mjs`) to the new primary domain.
  It must assert that the legacy alias resolves to the same deployment with no
  Vercel-level redirect, plus a live redirect probe. Update the release-script
  tests and PRODUCTION_SAFETY.md to match.
- Cookies are per host (ADR-137), so every member signs in again. Announce it
  first, and never cut over on a Midweek Wednesday evening (lock is 20:00
  Amsterdam).
- This is not documentation-only: it needs the full gate and an ADR-124 deploy
  after the owner merges.

### Slice 4 — `VibeTrunk/home` listing

Done 2026-10-09 in home #5. Name FLUT, URL `https://flut.vibetrunk.com`,
blurb "Collectible football cards for TFH — showing up matters." ROADMAP's
out-of-date "home tools-grid blurb" one-off item and its decisions.md "Open
items" entry were removed in `docs/flut-slice-4`.

### Slice 5 — 308

Change the redirect from 307 to 308 once the owner accepts the new domain in
production.

### Optional — server template migration

One migration, in its own PR with a database test, re-creates the functions
that write "KUT Coins" (HANDOFF §8). Hosted application goes through
`VibeTrunk/supabase` as usual. The display adapter stays for stored rows. The
migrations guard test will then check the new templates' FLUT literals; update
it so it expects FLUT wording rather than translating it.

## Things that will surprise you

- **Next 16.3.8 dev server and WebKit.** `npm run test:e2e:authenticated` uses
  `next dev`, and on 16.3.8 it fails some WebKit cases. Production mode
  (`next start`, which the gate uses) passes. Recheck a WebKit failure against
  a production build before judging the code (ADR-138). Evidence is in
  `.release-evidence/next-16.3.8-webkit-20261009/`.
- **One server per checkout.** Never start a second Next server from the
  checkout while that suite runs. It killed the suite's dev server mid-run
  once.
- **The package-age hook matches prose.** It flags the words "npm install"
  anywhere in a shell command, heredoc text included. Write documentation with
  the Write tool.
- **The design asset script refuses on purpose.** `design/flut/build/build-assets.cjs`
  only works against the pre-build `share-draw.ts` (`c919037`).
- **ESLint override.** `eslint.config.mjs` lets `design/**/*.cjs` use
  `require()`.
- **Central checkout moved.** `VibeTrunk/supabase` was fast-forwarded to `main`
  (`39204c1`) for the gate's catalogue parity check.
