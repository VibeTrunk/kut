# AGENTS.md

This file provides guidance to ChatGPT and Codex when working with code in this repository.

## Canonical project guidance

Before doing repository work, read [`CLAUDE.md`](CLAUDE.md) in full and follow it as project guidance. It is the canonical description of the project, its status, and the wider VibeTrunk ecosystem.

Do not duplicate that guidance here: keeping a single canonical project description prevents Claude and Codex instructions from drifting apart. If the project changes, update `CLAUDE.md`; this file will continue to direct Codex to it.

## Codex-specific safety and permissions

- Repository-local Codex hooks and command rules live under `.codex/` and require the repository to be trusted.
- The pre-tool hook blocks destructive shell operations such as recursive forced deletion, force pushes, remote-branch deletion, hard resets, forced Git cleans, broad checkout-based discards, and piping downloads directly into interpreters.
- A second pre-tool hook (`block-young-packages.cjs`) blocks `npm install`/`npm i` of any package version published less than 14 days ago (checked live against the npm registry), as a supply-chain guard against typosquats and compromised releases. It fails open if the registry is unreachable or the version is ambiguous (e.g. an unresolved semver range).
- Normal `git push`, `npm run *`, and `gh ...` commands are allowed by the repository command rules. Never force-push.
- Treat any push or deployment as an external side effect: only do it when the user's request authorizes it, and never run a `vercel deploy`/`vercel --prod` unless explicitly asked.
- This same pattern (`.claude/`, `.codex/`, `AGENTS.md`, gitleaks CI) is the template for every VibeTrunk-org repo — copy it into new tool repos and adapt only the stack-specific command lists.
