# AGENTS.md

This file provides guidance to ChatGPT and Codex when working with code in this repository.

## Canonical project guidance

Before doing repository work, read [`CLAUDE.md`](CLAUDE.md) in full and follow it as project guidance. It is the canonical description of the project, its status, and the wider VibeTrunk ecosystem.

Do not duplicate that guidance here: keeping a single canonical project description prevents Claude and Codex instructions from drifting apart. If the project changes, update `CLAUDE.md`; this file will continue to direct Codex to it.

## Codex-specific safety and permissions

- Repository-local Codex hooks and command rules live under `.codex/` and require the repository to be trusted. Standard VibeTrunk scaffold — see global `~/.codex/AGENTS.md` for the agent safety policy and push/deployment discipline these hooks and rules enforce.
- Normal `git push`, `npm run *`, and `gh ...` commands are allowed by the repository command rules.
- Never run a `vercel deploy`/`vercel --prod` unless explicitly asked.
- This same pattern (`.claude/`, `.codex/`, `AGENTS.md`, gitleaks CI) is the template for every VibeTrunk-org repo — copy it into new tool repos and adapt only the stack-specific command lists.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
