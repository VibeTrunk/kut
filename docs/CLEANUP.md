# Specific owner-approved cleanup (ADR-135)

## Ordinary files: the simple workflow

For ordinary named files, use the coding agent's existing filesystem/shell tool.
Specific approval in the actual conversation is task authority. No consent
server, host callback, signed token, approval file or special cleanup helper is
needed. Tool permissions and Windows permissions still apply separately.

1. Inspect the exact files without changing them. Explain what goes, why,
   what stays saved or can be regenerated, and any downside. Independently
   verify any preservation the explanation relies on before asking approval.
2. Obtain the owner's specific approval of those named files in the chat.
   An instruction to implement cleanup tooling does not approve deleting files.
3. Recheck the paths, file types, contents and preservation. If anything changed,
   stop only that item. Use the normal tool to remove only the unchanged approved
   files. On Windows, use `Remove-Item -LiteralPath 'EXACT FILE' -ErrorAction Stop`
   without recursive or force options. Remove a named empty directory only after
   confirming it is empty and its removal is included in approval.
4. Report what was removed, what remains, and any item that stopped. If the
   original approval is still available in this conversation, unchanged work can
   continue without another task approval. A local record alone cannot restore
   missing owner authority.

Never follow a shortcut into its destination, expand approval with a wildcard,
remove shared dependencies, discard edits, or target a retained worktree,
archive or protected evidence under this ordinary-file workflow. A Git worktree
has additional Git records and preservation requirements; use the worktree
workflow below. Broad destructive commands remain blocked. A wrapper around a
denied command is not an exception.

On 7 October 2026, an actual shell invocation removed one exact file in a newly
created disposable directory. Its independently hash-verified copy and a second
file remained unchanged. This establishes ordinary exact-file removal on this
tool route. No owner file was tested and no live Claude round trip is claimed.

## Worktree tooling status

Status, 7 October 2026: local review candidate on updated main. Read-only inspection and plans remain the default. The real engine and encrypted recovery adapter now exist, with disposable-fixture tests. **Installed-agent activation remains blocked:** this managed session has no authenticated owner-decision callback or enforceable per-item filesystem connection; Claude's live callback is also unproven. No actual worktree has removal approval.

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

## Real execution and interruption

A trusted host imports `executeCleanup` from `scripts/cleanup/execute-cleanup.mjs` and creates a runtime with `createHostRuntime`. This engine accepts real registered extras; it is independent of the old minted-fixture executor. A direct shell launch still refuses. There is no CLI adapter-path loader, approval flag, transcript reader, environment override or receipt that activates it.

The host must provide an authenticated owner UI/chat event, live coverage checks for the selected agent, exact filesystem enforcement, exclusive execution and durable compare-and-swap storage for original decisions and progress. These callbacks are a **trust boundary**, not an authentication mechanism supplied by the library. Passing arbitrary functions or owner-looking JSON does not prove a trusted host. The fixture host is explicitly simulated and refuses owner repositories; its test key authenticates artificial progress only. No new owner-signing ceremony is required.

Recovery runs before the first owner decision and again on resume. Each mutation rechecks the ordinary HEAD/index/refs/stashes, named boundaries and directory identities, current content/link destinations and evidence hashes. Dirty/untracked work stops even if archived. Only the listed shortcut is unlinked, followed by normal Git removal without force. A known success permits exact unchanged leftover files, then empty directories. A refusal is sticky; an unknown Git result permits completion only after the worktree, administration folder and registration are all absent. Remaining content never authorizes fallback.

The host retains the original event by item operation digest. An unchanged item resumes after a process restart without another task decision. Missing, altered or conflicting host progress stops that item; another unchanged item can continue. Runtime filesystem permission is separate and may need a fresh scoped grant. Records cannot create owner consent or certify successful Git execution.

## Encrypted preservation and recovery

`node scripts/cleanup/preserve-cleanup.mjs` is read-only without arguments. Explicit `--target ABSOLUTE --archive NEW-ABSOLUTE --receipt NEW-ABSOLUTE` writes new evidence for a registered extra, never removes it. The new per-item archive contains bundled committed history, a pack of every available Git object (including unpublished reflog/index/dangling objects), and every inventoried working/administration file, including dirty, ignored and private bytes. Links are saved as metadata and never restored as active shortcuts. There are no implicit cache exclusions. Existing historical multi-item archives are unchanged; they are not silently treated as this new format.

The KUTBKP01 worker independently retrieves a stable DPAPI credential locator. Passwords never enter arguments or logs; decryption feeds a separate Node recovery process through a private pipe. Recovery reconstructs the bundled history without source alternates, runs bundle verification and full strict Git fsck, checks the exact target HEAD and restores every listed file byte in fresh temporary directories. It deletes only its newly created scratch files/empty folders. A receipt locates evidence; every execution still performs fresh recovery. Existing archives are never overwritten. Failure removes only the new pending candidate after checking its identity; a replaced candidate is left untouched and reported as changed.

The artificial Windows tests use disposable credential modules. One case retains the exact full-strength worker source; matrix cases reduce only the KDF work factor in their copied worker to keep state/resume checks bounded. Production retains 600,000 iterations, with no runtime override. They do not read/change the owner's credential store or certify live DPAPI access, portable custody, off-device copies, cross-machine recovery or complete OneDrive synchronization. The snapshot also saves unrelated available Git objects, which can make it larger; subprocess buffers are bounded at 512 MiB and oversized preservation fails closed. These limitations must be explained for actual proposed items.

## Installed runtime and smallest capability

Observed versions: Codex CLI **0.162.0-alpha.2**, Claude Code **2.1.287**. The installed
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

## Current continuation evidence — 7 October 2026

Reverified #205 as merged at 14:55:36 UTC, with local/remote main still at `3aa09ed0d9c9d8739d5fcb898e5b9f5188eac299`. The new local branch preserves its unpublished deployment record. The shell coverage probe again executed harmless text the self-contained hook would deny; coverage is not established on that route. The active tool inventory has no `request_permissions`, app-server approval callback or Claude `canUseTool` connection. Static response-shape tests are not a live owner round trip.

The proposed additional write scope is only the selected working folder and its matching `.git/worktrees/<id>` folder, with reads for the archive/receipt and no network access. Codex's installed schema supports explicit path entries, but this session cannot request/enforce that grant. Claude's permission callback does not by itself provide per-path OS enforcement. Neither agent may substitute a whole-repository grant or global access change. No production scope is proven.

A fresh disposable Git repository under the ignored OneDrive evidence folder completed normal Git worktree removal. Its exact target was absent and the remaining disposable fixture was disposed. This is one successful probe; it does not diagnose the earlier failures on protected retained copies. An inherited-ACL read was confined to the new probe location. No ACL, setting, real worktree or protected evidence was changed. Private logs are under `.release-evidence/cleanup-enablement-local-20261007/`.

The adapter continuation's local `npm run verify:fast` passed policy consistency, formatting, lint,
types and all **690 tests in 65 files**, including **77 cleanup cases**. The new
portable state-machine file uses a 60-second fixture budget; encrypted cases
use 180 seconds. No retries or browser deadlines changed. Earlier failed runs
remain recorded: a 20-second cleanup fixture timeout and an unrelated fictional
progress-folder EBUSY both passed the focused rerun and final full run. This is
Windows local evidence; current Linux CI and installed-agent activation were
not run or proven. Nothing was committed, published, released or really removed
at that check.

The accepted ordinary-file workflow then passed all five fast-check components
and **691 tests in 65 files**, including **78 cleanup cases**. The owner accepted
this version with the worktree safeguards retained and separately authorized
commit, push and PR publication. That authorization covers this tooling slice
and the preserved #205 deployment record; it grants no approval to remove an
actual item or relax the worktree host requirements. Publication does not
establish live worktree activation or repair the unresolved Windows failure.
