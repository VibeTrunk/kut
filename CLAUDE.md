@AGENTS.md

# Claude-specific notes

- Permissions and hooks for Claude live in `.claude/settings.json` and
  `.claude/hooks/`; the Codex equivalents are under `.codex/`.
- Commands you hand to the owner to run themselves use PowerShell syntax. Your
  own shell tool is unaffected by this.
- Your memory index (`MEMORY.md`) is loaded at start-up. Treat it as background:
  verify any file, flag or path it names before recommending it.
- Model hint (Pro plan): Sonnet for S0, S1, S6 and S8 of the process reset;
  Opus for S2–S5, S7 and S9.
- The production-safety invariants reach you through the `@AGENTS.md` import;
  they are generated there from `policy/PRODUCTION_INVARIANTS.md`.
