# Decisions — Kelderklasse Ultimate Team (KUT)

Why this repo looks the way it does. Newest entries at the bottom.

## Agent safety scaffolding

Copied from the `vibetrunk-new-tool` skill's templates, which trace back to
`VibeTrunk/home` (the original template) and `VibeTrunk/cogitster` (which
added the Supabase CLI allow-list adaptation). See `VibeTrunk/home`'s
`docs/decisions.md` for the full reasoning behind the allow-list +
PreToolUse-hook + gitleaks-CI defense-in-depth design — not repeated here to
avoid drift between copies.

The Supabase addon was applied at creation time (`.codex/rules/project.rules`,
`.claude/settings.json`): `npx supabase migration list` and
`npx supabase db push --dry-run` are auto-allowed as read-only; `supabase
functions deploy` is auto-allowed generically since the build spec doesn't
pin down a specific Edge Function name yet (unlike cogitster's single
`solo-game` function — KUT's spec describes several RPC-style operations:
`claim_starter_pack`, `open_pack`, `discard_card`, `create_listing`,
`buy_listing`, `publish_session`, `rebuild_season`). `supabase db push`
(real), `db reset`, and `secrets set` stay off the allow-list.

## Name

The working title in the build spec is "TFH Ultimate Cards" / "TFH Cards",
with a suggested subdomain `tfh.vibetrunk.com`. The user chose to name it
Kelderklasse Ultimate Team (KUT) instead — repo `VibeTrunk/kut`, subdomain
`kut.vibetrunk.com`, Supabase schema `kut`. Anywhere the build spec itself
says "TFH Ultimate Cards", read it as this project's working spec; the
product name shown to users is KUT.

## Open items

- **Framework/stack scaffolding not yet applied.** The build spec specifies
  Next.js + TypeScript + Tailwind + Supabase + Vercel in detail (Part XX),
  but this repo currently has only the safety/security/doc layer — no
  `package.json`, no app code. Building it out should follow the build
  spec's own phased plan (Part XXXIV, starting at Phase 0 / Session 1).
- **`vercel.json`'s `connect-src` has a placeholder** (`https://<project-ref>.supabase.co`)
  since the Supabase project doesn't exist yet — this repo will use the
  existing shared VibeTrunk Supabase project once the `kut` schema is
  created there, not a new project. Replace the placeholder with the real
  project ref once that's done (see build spec Part XXVII, "Supabase
  considerations", on why this stays one shared project rather than
  one-per-tool).
- **Blurb for `home`'s tools grid** was drafted ("Collectible football cards
  for Kelderklasse — showing up matters as much as scoring.") but not yet
  added to `VibeTrunk/home/src/data/tools.ts` — offer that edit once there's
  something more concrete to link to (per the `vibetrunk-new-tool` skill,
  step 6).
