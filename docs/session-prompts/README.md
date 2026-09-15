# Production session prompts

Use one prompt per bounded session. Each prompt requires a structured handoff
and forbids implicit deployment authority. Start production-sensitive sessions
through the launchers in `docs/PRODUCTION_SAFETY.md`.

- `specification.md` — change or validate the canonical specification
- `migration-feature.md` — one immutable migration plus database proof
- `integration-review.md` — concurrency, auth and cross-layer review
- `production-release.md` — evidence collection and release approval only
