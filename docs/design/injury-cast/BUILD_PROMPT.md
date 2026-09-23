# Build prompt — the plaster cast

Paste the block below into a fresh Claude Code session opened in this
repository. It is a UI-only change, with no migration and no hosted
action, so it does not need the production launcher.

```text
Build the injury-mode "plaster cast" card for KUT.

The design is approved and fully specified in
docs/design/injury-cast/README.md. That file is the source of truth: it has
the decisions, tokens, placement, the complete CSS, the new module and the
LiveCard edits. The visual reference is the design canvas
https://claude.ai/artifact/JJ1XHAugHcpSrQAkkyHFdb, section "A · The plaster
cast, ready to build". Read it with the Artifact tool if you want to compare
visually. If the canvas and the README disagree, the README wins. Build it in
the real LiveCard component, not by copying canvas markup.

Before editing, read in this order:
1. CLAUDE.md
2. docs/README.md
3. docs/design/injury-cast/README.md
4. ADR-082 and ADR-083 in docs/decisions.md
5. the latest entries in docs/PROGRESS.md
6. the code: src/components/live-card.tsx, the .live-card section of
   src/app/globals.css, and src/app/layout.tsx

Scope: UI only. No migration, no RPC or Supabase change, and no economy or
rating change. If you find you need one, stop and ask me.

Steps:
1. Create feat/injury-plaster-cast from an up-to-date main.
   docs/design/injury-cast/ may still be uncommitted in the working tree;
   bring it onto the branch, because it belongs in this PR.
2. Implement per the README:
   - globals.css: delete .live-card__injured and add the injury block after
     the Elite tier.
   - Add src/lib/injury-cast.ts.
   - layout.tsx: add Caveat and Permanent Marker through next/font/google,
     with preload: false.
   - live-card.tsx:
     - data-injured on the article, and remove the old chip;
     - ShirtBack lift plus the crossed plasters;
     - InjuryCast after the two scrims and before the pennant;
     - BandageClip and the sr-only line in the nameplate;
     - the PAC strike plus "hop".
3. Copy: in src/app/(app)/how-it-works/page.tsx section 4, replace the
   "🩹 Injured chip" sentence so it describes the cast.
4. Tests: add tests/unit/injury-cast.test.ts. It should check that:
   - the same id always gives the same cast;
   - the two lines always differ (check a few hundred ids);
   - every pool line is unique and at most 20 characters;
   - ink and doodle stay within their allowed values.
5. Docs:
   - Add the next free ADR (ADR-084 at time of writing) to
     docs/decisions.md. It is visual only and supersedes ADR-082's chip
     sentence. Record the decisions from the README's "Decisions" section.
   - Add a docs/PROGRESS.md entry.
   - Set the README's status to built and update the index line in
     docs/design/README.md.
6. Verify:
   - Run npm run verify:fast as one call. If Prettier complains, run
     npm run format first.
   - Run the app locally. Look at an injured Player's card on /players,
     /players/[slug] and /club/collection at 390 px and at desktop width,
     with a custom photo and with the shirt back, and at two different tiers
     including Elite. Compare with the canvas.
   - Check that a non-injured card is unchanged.
   - If no local Player is injured, put one in injury mode from
     /admin/roster on the local database only. Never touch hosted.
7. Stop before committing. Report the files changed, the verify output, and
   screenshots of the cards you checked. Then wait for me to say commit, push
   and open the PR. When I do:
   - use one conventional commit, e.g. "feat: injured players' cards go into
     a signed plaster cast (ADR-084)";
   - open a PR against main with gh pr create;
   - I review and merge.
```
