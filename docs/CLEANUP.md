# Specific owner-approved cleanup (ADR-135)

Status, 7 October 2026: local review candidate. Inspection and immutable plans
are implemented. The execution state machine is restricted to newly created
disposable fixtures. **Real removal is unavailable.** No current worktree,
stash, branch, archive or source evidence has removal approval from this slice.

## Routine inspection

Run `npm run cleanup:inspect` from the ordinary checkout. This reads registration,
owner refs, stashes and the ordinary index. Named plans also hash all local
files, including ignored/private files and generated files, and inspect links
without following them. Contents/secrets are never printed. Plans contain
private paths and should stay private. No cache exclusions are implicit.

Supply a request JSON for a named review:

```json
{
  "items": [
    {
      "path": "ABSOLUTE registered extra worktree path",
      "preservation": {
        "archive": "ABSOLUTE independently retained archive path",
        "recoveryReceipt": "ABSOLUTE independent recovery receipt path",
        "limitations": "Actual recovery limits, including credential custody and unverified off-device recovery."
      }
    }
  ]
}
```

`node scripts/cleanup/plan-cleanup.mjs --request request.json` prints the review
without saving anything. Add `--output ABSOLUTE-NEW-PLAN.json` only to save a
new, non-overwriting plan outside every proposed removal. Archive/receipt hashes
bind evidence; **their presence does not establish successful recovery or
consent**. Missing preservation blocks the item. Dirty/untracked work blocks
execution even when archived: never force Git, discard edits or apply/drop
stashes to make removal pass. Ignored files need full recovery too. A future
cache-exclusion/deletion contract needs separate review.

Recheck a saved plan without removing anything:

```powershell
node scripts/cleanup/review-cleanup.mjs --plan ABSOLUTE-PLAN.json
```

Add repeated `--item ABSOLUTE-WORKTREE-PATH` arguments for an exact subset.
Each item is checked independently against its saved state and evidence hashes.
Changed items are blocked while unchanged items remain available for review.
An unchanged result is not proof of finished work, successful restoration or
owner approval. The checker accepts no removal/approval/force flags.

## Explain before asking

For each actual cleanup type, identify named items and briefly explain what
will go, why the checked evidence supports removal, what remains saved or
untouched, and any inconvenience or uncertainty. Do not call an item finished
merely because Git reports it clean: inspect completion/history evidence too.
Do not describe an unverified archive as a safe backup.

The generated view separately maps the project copy (including inventoried
generated/private files), its borrowed dependency shortcut when present, and
matching Git administration records. It carries exact paths, HEAD/index/content
manifests, raw/resolved link destinations, evidence hashes and recovery limits
in the appendix. It says independent recovery is still required, not that a
restore succeeded. No items with different preservation conditions are batched
automatically. Group only the same type with matching preservation conditions.

Specific owner approval must cover each selected item's complete operation:
normal `git worktree remove -- <exact-path>`, unlinking only explicitly listed
borrowed `node_modules` shortcuts, and the narrowly described leftover handling.
Remove the shortcut only; the ordinary checkout's real dependencies stay.
Approve exact paths and item-operation digests, never a wildcard/count/general
cleanup request. Changes to content, HEAD/index, paths/pointers, links, recovery
evidence, explanations or operation invalidate that item alone. Re-explain
changed scope before asking again; unchanged items retain approval. No generic
`npm run` allowance, agent receipt, JSON flag, environment variable or
`--approved` switch independently proves owner consent.

## Execution and interruption

The state machine has a capability minted only for a freshly created temporary
Git repository. Simulated consent cannot authorize the owner's repository or
any caller-provided directory. The real CLI always refuses, with no hidden
receipt/environment enablement. This is a deliberate platform limitation,
not a claim that agent approval is implemented end to end.

Fixture execution checks state and independent recovery before any mutation.
It unlinks the listed shortcut and uses normal Git removal without force.
Exact unchanged leftovers are checked against manifests: individual files by
name, then empty directories. No forced recursive deletion, link traversal,
broad prune or unspecified path. A Git/Windows refusal stops without fallback;
permission errors do not authorize another interpreter or permission changes.
Branches/stashes/index/ordinary HEAD are checked after execution.

Interrupted fixture work retains consent in memory and revalidates remaining
state before resuming. Progress is recorded in new, non-overwriting checkpoint
files, authenticated with an ephemeral session key that is never saved or
printed. Missing/altered checkpoints stop execution, rather than invent progress
or consent. Checkpoints are re-read on resume. Completed items are checked, not
repeated; changed items stop while unaffected approved items continue. Saved
flags do not mint consent. Process restart loses the capability: **no production durable authority
or cross-session resume adapter exists yet**. A future host must recover the
original independently authenticated owner event, without manufacturing consent
or asking for another task decision for unchanged work. Any runtime capability
prompt is separate from that owner task decision.

A lost Git subprocess result is explicitly uncertain. Remaining working or Git
administration files stop that item without fallback deletion. If both named
folders and the registration are already absent, it can report completion
without repeating Git. A recorded Git refusal remains refused after interruption.

Report completion plainly: which named copies/shortcuts/records went, what
remains saved/untouched, whether recovery passed and which part stopped.
Never claim completion after partial deletion or failed preservation.

## Installed runtime and smallest capability

Observed versions: Codex CLI **0.160.1**, Claude Code **2.1.287**. The installed
Codex `execpolicy check` supports `prompt` and `forbidden`. The narrowly named
Node execution command is permission-required; direct removal/prune is forbidden.
Claude repository settings have matching ask/deny rules. Both current hooks
deny the unavailable real execution entry, even though Claude supports an owner
prompt. Native prompt support alone cannot activate an unverified removal tool.
Self-contained hooks retain
existing destructive-command blocks, fail closed on malformed input and handle
`command` plus unified-exec `cmd`. Existing package-age hooks remain unchanged;
their known best-effort fail-open behavior is not certified by this slice.

The runtime guards do not import `scripts/safety/command-policy.cjs`: that file
is an editable review/test reference only. In particular, Codex's guard logic
stays inside its protected `.codex/hooks` folder. A disposable injection test
places an allow-all replacement in the editable scripts path and proves that
neither hook loads it or changes its denial. This closes the dependency weakness
in the earlier uncommitted candidate; it does not certify general injection
resistance or live hook coverage in this session.

The Codex and Claude guard bodies are identical apart from the final agent name.
Parity tests require this and exercise the same dangerous/malformed inputs,
unknown-agent refusal and blocked cleanup outcome. Configuration wiring remains
specific to each app. Equal code and tested decisions do not establish equal
live coverage, filesystem protection or general resistance to prompt injection;
each installed runtime still needs its own proof before real activation.

The parity follow-up passed all 14 focused guard checks, with policy consistency,
formatting, lint, types and diff whitespace checks. The other 29 cleanup cases
were skipped in that focused run; the preceding full-run result remains
historical, rather than a claimed full run of the subsequent parity edit.

[Official Codex hooks](https://learn.chatgpt.com/docs/hooks) map unified
`exec_command` to `Bash` in local orchestration, but exclude local command hooks
under cloud orchestration. PreToolUse `ask` is unsupported and hook errors may
continue the tool call: emit `deny`, never `ask`, for Codex cleanup execution.
Changed hooks need local review/trust. Rule/hook files alone are not coverage.

An actual harmless `exec_command` printed text containing `git reset --hard`;
the existing regex would have blocked that text if invoked. It ran, so existing
hook enforcement on this session's tool path is **not established**. This tool
interface provides command-level escalation with automatic review, not an
authenticated owner-consent callback or per-path permission grant. Automatic
review approval is not independent owner cleanup consent. No managed/app
settings may be changed to substitute Full Access for that boundary.

"Owner-consent/runtime interface" means a connection to a genuine owner decision
from the agent host and its filesystem permissions. It does not name a product
the owner must install. This implementation cannot turn automatic command review
into an owner decision. The documented Codex `transcript_path` is also unsuitable
as a stable authority API: its format can change, and an agent-written copy or
hook payload is not proof of the original owner event. No transcript-based
approval adapter or new background service was introduced.

[Claude's supported hooks](https://code.claude.com/docs/en/hooks) support exec
form (`command` plus `args`) and an owner-facing `ask`. Installed read-only
`doctor` reports no installation issues, but no usable sign-in for remote
policy/Remote Control checks. No live Claude tool invocation or owner UI round
trip was proven. Payload tests and settings parsing are not that proof; hook
timeouts can fail open.

The smallest proven removal capability is therefore **fixture-only**. No
production capability is selected/enabled. A future supported host must present
the complete plan, enforce item digests, retain authenticated scope for unchanged
resume, independently verify encrypted recovery and grant access only to named
working/admin folders. The current interface cannot express that path-limited
grant. A blanket `.git` write grant, global Full Access, ACL or settings change
is not a substitute.

## Windows limitation and review checks

Disposable Git removal/junction tests run in the Windows temporary directory.
They prove behavior there only, not why Git and owner PowerShell failed in
OneDrive while exact Explorer cleanup succeeded. The root cause remains
unresolved. No ACL, machine/app/hosted setting or repository location changed;
no real retained worktree was a deletion probe.

Focused suite: `node node_modules/vitest/vitest.mjs run tests/unit/cleanup.test.ts`.
Artificial archives restore Git history and file bytes in a separate process.
Cases cover missing consent/recovery, changed contents/HEAD/index/evidence,
dirty/untracked/ignored work, unsafe/protected paths, links, Git refusal and
interrupted leftovers. A bounded 20-second per-test budget accommodates real
Windows Git subprocesses; no retries or browser-budget change. Run project
`verify:fast` for review.

Follow-up local verification passed all five fast-check components and 653 unit
tests in 63 files, including 40 cleanup cases. It additionally covers uncertain
Git results, authenticated progress tampering/missing records, per-item resume,
saved-plan rechecks and malformed private JSON without content disclosure.
The retained log records direct Node execution of those same components after
the ordinary shell tool became unavailable; it is not a release-gate result.

After correcting the hook dependency boundary, the full fast checks passed
again with 655 unit tests in 63 files, including 42 cleanup cases. The two new
cases exercise an injected allow-all policy next to disposable copies of the
actual hooks and consistency of both self-contained runtime policies.

For the owner-authorized publication candidate, final local fast verification
passed all five components and 656 unit tests in 63 files, including all 43
cleanup cases after the parity edit. No real removal was tested or enabled.

Before activation, retain actual runtime deny/prompt/owner-decision evidence and
controlled scoped filesystem proof, including cross-process resume, using only
disposable fixtures. Protect the ordinary checkout, twelve retained extras,
shared dependencies, refs, nine stashes, archives and original evidence.
Publication and each further removal require scoped owner decisions.
