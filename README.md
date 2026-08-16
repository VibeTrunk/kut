# Kelderklasse Ultimate Team (KUT)

A browser-based collectible football-card game for Terrible Football
Haarlem (TFH): real attendance and match performance drive a card economy
players collect, open packs of, and trade. Part of the
[VibeTrunk](https://vibetrunk.com) hub.

This repo currently holds only the agent-safety/security scaffold — no
application code yet. Start with [`CLAUDE.md`](CLAUDE.md) for project
context, then [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) for the full
product and technical specification, and [`docs/decisions.md`](docs/decisions.md)
for why this repo looks the way it does (including open items still to be
resolved before implementation starts).

## Status

Not yet live. Target: `kut.vibetrunk.com`, deployed as its own Vercel
project, using the shared VibeTrunk Supabase project's `kut` schema.
