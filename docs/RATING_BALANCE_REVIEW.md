# Goals, kudos and participation reward — balance review

2026-09-06. Updated for ADR-063 — kudos Form ladder 0 / 1 / 1.5 / 2 and a
+3.5 combined per-session cap. Reproduce with
`node design/features/check-rating-balance.mjs`. Machine-readable results:
[`design/features/rating-balance.json`](design/features/rating-balance.json).
The script loads the actual TypeScript rating engine and checks the formulas;
it does not edit game configuration or access members.

## Conclusion

**+1.5 goals / +2 kudos per-session caps, a +3.5 combined per-session cap and
the shared +8 Form ceiling (ADR-063).** Kudos stays bounded against goals — the
strongest isolated combined input (3.5) is still smaller than today's isolated
hat-trick boost (4.75) — while broad multi-category recognition is now worth
distinctly more than a single category and a strong goal night no longer
crowds kudos out. It gives non-scorers a meaningful route to temporary OVR. Do
not stack it on top of today's old goal formula, add category-specific stat
bonuses, or turn the new 50 coins into rating points.

This is a bounds/relative-strength verification, not proof of equal outcomes in
the real group. The material tradeoffs are a deliberate reduction of large
goals-only boosts, lower rewards for sparse/random nominations, and faster decay
for once-weekly players when TFH plays twice weekly. Monitor these explicitly.

## 1. Compare like with like

The existing engine totals goals **per football week**. The proposal scores
goals **per session**. The table below compares one isolated session in an
otherwise empty football week, no prior Form and no OVR cap clipping.

| Event | Existing new Form | Proposed new Form | Proposed extra SHO beyond OVR |
|---|---:|---:|---:|
| 1 goal | 1.25 | 1.00 | +2 |
| 2 goals | 2.50 | 1.25 | +4 |
| 3 goals | 4.75 | 1.50 | +6 |
| 4+ goals | 6.00 | 1.50 | +8 cap |
| 1 qualified kudos category | — | 1.00 | 0 |
| 2 qualified categories | — | 1.50 | 0 |
| 3 qualified categories | — | 2.00 | 0 |
| 3+ goals and 3 qualified categories | — | 3.50 | +6 to +8 |
| Submit a complete form | — | **0** | **0** |
| Bring bibs | 0 | 0 | 0 |

The old +1 hat-trick bonus is included in 4.75/6, and must be **replaced**,
not retained alongside the new goal cap. Category recognition requires two
distinct nominators in that category; “three categories” is not three votes.
As each voter may nominate a recipient only once, maximum recognition needs
at least **six distinct supporting teammates** across the three categories.

Goals still carry an extra shooting advantage, so equivalent Form does not
make scoring and kudos identical in total attribute impact. Retaining that
existing SHO spike keeps scoring recognizable while broadening OVR progression
for keepers and non-scorers. Archetype offsets redistribute stats, sum to zero
and are not additional temporary OVR. Special-edition boosts are frozen,
separate collectibles and are not introduced by this scaffolding release.

## 2. Stacking, rounding and decay

| Pattern, after buildup | Proposed Form | Rounded OVR contribution |
|---|---:|---:|
| Maximum goals, every published session | 3.75 | +4 |
| Maximum kudos, every published session | 5.00 | +5 |
| Maximum both, every published session | 8.00 | +8 |
| Maximum both, every other session, just after playing | 5.25 | +5 |
| Same pattern, after the intervening missed session | 3.50 | +4 |

The first three need four contributing sessions. Under today's engine, three
goals every football week eventually saturate +8 without any kudos. Under the
proposal, scoring alone caps at +4 after buildup and kudos alone at +5;
reaching +8 requires sustained goals **and** broad recognition. This is a
deliberate inclusive rebalance, not a claim that old goals-only strength is
unchanged.

An isolated maximum kudos event contributes 2 → 1.5 → 1 → .5 → 0 at
session ages 0–4. An isolated combined maximum is 3.5 → 2.625 → 1.75 → .875 → 0.
Today's isolated hat trick is 4.75 → 2.6125 → 1.436875 → .790281 → .434655 at
**weekly** ages 0–4. Sessions with no finalized report still age existing Form;
no-game/cancelled periods never do. Never equate four sessions with four weeks.

Round only the total Form using the existing engine's final rounding. An
isolated +1 Form displays +1 OVR, and +1.5 can display +2; three separate
category awards are not individually rounded and added. The UI says “Form”
for decimal contributions, rather than promising an exact “+N OVR” per category.

## 3. Attendance and value implications

The unchanged attendance formula controls 45 OVR points above the 30 baseline,
versus at most 8 Form points: ~85% / 15% of the possible increase. The final
ceiling stays 83. At baseline, the first appearance produces approximately
39 OVR before Form, much larger than isolated maximum kudos (+2 rounded).
At full attendance progression (75), Form is the only remaining upward
variation; the 85% figure does not mean attendance drives 85% of every change.

Form also changes discard values for every Live copy. At an illustrative
60 OVR: discard is 101; +2 OVR makes it 117, +4 makes it 137, +8 makes it 186.
Kudos is therefore economically meaningful even though recognition itself
does not award coins. Duplicate Club Value discounts do not discount payouts.
The live roster's weighted pack-discard EV still needs checking before rollout.

## 4. Participation and recognition distribution

Synthetic check: 20,000 sessions for each row, fixed seed 20260906. Voters choose
teammates uniformly at random, use different teammates per category and cannot
vote for themselves. Small groups nominate as many distinct peers as exist.
This is a neutral dispersion scenario, not a forecast of real friendships,
consensus, football performance, category suitability or collusion.

| Attendees / submitting nominators | Mean kudos Form per attendee | Any recognition | Maximum +2 |
|---|---:|---:|---:|
| 3 / 3 | .498 | 49.83% | 0% |
| 5 / 5 | .747 | 71.24% | 0% |
| 20 / 5 | .067 | 6.71% | 0% |
| 20 / 10 | .251 | 24.32% | .02% |
| 20 / 20 | .705 | 61.82% | 1.31% |

Maximum kudos is mathematically impossible with fewer than six other supporting
people. Do **not** scale small-group rewards upward automatically; that would
give a small clique an easier path to the same maximum. At typical ~20-person
sessions, +2 should be a standout result, not the default. Skips reduce
recognition; real consensus can increase it. Completion rewards do not require
a nomination, so three completed forms containing only skips still produce
zero kudos, not a manufactured quorum.

Keep the two-nominator threshold and minimum three actual nominators initially.
Observe submission rate, proportion explicitly skipping, mean recognized
categories and concentration of recognition over 4–6 sessions. Review sparse
recognition and recurring closed-group nomination patterns privately. Avoid a
public popularity leaderboard. Caps limit collusion's payoff but do not prevent it.

## 5. The new 50-coin reward

- 50 once per completed self-report is **20% of the 250 attendance reward**.
- One attendee completing two session reports in a week receives 100 extra,
  alongside 500 attendance coins. Zero goals/all skips still qualifies.
- Example: 20 eligible linked attendees all submit → **1,000 extra coins**
  for that session, versus 5,000 attendance coins. Guests do not earn report
  coins through admin goal entry, and edits/corrections never pay twice.
- Attendance plus reporting is 300 per session. With 175 packs that buys
  1.714 packs over time, **71.4% more** than the former 250-income/250-price
  combination. This is the cumulative effect of two requested changes, not
  a 71.4% inflation measurement.

The reward is balanced as a smaller, bounded participation faucet, but it and
the cheaper pack must be reviewed together against current roster EV. Actual
economy equilibrium cannot be certified without live usage/roster inputs. No
odds, discard formula, attendance award or requested price was silently changed.

## Verification scope

The script asserts contribution/stacking caps for 0–99 goals × 0–3 categories
at five attendance states, checks qualification thresholds and alternate-session
patterns, and compares real engine outputs including SHO and discard values.
No live migrations or runtime game changes. Production implementation still
requires SQL/TypeScript parity, reward concurrency and attendance-correction tests.
