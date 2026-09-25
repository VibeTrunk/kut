// Every Midweek Madness screen and state. Each entry becomes one .dc.html file.
// "You" are Sanne (a bye, a 1–0 win, out on penalties in the quarter-finals),
// except on the starter-pack screen. Report text is the real renderer's output
// from sample-tournament.json and is never retyped here.
import {
  T, YOU, BRACKET, PLAYERS, esc, hhmm, dayDate, icon, card, mini, chrome, adminBar, pageHead,
  seedLine, privacyLine, status, slotRow, sheet, keeperCheck, pickTile, clock, eveningStops,
  matchRow, matchesBy, scoreboard, timeline, shootout, whyPanel, roundName, roundShort, matchName,
  revealTimes, roundPayouts, finalScore, tierChip, MIDWEEK,
} from "./lib.mjs";

const LOCK = dayDate(T.lockAt); // "Wed 7 Oct"
const LOCK_T = hhmm(T.lockAt); // "20:00"
const PAY = roundPayouts(T.rounds);
const FINAL_AT = hhmm(revealTimes[T.rounds - 1]);

// Sanne's collection (invented; it contains her sample five). Sorted by OVR.
const COLLECTION = [
  ["Yara Q."], ["Kees R."], ["Lotte S."], ["Dirk S."], ["Mo A."], ["Gijs H."], ["Iris W."],
  ["Quinten Z."], ["Esther M."], ["Bas V.", 2], ["Floor J."], ["Umut C."],
];
const SAVED = ["Dirk S.", "Mo A.", "Gijs H.", "Iris W.", "Bas V."];

// -------------------------------------------------------------- picker ----

function lockBar(countdown = "in 1 day, 4 h") {
  return `<section class="mw-lock" aria-label="Lock">
  <div class="mw-lock__when"><div><p class="mw-lock__label">Squads lock</p><p class="mw-lock__time">${LOCK}, ${LOCK_T}</p></div><p class="mw-lock__count" role="timer">${countdown}</p></div>
  ${seedLine()}
</section>`;
}

function saveBar({ dirty, canSave = true, lastWeek = true }) {
  return `<div class="mw-savebar">
  ${lastWeek ? `<span class="btn btn--secondary btn--small">Load last week&rsquo;s five</span>` : `<span></span>`}
  ${dirty ? `<span class="btn btn--primary btn--small"${canSave ? "" : ' aria-disabled="true"'}>Save your five</span>` : `<span class="btn btn--secondary btn--small" aria-disabled="true">&#10003; Saved</span>`}
  <p class="mw-savebar__note">Change it as often as you like until ${LOCK}, ${LOCK_T}.</p>
</div>`;
}

function picker({ slots, statusHtml, activeSlot = null, notice = "", grid, dirty, canSave = true, lastWeek = true, top = "", title = "Pick your five", extra = "" }) {
  return `<div class="wrap">
  ${top}
  ${pageHead({
    kicker: `Midweek Madness &middot; ${LOCK}`,
    title,
    lede: `Five of your cards, one knockout, Wednesday night. Every match you win pays KUT Coins; the champion takes ${MIDWEEK.championTotal} in all.`,
  })}
  ${lockBar()}
  ${privacyLine()}
  ${notice}
  <section class="mw-squad" aria-labelledby="sq-h">
    <div class="mw-squad__head"><h2 class="display h2" id="sq-h">Your five</h2>${statusHtml}</div>
    <ol class="mw-slots mw-slots--rows">${slots.map((n, i) => slotRow(i + 1, n, { active: activeSlot === i + 1 })).join("")}</ol>
    ${sheet(slots, { activeSlot })}
    ${keeperCheck(slots)}
    ${saveBar({ dirty, canSave, lastWeek })}
    <p class="mw-sticky-note">On a phone this bar stays pinned above the tab bar while you scroll.</p>
  </section>
  ${extra}
  ${grid}
</div>`;
}

function grid(inSquad, activeSlot) {
  return `<section class="sec" aria-labelledby="cards-h">
  <div class="mw-grid-tools"><h2 class="display h2" id="cards-h">Your cards</h2><p class="seg" aria-label="Show"><span aria-current="true">All 12</span><span>Goalkeepers 1</span></p></div>
  <p class="small faint">One slot per Player. Where you own two copies, the stronger one plays.</p>
  <ul class="mw-pick-grid">${COLLECTION.map(([n, copies]) =>
    pickTile(n, { state: inSquad.includes(n) ? "in" : "add", slot: inSquad.includes(n) ? null : activeSlot, copies }),
  ).join("")}</ul>
</section>`;
}

const S = [];
const add = (s) => S.push(s);

add({
  file: "Picker-Empty.dc.html", page: "picking", route: "/club/midweek", state: "open, nothing picked",
  rule: "§44.2 auto squads; §44.1 picking opens when the tournament exists",
  note: "Nothing saved. The member is still in: an auto squad plays unless they pick. \"Load last week's five\" is the one-tap path for returning members; pre-filling saves nothing (§44.2), so the page stays unsaved until they press Save.",
  body: () =>
    chrome(
      picker({
        slots: [null, null, null, null, null],
        activeSlot: 1,
        statusHtml: status("none", "Not picked yet"),
        dirty: true,
        canSave: false,
        notice: `<p class="mw-notice mw-notice--info"><span aria-hidden="true" class="mw-notice__mark">i</span><span><b>No pick, no problem, just a worse one.</b> If you haven't saved a five by ${LOCK_T} on Wednesday, an <b>auto squad</b> plays for you: up to five random Players from your collection, all heavily handicapped. Picking takes a minute.</span></p>`,
        grid: grid([], 1),
      }),
    ),
});

add({
  file: "Picker-Partial.dc.html", page: "picking", route: "/club/midweek", state: "open, partial squad, unsaved",
  rule: "§44.2 1–5 cards, one per Player; trialists fill empty slots; injured cards (ADR-085 cast)",
  note: "Last week's five were loaded, but two of those cards have since been sold, so their slots are open. Slot 4 is being filled: the grid's buttons name the slot. Esther M. is injured, so her real LiveCard wears the cast and her slot says what it costs in words, not numbers.",
  body: () =>
    chrome(
      picker({
        slots: ["Dirk S.", "Mo A.", "Esther M.", null, null],
        activeSlot: 4,
        statusHtml: status("dirty", "Unsaved changes"),
        dirty: true,
        notice: `<p class="mw-notice mw-notice--warn" role="status"><span aria-hidden="true" class="mw-notice__mark">!</span><span><b>Loaded last week&rsquo;s five.</b> Tess F. and Wout Y. aren&rsquo;t in your collection any more, so slots 4 and 5 are open. Nothing is saved until you press Save.</span></p>`,
        grid: grid(["Dirk S.", "Mo A.", "Esther M."], 4),
      }),
    ),
});

add({
  file: "Picker-Saved.dc.html", page: "picking", route: "/club/midweek", state: "open, five saved",
  rule: "§44.2 only a saved squad counts; §44.9 before the lock you see only your own squad",
  note: "The steady state for most of the week. The strip at the top is last Wednesday's result: the next tournament opens as soon as the last one ends (§44.1), so the page has to carry both. The keeper check is worked out from archetypes alone, because no factor is known before the lock.",
  body: () =>
    chrome(
      picker({
        top: `<a class="mw-lastweek"><p class="kicker kicker--faint">Last Wednesday &middot; 30 Sep</p><p><b>You reached the semi-finals.</b> +100 KUT Coins. Lieke won it.</p><span class="link">Bracket &rarr;</span></a>`,
        slots: SAVED,
        statusHtml: status("saved", "Saved Tue 6 Oct, 14:02"),
        dirty: false,
        grid: grid(SAVED, null),
      }),
    ),
});

add({
  file: "Picker-OptedOut.dc.html", page: "picking", route: "/club/midweek", state: "open, member opted out",
  rule: "§44.2 opting out; ADR-091 the opt-out is the consent mechanism",
  note: "An opted-out member cannot save a squad (save_midweek_squad refuses), so there is no picker at all, only the way back. Coming back is one tap here as well as in Settings. Opted-out members can still watch: the bracket is for every active member.",
  body: () =>
    chrome(`<div class="wrap wrap--narrow">
  ${pageHead({ kicker: "Midweek Madness", title: "You&rsquo;re sitting this out", lede: "" })}
  <section class="panel">
    <div style="display:grid;gap:14px">
      <p class="muted">You opted out of Midweek Madness, so you aren&rsquo;t entered: no squad, no auto squad, and none of your cards are shown to anyone.</p>
      <p class="muted">Come back and you&rsquo;re in for ${LOCK}, picked or auto.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px"><span class="btn btn--primary">Take part again</span><a class="btn btn--ghost">Settings</a></div>
    </div>
  </section>
  ${lockBar()}
  <p class="small faint">You can still follow Wednesday&rsquo;s bracket from 20:30 like everyone else.</p>
</div>`),
});

add({
  file: "Picker-Starter.dc.html", page: "picking", route: "/club/midweek", state: "open, starter pack only (3 cards)",
  rule: "§44.2 trialists fill empty slots; leaving a slot empty is never the best play",
  note: "A new member (Pieter) with the three starter cards. The five can never be full, so the page says so plainly and points at packs, rather than showing two slots that look like a to-do. With a duplicate in the starter pack there are only two Players, and the copy says two.",
  body: () => {
    const three = ["Hidde P.", "Carmen P.", "Floor J."];
    return chrome(
      picker({
        slots: [...three, null, null],
        statusHtml: status("saved", "Saved Mon 5 Oct, 19:40"),
        dirty: false,
        lastWeek: false,
        notice: `<p class="mw-notice mw-notice--info"><span aria-hidden="true" class="mw-notice__mark">i</span><span><b>You have 3 Players, so 2 trialists make up your five.</b> Trialists are handicapped; every Player you add from a pack beats one. <a class="link">Open a pack &rarr;</a></span></p>`,
        grid: `<section class="sec"><div class="mw-grid-tools"><h2 class="display h2">Your cards</h2></div><ul class="mw-pick-grid">${three.map((n) => pickTile(n, { state: "in" })).join("")}</ul></section>`,
      }),
      { balance: "250", initials: "PK" },
    );
  },
});

// ----------------------------------------------------------- Wednesday ----

const coinsFor = (who) => T.payouts.filter((p) => p.manager === who).reduce((a, p) => a + p.amount, 0);

function yourPath(rounds, { next = null } = {}) {
  const rows = [];
  for (let r = 1; r <= rounds; r++) {
    const pair = BRACKET[r - 1].find((p) => p.sides.includes(YOU));
    if (!pair) break;
    const t = hhmm(revealTimes[r - 1]);
    if (pair.bye) {
      rows.push(`<li class="mw-path__row"><p class="mw-path__round">${roundShort(r)}<b>${t}</b></p><p class="mw-path__what"><b>Bye.</b> Counts as a win.</p><p class="mw-path__coins">+${PAY[r - 1]}</p></li>`);
      continue;
    }
    const m = pair.match;
    const s = m.managers.indexOf(YOU);
    const opp = m.managers[1 - s];
    const sc = finalScore(m);
    const so = m.report.shootout;
    const won = m.report.winnerSide === s;
    const score = `${sc[s]}&ndash;${sc[1 - s]}${so ? `, ${so.score[s]}&ndash;${so.score[1 - s]} on penalties` : ""}`;
    rows.push(
      won
        ? `<li class="mw-path__row"><p class="mw-path__round">${roundShort(r)}<b>${t}</b></p><p class="mw-path__what"><b>Beat ${esc(opp)} ${score}.</b> <a>Report</a></p><p class="mw-path__coins">+${PAY[r - 1]}</p></li>`
        : `<li class="mw-path__row mw-path__row--out"><p class="mw-path__round">${roundShort(r)}<b>${t}</b></p><p class="mw-path__what"><b>Out: lost to ${esc(opp)} ${score}.</b> <a>Report</a></p><p class="mw-path__coins"><span class="chip chip--out">Out</span></p></li>`,
    );
    if (!won) break;
  }
  if (next) rows.push(next);
  return `<ol class="mw-path" aria-label="Your night">${rows.join("")}</ol>`;
}

add({
  file: "Week-Locked.dc.html", page: "wednesday", route: "/club/midweek", state: "locked, before round 1 (20:12)",
  rule: "§44.1 lock and reveal times; §44.2 cards re-checked at the lock; §44.9 entries appear with round 1",
  note: "Between 20:00 and 20:30 there is nothing to show about anyone else: entries appear with round 1. The member sees their own five as it was locked, and the schedule for the evening.",
  body: () =>
    chrome(`<div class="wrap">
  ${pageHead({ kicker: `Midweek Madness &middot; ${LOCK}`, title: "Squads are locked", lede: "The bracket is drawn and every match is already decided. Round 1 comes out at 20:30, then a round every half hour." })}
  <section class="panel" aria-label="Tonight">
    <div style="display:grid;gap:18px">
      ${clock(eveningStops(0))}
      <p class="muted small" style="text-align:center"><b style="color:var(--color-ink)">Round 1 at 20:30</b>, in 18 minutes. The final at ${FINAL_AT}.</p>
    </div>
  </section>
  <section class="sec" aria-labelledby="five-h">
    <div class="sec__h"><h2 class="display h2" id="five-h">Your five</h2>${status("saved", "Locked in: all five still yours")}</div>
    <ul class="mw-five">${SAVED.map((n) => `<li>${card(n)}</li>`).join("")}</ul>
    ${privacyLine("Members see these five from 20:30, with their numbers for the week.")}
  </section>
  ${seedLine()}
</div>`),
});

add({
  file: "Week-Revealing.dc.html", page: "wednesday", route: "/club/midweek", state: "mid-reveal, rounds 1–2 out (21:05)",
  rule: "§44.1 round r at lock + 30 min × r; §44.6 a bye counts as a round-1 win; §44.7 paid after the final",
  note: "The page is about the member's own night first, then the round that just came out. Coins are shown as earned but not yet paid: payment is lazy and happens after the final (§44.7), and the page says so rather than letting the wallet look wrong.",
  body: () => {
    const next = `<li class="mw-path__row mw-path__row--next"><p class="mw-path__round">Quarters<b>21:30</b></p><p class="mw-path__what"><b>Next: Sophie.</b> Result at 21:30, in 25 minutes.</p><p class="mw-path__coins"><small>win</small>+${PAY[2]}</p></li>`;
    return chrome(`<div class="wrap">
  ${pageHead({ kicker: `Midweek Madness &middot; ${LOCK}`, title: "Round 2 is out", lede: "" })}
  <section class="panel" aria-label="Tonight">${clock(eveningStops(2, { youThrough: 2 }))}</section>
  <section class="sec" aria-labelledby="night-h">
    <div class="sec__h"><h2 class="display h2" id="night-h">Your night</h2><p class="small faint">+${PAY[0] + PAY[1]} so far &middot; paid after the final</p></div>
    ${yourPath(2, { next })}
  </section>
  <section class="sec" aria-labelledby="r2-h">
    <div class="sec__h"><h2 class="display h2" id="r2-h">Round 2</h2><a class="link">Full bracket &rarr;</a></div>
    <div class="mw-latest">${BRACKET[1].map((p) => matchRow(p)).join("")}</div>
  </section>
  ${seedLine()}
</div>`);
  },
});

add({
  file: "Week-Complete.dc.html", page: "wednesday", route: "/club/midweek", state: "complete (22:41)",
  rule: "§44.7 champion total; §44.8 the seed is published at complete; §44.1 next week opens at once",
  note: "Wednesday night, after the final. The champion leads, then the member's own result and coins (now paid). Next week's tournament already exists (§44.1), so its picker is one tap away but doesn't take over the page until Thursday. The seed is out, and the fairness seal shows its check.",
  body: () => {
    const champ = T.entries.find((e) => e.manager === T.champion);
    const final = matchesBy.get(`${T.rounds}/0`);
    const so = final.report.shootout;
    const total = T.payouts.reduce((a, p) => a + p.amount, 0);
    const goals = T.matches.reduce((a, m) => a + finalScore(m)[0] + finalScore(m)[1], 0);
    return chrome(`<div class="wrap">
  <section class="mw-champ" aria-labelledby="champ-h">
    <p class="kicker">Midweek Madness &middot; ${LOCK} &middot; Champion</p>
    <div style="display:flex;align-items:center;gap:16px"><span aria-hidden="true" class="mw-pennant"></span><h1 class="display mw-champ__name" id="champ-h">${esc(T.champion)}</h1></div>
    <p class="mw-champ__line"><b>Beat Sophie on penalties in the final</b>, ${finalScore(final)[1]}&ndash;${finalScore(final)[0]} and ${so.score[1]}&ndash;${so.score[0]} from the spot. ${MIDWEEK.championTotal} KUT Coins over the night. <a class="link">Report &rarr;</a></p>
    <ul class="mw-five mw-five--small" aria-label="${esc(T.champion)}'s five">${champ.cards.map((c) => `<li>${card(c.name)}</li>`).join("")}</ul>
  </section>
  <dl class="mw-stats">
    <div><dt>You</dt><dd class="brass">+${coinsFor(YOU)}<small>paid to your wallet</small></dd></div>
    <div><dt>Your finish</dt><dd>Quarters<small>out on penalties</small></dd></div>
    <div><dt>Entrants</dt><dd>${T.entries.length}<small>${T.entries.filter((e) => e.auto).length} auto squads</small></dd></div>
    <div><dt>Goals</dt><dd>${goals}<small>in ${T.matches.length} matches</small></dd></div>
  </dl>
  <section class="sec" aria-labelledby="night-h">
    <div class="sec__h"><h2 class="display h2" id="night-h">Your night</h2><a class="link">Bracket and picks &rarr;</a></div>
    ${yourPath(3)}
  </section>
  <a class="mw-strip"><span aria-hidden="true" class="mw-mini mw-mini--trialist"><b>?</b></span><p><b>Next Wednesday is open</b>Pick your five for Wed 14 Oct. Locks at 20:00.</p><span aria-hidden="true" class="mw-strip__arrow">&rarr;</span></a>
  ${seedLine({ open: true, seed: T.seed })}
  <p class="small faint">${total} KUT Coins paid across the club tonight.</p>
</div>`);
  },
});

function nextWeekPicker(strip) {
  return chrome(
    picker({
      top: strip,
      slots: [null, null, null, null, null],
      statusHtml: status("none", "Not picked yet"),
      dirty: true,
      canSave: false,
      grid: `<p class="small faint">&hellip; your cards, as in Picker &mdash; nothing picked.</p>`,
    }),
  );
}

add({
  file: "Week-SkippedBreak.dc.html", page: "wednesday", route: "/club/midweek", state: "skipped: club break",
  rule: "§44.1 the club-break gate",
  note: "Skipped is decided at the lock, and the next week opens straight away, so the member meets it as a one-line notice above next week's picker. Needs status_reason on midweek_current as a code (see HANDOFF, data).",
  body: () =>
    nextWeekPicker(`<p class="mw-notice mw-notice--info" role="status"><span aria-hidden="true" class="mw-notice__mark">i</span><span><b>No Midweek Madness on ${LOCK}.</b> There was no TFH session the week before, so the club was on a break. Nothing was played or paid, and your saved five didn&rsquo;t carry over.</span></p>`),
});

add({
  file: "Week-SkippedField.dc.html", page: "wednesday", route: "/club/midweek", state: "skipped: too few entrants",
  rule: `§44.1 fewer than MIDWEEK_MIN_ENTRANTS (${MIDWEEK.minEntrants}) entrants`,
  note: "Rare, since everyone with a card is entered unless they opt out. Same shape as the club break, different reason.",
  body: () =>
    nextWeekPicker(`<p class="mw-notice mw-notice--info" role="status"><span aria-hidden="true" class="mw-notice__mark">i</span><span><b>No Midweek Madness on ${LOCK}.</b> Only 3 clubs were in, and a bracket needs ${MIDWEEK.minEntrants}. Nothing was played or paid.</span></p>`),
});

add({
  file: "Week-Void.dc.html", page: "wednesday", route: "/club/midweek (and /club/midweek/2026-10-05)", state: "void (admin)",
  rule: "§44.8 void hides results and pays nothing; §44.9 a void tournament shows no results",
  note: "Void can happen mid-evening (simulated → void). Everything already revealed disappears, the bracket URL shows only this notice, and the reason is quoted as the admin wrote it. The next week opens as usual.",
  body: () =>
    nextWeekPicker(`<div class="mw-notice mw-notice--warn" role="status"><span aria-hidden="true" class="mw-notice__mark">!</span><span><b>${LOCK} was called off by an admin.</b> &ldquo;Roster import gave Tim two cards he didn&rsquo;t own, so his squad wasn&rsquo;t fair.&rdquo; No results are shown and no coins were paid for that night.</span></div>`),
});

add({
  file: "Week-Disabled.dc.html", page: "wednesday", route: "/club/midweek", state: "disabled (config off, nothing running)",
  rule: "§44.8 launch switch",
  note: "Disabled with nothing open or simulated: every entry point is hidden (Home card, Collection strip, how-it-works section stays as rules text) and the route returns the app's existing not-found page. Disabled with a tournament still running shows that tournament until it completes (§44.8), then this.",
  desktop: false,
  body: () =>
    chrome(`<div class="nf"><p class="kicker">KUT</p><h1>Page not found</h1><p class="muted">This link is unavailable, or the card or saved result no longer belongs to this account.</p><span class="btn btn--primary" style="justify-self:start">Go to Live Ratings</span></div>`),
});

// --------------------------------------------------------------- bracket ----

function bracketList(revealedRounds) {
  return `<div class="mw-bk mw-bk--list">${BRACKET.map((pairs, i) => {
    const r = i + 1;
    const out = r <= revealedRounds;
    const known = r <= revealedRounds + 1;
    const groups = [];
    for (let k = 0; k < pairs.length; k += 2) groups.push(pairs.slice(k, k + 2));
    const body = groups
      .map((g) => {
        const you = g.some((p) => p.sides.includes(YOU) && (known || out));
        const feeds = r < T.rounds ? `<p class="mw-bk__feeds">Winners meet in <b>${matchName(r + 1, g[0].pairing / 2)}</b></p>` : "";
        return `<li class="mw-bk__pair${g.length === 1 ? " mw-bk__pair--single" : ""}${you ? " mw-bk__pair--you" : ""}">${g
          .map((p) => matchRow(p, { revealed: out || Boolean(p.bye), known }))
          .join("")}${g.length > 1 ? feeds : ""}</li>`;
      })
      .join("");
    return `<section class="mw-bk__round" aria-labelledby="r${r}-h">
  <div class="mw-bk__rh"><h2 class="display" id="r${r}-h">${roundName(r)}</h2><p>${out ? `Out at ${hhmm(revealTimes[i])}` : `<b>Reveals ${hhmm(revealTimes[i])}</b>`}</p></div>
  <ol class="mw-bk__pairs">${body}</ol>
</section>`;
  }).join("")}</div>`;
}

function bracketTree(revealedRounds) {
  return `<div class="mw-tree" aria-hidden="true">${BRACKET.map((pairs, i) => {
    const r = i + 1;
    const out = r <= revealedRounds;
    const known = r <= revealedRounds + 1;
    const groups = [];
    for (let k = 0; k < pairs.length; k += 2) groups.push(pairs.slice(k, k + 2));
    return `<div class="mw-tree__col"><p class="mw-tree__h"><b>${roundName(r)}</b><span>${out ? `Out at ${hhmm(revealTimes[i])}` : `<strong>Reveals ${hhmm(revealTimes[i])}</strong>`}</span></p>
<div class="mw-tree__body">${groups
      .map((g) => {
        const you = g.some((p) => p.sides.includes(YOU) && known);
        return `<div class="mw-tree__pair${you && r < T.rounds ? " mw-tree__pair--you" : ""}">${g
          .map((p) => `<div class="mw-tree__cell${p.sides.includes(YOU) && known ? " mw-tree__cell--you" : ""}">${matchRow(p, { revealed: out || Boolean(p.bye), known })}</div>`)
          .join("")}</div>`;
      })
      .join("")}</div></div>`;
  }).join("")}</div>`;
}

const legend = `<p class="legend"><span><i style="color:var(--color-moss)">&#10003;</i> went through</span><span><span class="chip chip--you">You</span> your path</span><span><span class="chip chip--auto">Auto</span> auto squad</span><span><span class="chip">Bye</span> counts as a win</span><span>(4) penalties</span></p>`;

function shares() {
  const rows = [...T.pickShares].sort((a, b) => b.pickFactor - a.pickFactor);
  const row = (s) => {
    const p = PLAYERS.get(s.player);
    const f = s.pickFactor;
    return `<tr><td><span class="who">${tierChip(p.rarity)}${esc(s.player)}</span></td><td class="r">${s.picks}</td><td class="own">${s.owners === null ? `<span class="rare">a rare pick</span>` : `of ${s.owners} owners`}</td><td class="r fac ${f >= 1.005 ? "fac--up" : f <= 0.995 ? "fac--down" : ""}"><i aria-hidden="true">${f >= 1.005 ? "&#9650;" : f <= 0.995 ? "&#9660;" : ""}</i>${f.toFixed(2)}</td></tr>`;
  };
  const table = (list) => `<div class="mw-shares-wrap"><table class="mw-shares"><thead><tr><th>Player</th><th class="r">Picked</th><th>Owners</th><th class="r">Pick factor</th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>`;
  const half = Math.ceil(rows.length / 2);
  return `<section class="sec" aria-labelledby="ps-h">
  <div class="sec__h"><h2 class="display h2" id="ps-h">Who picked whom</h2></div>
  <p class="small muted" style="max-width:42rem">How many managers picked each Player, out of the entrants who own one. The fewer who picked a Player, the bigger the boost. Auto squads don&rsquo;t count. Owners are shown only when at least ${MIDWEEK.ownerCountMin} entrants own the Player.</p>
  <div class="mw-shares-cols">${table(rows.slice(0, half))}${table(rows.slice(half))}</div>
</section>`;
}

add({
  file: "Bracket-Revealing.dc.html", page: "bracket", route: "/club/midweek/2026-10-05", state: "mid-reveal, rounds 1–2 out (21:05)",
  rule: "§44.6 32 slots, byes, winners of 2k−1 and 2k meet; §44.9 each round at its reveal time",
  note: "22 entrants in 32 slots. Phones get the bracket as a list of rounds in order, each pair joined by a bracket line that names the match its winners meet in, so it reads top to bottom and in the same order to a screen reader. From lg the same data draws as a five-column tree; the tree is aria-hidden and the list stays the accessible version. The quarter-finals are known (both round-2 winners are out) but unplayed; the semis show who they wait on.",
  body: () =>
    chrome(`<div class="wrap">
  ${pageHead({ back: "Midweek Madness", kicker: `Midweek Madness &middot; ${LOCK}`, title: "The bracket", lede: "" })}
  <section class="panel" aria-label="Tonight">${clock(eveningStops(2, { youThrough: 2 }), { label: "Jump to a round" })}</section>
  ${legend}
  ${bracketList(2)}
  ${bracketTree(2)}
</div>`),
});

add({
  file: "Bracket-Complete.dc.html", page: "bracket", route: "/club/midweek/2026-10-05", state: "complete, with pick shares",
  rule: "§44.9 pick shares at complete, owner counts only at 3 or more (ADR-091)",
  note: "After the final. Your path stays highlighted to where it ended. Pick shares follow the bracket: two of the 25 Players picked have fewer than three owners and read \"a rare pick\", never a count.",
  body: () =>
    chrome(`<div class="wrap">
  ${pageHead({ back: "Midweek Madness", kicker: `Midweek Madness &middot; ${LOCK}`, title: `${esc(T.champion)} won it`, lede: "" })}
  <section class="panel" aria-label="Tonight">${clock(eveningStops(5, { youThrough: 2 }), { label: "Jump to a round" })}</section>
  ${legend}
  ${bracketList(5)}
  ${bracketTree(5)}
  ${shares()}
  ${seedLine({ seed: T.seed })}
</div>`),
});

// ---------------------------------------------------------------- reports ----

function report(m) {
  const r = m.round;
  return `<div class="wrap">
  <a class="back">&larr; ${LOCK} bracket</a>
  <article class="mw-rp">
    <div class="mw-rp__main">
      <header class="mw-rp__head">
        <p class="kicker">${matchName(r, m.pairing).replace(/^./, (c) => c.toUpperCase())} &middot; out at ${hhmm(revealTimes[r - 1])}</p>
        <h1 class="display mw-rp__headline">${esc(m.report.headline)}</h1>
        ${scoreboard(m)}
        ${m.report.facts.length ? `<ul class="mw-facts">${m.report.facts.map((f) => `<li>${esc(f.text)}</li>`).join("")}</ul>` : ""}
      </header>
      <section class="sec" aria-labelledby="tl-h"><h2 class="display h2" id="tl-h">How it went</h2>${timeline(m)}</section>
      ${shootout(m)}
    </div>
    <aside class="mw-rp__side">${whyPanel(m)}</aside>
  </article>
</div>`;
}

add({
  file: "Report-Thrashing.dc.html", page: "bracket", route: "/club/midweek/2026-10-05/match/[matchId]", state: "report: a thrashing (Joris 7–0 Emma, auto squad)",
  rule: "§44.10 layout; 8 moments is the timeline's maximum",
  note: "The longest timeline the renderer makes (8 moments, every goal). Emma's side is an auto squad, so each card carries the handicap chip and no owner count (ADR-093: \"auto squad\" instead of a pick label).",
  body: () => chrome(report(matchesBy.get("2/7"))),
});

add({
  file: "Report-Shootout.dc.html", page: "bracket", route: "/club/midweek/2026-10-05/match/[matchId]", state: "report: a shoot-out, your match (Sophie 2–2 Sanne, 7–6 pens)",
  rule: "§44.5 penalties, sudden death; §44.10 scored kicks as a tally, misses narrated",
  note: "Your own quarter-final. The tally shows every kick (ringed ones are sudden death); the narrated lines are only the misses and the decider, as the renderer produces them. The score stays side-ordered (Sophie left, Sanne right) everywhere on the page; report.score is winner-first and is not used in the scoreboard.",
  body: () => chrome(report(matchesBy.get("3/1"))),
});

add({
  file: "Report-Injured.dc.html", page: "bracket", route: "/club/midweek/2026-10-05/match/[matchId]", state: "report: injured Players (Mila 0–3 Eline)",
  rule: "§44.3 fitness for injured Live cards; §44.10 injured variants only for cards injured at the lock",
  note: "Esther M. and Roos N. were injured at the lock. The injury asides come from the phrasebook; the why panel shows the fitness factor below 1.00 and the plaster chip, with the word \"Injured\" so the cast is never colour alone.",
  body: () => chrome(report(matchesBy.get("1/7"))),
});

// ----------------------------------------------------------- entry points ----

function homeContext(midweekCard) {
  const risers = ["Sem O.", "Anouk B.", "Tess F.", "Wout Y.", "Olaf G."];
  return `<div class="wrap">
  <header class="home-head"><div style="display:grid;gap:14px"><p class="kicker">Terrible Football Haarlem</p><h1 class="display">This week in KUT</h1></div><span class="btn btn--primary">${icon("IconPack")}Open a pack</span></header>
  ${midweekCard}
  <p class="ctx-label">Home as it is today</p>
  <div class="ctx" style="display:grid;gap:32px">
    <dl class="statbar"><div><dt>KUT Coins</dt><dd style="color:var(--color-brass)">1,240</dd></div><div><dt>Club Value</dt><dd>2,315</dd></div><div><dt>Rank</dt><dd style="color:var(--color-steel)">#9</dd></div></dl>
    <section class="sec"><h2 class="display h2">Top 5 risers this week</h2><div class="risers">${risers.map((n) => card(n)).join("")}</div></section>
  </div>
</div>`;
}

add({
  file: "Home-BeforeLock.dc.html", page: "entry", route: "/", state: "Home card before the lock (not picked)",
  rule: "§47 Home answers \"what changed?\"; §44.2 auto squads",
  note: "The card sits directly under the Home header, above the stat bar: it is the one thing on Home with a deadline. The saved variant reads \"Your five are in\" with the five minis; see HANDOFF copy.",
  body: () =>
    chrome(
      homeContext(`<a class="mw-entry">
  <div style="display:grid;gap:10px">
    <div class="mw-entry__top"><div><p class="kicker">Midweek Madness &middot; ${LOCK}</p><h2 class="display mw-entry__title">Pick your five</h2></div></div>
    <p class="mw-entry__body">Squads lock <b>Wednesday at 20:00</b>, in 1 day, 4 h. You haven&rsquo;t picked yet, so an auto squad would play for you, heavily handicapped.</p>
    <p class="mw-entry__minis" aria-hidden="true">${[1, 2, 3, 4, 5].map(() => `<span class="mw-mini mw-mini--trialist"><b>?</b></span>`).join("")}</p>
  </div>
  <span class="btn btn--primary">Pick your five</span>
</a>`),
    ),
});

add({
  file: "Home-Live.dc.html", page: "entry", route: "/", state: "Home card during the reveal (round 2 is out)",
  rule: "§44.1 reveal times",
  note: "Same slot, same size, Wednesday evening. It says what just happened to you and when the next thing happens, with the evening's clock in compact form.",
  body: () =>
    chrome(
      homeContext(`<a class="mw-entry">
  <div style="display:grid;gap:12px">
    <div><p class="kicker">Midweek Madness &middot; live</p><h2 class="display mw-entry__title">Round 2 is out</h2></div>
    <p class="mw-entry__body"><b>You beat Eline 1&ndash;0.</b> Quarter-final against Sophie at 21:30.</p>
    ${clock(eveningStops(2, { youThrough: 2 }).slice(1), { compact: true })}
  </div>
  <span class="btn btn--secondary">Follow the bracket</span>
</a>`),
    ),
});

add({
  file: "Collection-Card.dc.html", page: "entry", route: "/club/collection", state: "Collection strip (before and after the lock)",
  rule: "ADR-053 retired /club; the brief's \"Club page\" card goes here (owner decision)",
  note: "The Club page no longer exists (ADR-053: /club redirects here). The card the plan put on club/page.tsx becomes a one-line strip under the Collection header, the page where your cards are. Before the lock it asks for a pick; from the lock to the final it links to tonight.",
  body: () =>
    chrome(
      `<div class="wrap">
  <header class="ph"><p class="kicker">Your club</p><h1 class="display">Collection</h1><p class="small faint">13 cards &middot; 12 Players &middot; Club Value 2,315</p></header>
  <a class="mw-strip"><span aria-hidden="true" style="display:flex;gap:3px">${mini("Dirk S.")}</span><p><b>Midweek Madness: your five are in</b>Change them until Wed 20:00.</p><span aria-hidden="true" class="mw-strip__arrow">&rarr;</span></a>
  <a class="mw-strip"><span aria-hidden="true" class="mw-mini mw-mini--trialist"><b>?</b></span><p><b>Midweek Madness: pick five of these</b>Squads lock Wed 20:00. No pick, auto squad.</p><span aria-hidden="true" class="mw-strip__arrow">&rarr;</span></a>
  <a class="mw-strip"><span aria-hidden="true">${mini("Dirk S.")}</span><p><b>Your five are playing tonight</b>Quarter-final at 21:30.</p><span aria-hidden="true" class="mw-strip__arrow">&rarr;</span></a>
  <p class="ctx-label">Three states of one strip; only one shows at a time</p>
  <div class="ctx"><div class="mw-pick-grid" style="list-style:none">${["Yara Q.", "Kees R.", "Lotte S.", "Dirk S.", "Mo A."].map((n) => `<div>${card(n)}</div>`).join("")}</div></div>
</div>`,
      { active: "collection" },
    ),
});

function settingsPage(panel) {
  return chrome(`<div class="wrap wrap--narrow">
  <header class="ph"><p class="kicker">Account</p><h1 class="display">Settings</h1></header>
  <div class="panel ctx"><p class="kicker kicker--faint">Signed in as</p><p style="font-size:24px;font-weight:900;margin-top:8px">Sanne V.</p></div>
  ${panel}
  <div class="panel ctx"><p class="display" style="font-size:30px">My card</p><p class="small faint" style="margin-top:8px">Upload your player photo and choose your archetype.</p></div>
</div>`);
}

add({
  file: "Settings-TakingPart.dc.html", page: "settings", route: "/settings", state: "Midweek panel: taking part, opt-out confirmation open",
  rule: "ADR-091 entry is the default, the opt-out is the consent; §44.2 an opt-out before the lock applies that week",
  note: "The panel sits between the club name and My card. Opting out is two steps because it deletes this week's saved squad (set_midweek_opt_out does that before the lock). After the lock the confirmation says it applies from next week instead.",
  desktop: false,
  body: () =>
    settingsPage(`<section class="panel" aria-labelledby="mw-set-h">
  <div style="display:grid;gap:16px">
    <div class="switch-row"><div><h2 class="display" style="font-size:30px" id="mw-set-h">Midweek Madness</h2><p class="small muted" style="margin-top:6px">A knockout for five of your cards, every Wednesday.</p></div><span class="switch" role="switch" aria-checked="true" aria-labelledby="mw-set-h"></span></div>
    <p class="switch__state" style="color:var(--color-moss)">You&rsquo;re taking part</p>
    <ul class="bul">
      <li>Members see <b>the five cards you enter</b>, or your auto squad, from 20:30 on the Wednesday, with their numbers for the week.</li>
      <li><b>The rest of your collection is never shown.</b></li>
      <li>Opting out takes you out completely: no squad, no auto squad, nothing shown.</li>
    </ul>
    <div class="confirm" role="group" aria-labelledby="mw-confirm-h">
      <p style="font-weight:900" id="mw-confirm-h">Opt out of Midweek Madness?</p>
      <p class="small muted">Your saved five for ${LOCK} will be removed and you won&rsquo;t be entered. You can come back any time before a Wednesday&rsquo;s lock.</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px"><span class="btn btn--danger btn--small">Opt out</span><span class="btn btn--secondary btn--small">Keep playing</span></div>
    </div>
  </div>
</section>`),
});

add({
  file: "Settings-OptedOut.dc.html", page: "settings", route: "/settings", state: "Midweek panel: opted out",
  rule: "§44.2 an opted-out member is never entered",
  note: "One tap to come back, no confirmation: taking part again shows nothing until the member (or their auto squad) is entered at the next lock.",
  desktop: false,
  body: () =>
    settingsPage(`<section class="panel panel--dashed" aria-labelledby="mw-set-h">
  <div style="display:grid;gap:14px">
    <div class="switch-row"><div><h2 class="display" style="font-size:30px" id="mw-set-h">Midweek Madness</h2><p class="small muted" style="margin-top:6px">A knockout for five of your cards, every Wednesday.</p></div><span class="switch" role="switch" aria-checked="false" aria-labelledby="mw-set-h"></span></div>
    <p class="switch__state faint">You&rsquo;ve opted out</p>
    <p class="small muted">You aren&rsquo;t entered and none of your cards are shown. Switch it back on to be in for ${LOCK}, picked or auto.</p>
  </div>
</section>`),
});

add({
  file: "HowItWorks-Midweek.dc.html", page: "settings", route: "/how-it-works", state: "section 12, Midweek Madness",
  rule: "§44 in members' words; ADR-091 the rules page says plainly that your five are shown",
  note: "Section 12, after Messages, in the page's own Section style. Numbers come from shared config at render time (MIDWEEK, roundPayouts), as the other sections do; none are typed into the copy.",
  desktop: false,
  body: () => {
    const sizes = [[4, 2], [8, 3], [16, 4], [32, 5]].map(([n, r]) => [n, roundPayouts(r)]);
    return chrome(`<div class="wrap wrap--read">
  <header class="ph"><p class="kicker">The rules</p><h1 class="display">How KUT works</h1></header>
  <p class="ctx-label">Sections 1&ndash;11 as today</p>
  <section class="hiw-sec" aria-labelledby="hiw-mw">
    <h2 class="display" id="hiw-mw">12. Midweek Madness</h2>
    <p>Every Wednesday, five of your cards play a knockout against everyone else&rsquo;s. You pick them during the week, the bracket is played the moment squads lock, and the results come out round by round that evening.</p>
    <h3>The week</h3>
    <ul><li>Pick up to five cards from your collection, <strong>one per Player</strong>, any time until <strong>Wednesday 20:00</strong>. Change them as often as you like.</li>
    <li>Round 1 comes out at 20:30, then a round every half hour until the final.</li>
    <li>No TFH session the week before means a club break: no Midweek Madness that week.</li></ul>
    <h3>If you don&rsquo;t pick</h3>
    <p>You still play. An <strong>auto squad</strong> of up to five random Players from your collection takes your place, heavily handicapped. It rarely gets far; picking is always better. Empty slots are filled by <strong>trialists</strong>: Common All-rounders at OVR ${MIDWEEK.trialist.ovr}, handicapped so a real card always beats one.</p>
    <h3>What makes a card strong</h3>
    <ul><li><strong>OVR</strong> counts, but only a little: the gap between a Common and a Holo is small.</li>
    <li><strong>Form</strong>: each Player gets one roll for the week, the same for every squad that fields them.</li>
    <li><strong>Pick</strong>: the fewer managers who pick a Player, the bigger their boost. Popular picks get a small dent.</li>
    <li><strong>Fitness</strong>: an injured Player&rsquo;s Live card plays on, at slightly less.</li>
    <li><strong>Day</strong>: a fresh roll every match, so upsets happen.</li></ul>
    <p>Archetypes set your shape: attackers make chances, playmakers create them, defenders stop them. <strong>Take a Goalkeeper</strong>: without one, your best defender goes in goal and keeps goal much worse. You can change your own archetype once every 14 days.</p>
    <h3>Coins</h3>
    <p>Every match you win pays KUT Coins, more each round. A bye counts as a win. The champion takes ${MIDWEEK.championTotal} in all. Coins are paid after the final.</p>
    <table class="tbl"><thead><tr><th>Entrants</th><th>Pay per win, round by round</th></tr></thead><tbody>${sizes.map(([n, p]) => `<tr><td>up to ${n}</td><td>${p.join(" &middot; ")}</td></tr>`).join("")}</tbody></table>
    <h3>What other members see</h3>
    <p class="hiw-callout hiw-callout--steel">From 20:30 on the Wednesday, members see the five cards you entered (or your auto squad) and their numbers for the week. Nobody ever sees the rest of your collection. Owner counts are shown only when at least ${MIDWEEK.ownerCountMin} members own a Player. Don&rsquo;t want to take part? <strong>Opt out in Settings</strong> and you&rsquo;re never entered or shown.</p>
    <h3>Fair draws</h3>
    <p>Every draw comes from a secret seed fixed before anyone picks. Its fingerprint, the <strong>fairness seal</strong>, is on the page all week, and the seed is published after the final so anyone can check it. Nobody, admins included, can re-roll a week.</p>
  </section>
</div>`);
  },
});

// ------------------------------------------------------------------ admin ----

add({
  file: "Admin-Midweek.dc.html", page: "settings", route: "/admin/midweek", state: "running, with rehearsal output",
  rule: "§44.8 launch switch, rehearsal writes nothing; §44.11 no weekly admin work",
  note: "Utilitarian, like the other admin tabs: the Midweek tab joins the row. Rehearsal output is the field, the auto squads, a round-by-round summary and the log. It uses a throwaway seed, so its champion is labelled as not the real result.",
  body: () => {
    const autos = T.entries.filter((e) => e.auto);
    const rows = BRACKET.map((pairs, i) => {
      const r = i + 1;
      const byes = pairs.filter((p) => p.bye).length;
      return `<tr><td><b>${roundName(r)}</b></td><td>${pairs.length - byes}</td><td>${byes}</td><td>${PAY[i]}</td><td>${hhmm(revealTimes[i])}</td></tr>`;
    }).join("");
    return chrome(
      `<div class="wrap">
  <header class="ph"><h1 class="display">Midweek Madness</h1></header>
  <div class="adm-grid">
    <div style="display:grid;gap:24px">
      <section class="panel" aria-labelledby="adm-sw">
        <div style="display:grid;gap:12px">
          <div class="switch-row"><h2 id="adm-sw" style="font-size:18px;font-weight:900">Running</h2><span class="switch" role="switch" aria-checked="true" aria-labelledby="adm-sw"></span></div>
          <p class="small muted">While running, a new tournament opens as soon as the last one ends. Pausing stops new ones; a tournament that is already open still plays unless you void it.</p>
        </div>
      </section>
      <section class="panel" aria-labelledby="adm-cur">
        <div style="display:grid;gap:14px">
          <h2 id="adm-cur" style="font-size:18px;font-weight:900">This week &middot; ${LOCK}</h2>
          <dl class="kv"><div><dt>Status</dt><dd style="font-size:18px">Open</dd></div><div><dt>Locks</dt><dd style="font-size:18px">Wed ${LOCK_T}</dd></div><div><dt>Squads saved</dt><dd>15</dd></div><div><dt>Opted out</dt><dd>1</dd></div></dl>
          <p class="mw-seed"><span>Seal <code>${T.seedHash.slice(0, 16)}&hellip;</code></span></p>
          <a class="link">Void this week&hellip;</a>
        </div>
      </section>
    </div>
    <section class="panel" aria-labelledby="adm-reh">
      <div style="display:grid;gap:16px">
        <div class="sec__h"><h2 id="adm-reh" style="font-size:18px;font-weight:900">Rehearsal</h2><span class="btn btn--secondary btn--small">Run again</span></div>
        <p class="small muted">Runs the engine on the squads saved right now plus auto squads, with a throwaway seed. Writes nothing and pays nothing. Last run Tue 6 Oct, 21:14.</p>
        <dl class="kv"><div><dt>Field</dt><dd>${T.entries.length}<small> entrants</small></dd></div><div><dt>Picked</dt><dd>${T.entries.length - autos.length}</dd></div><div><dt>Auto</dt><dd>${autos.length}</dd></div><div><dt>Bracket</dt><dd>${T.size}<small> slots, ${T.rounds} rounds</small></dd></div></dl>
        <table class="admin-table"><thead><tr><th>Round</th><th>Matches</th><th>Byes</th><th>Pays</th><th>Out at</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="small muted"><b style="color:var(--color-ink)">Auto squads:</b> ${autos.map((e) => esc(e.manager)).join(", ")}.</p>
        <p class="small muted"><b style="color:var(--color-ink)">Rehearsal champion:</b> ${esc(T.champion)}. <span class="faint">Throwaway seed, so not tonight&rsquo;s result.</span></p>
        <pre class="log"><span class="ok">ok</span>  22 entrants &ge; ${MIDWEEK.minEntrants}; last week had a published session
<span class="ok">ok</span>  ${T.payouts.reduce((a, p) => a + p.amount, 0)} coins in a full bracket
<span class="w">warn</span> Wessel: slots 4, 5 empty &rarr; trialists
<span class="w">warn</span> Niels: slot 3 card no longer owned &rarr; trialist
<span class="ok">ok</span>  0 errors</pre>
      </div>
    </section>
  </div>
</div>`,
      { active: null, admin: adminBar("midweek"), initials: "MV" },
    );
  },
});

add({
  file: "Admin-Void.dc.html", page: "settings", route: "/admin/midweek", state: "void a week (mid-reveal, before payout)",
  rule: "§44.8 void needs a reason, works only before payout, never recomputes",
  note: "Void is destructive and member-visible, so it takes a reason (1–200 characters, shown to members verbatim) and a tick. After payout the section is replaced by a pointer to wallet adjustments.",
  body: () =>
    chrome(
      `<div class="wrap wrap--narrow">
  <header class="ph"><h1 class="display">Void ${LOCK}</h1></header>
  <section class="panel panel--brick" aria-labelledby="void-h">
    <div style="display:grid;gap:16px">
      <p class="small muted" id="void-h"><b style="color:var(--color-ink)">Status: simulated, round 2 out.</b> Voiding hides every result of this week, including rounds already shown, and pays nobody. It can&rsquo;t be undone, and it can&rsquo;t re-run the week. It&rsquo;s possible until the coins are paid after the final at ${FINAL_AT}.</p>
      <div class="field"><label for="void-reason">Reason, shown to every member</label><textarea id="void-reason">Roster import gave Tim two cards he didn&rsquo;t own, so his squad wasn&rsquo;t fair.</textarea><p class="hint">Up to 200 characters. 79 used.</p></div>
      <p class="check"><i data-on aria-hidden="true"></i><span>I understand nobody is paid for ${LOCK} and the results disappear.</span></p>
      <div style="display:flex;flex-wrap:wrap;gap:10px"><span class="btn btn--danger">Void ${LOCK}</span><span class="btn btn--secondary">Cancel</span></div>
    </div>
  </section>
  <section class="panel panel--dashed"><p class="small muted"><b style="color:var(--color-ink)">After payout</b> this section reads: &ldquo;${LOCK} has been paid, so it can&rsquo;t be voided. Correct a member&rsquo;s coins with a wallet adjustment in Economy.&rdquo;</p></section>
</div>`,
      { active: null, admin: adminBar("midweek"), initials: "MV" },
    ),
});

export const SCREENS = S;
