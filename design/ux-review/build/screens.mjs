// Every UX review mockup: one entry per screen and state. Each body is one
// responsive page; build.mjs renders it at 320, 412 and 1440 px.
import { React, renderToStaticMarkup, src } from "../../midweek/build/source.mjs";
import { slotRow, keeperCheck, seedLine } from "../../midweek/build/lib.mjs";
import {
  T, PLAYERS, YOU, card, mini, esc, icon, finalScore, archLabel, tierLabel, roundName, roundShort,
  status, roundStart, at, hhmm, hhmmss, fullTimeAt, seen, mOf, chrome, competeTabs, head,
  placeholder, clock, colourNames, mgr, scoreboard, laneTimeline, latest, shootoutLive, whyList,
  mrow, byeRow, fiveList, entryOf, coinsFor, shortMatch,
} from "./lib.mjs";

const { LiveCard } = src("components/live-card.tsx");
const { ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");

// ------------------------------------------------------ Sanne's collection ----
// Her real sample five, plus nine more Players. Archetypes on the extras are
// set here so the picker's archetype filter has something to filter (about 80%
// of the real roster is All-rounder until the rotation ships).
const FIVE = ["Dirk S.", "Mo A.", "Gijs H.", "Iris W.", "Bas V."];
const EXTRA_ARCH = ["goalkeeper", "defender", "speedster", "speedster", "finisher", "playmaker", "all_rounder", "all_rounder", "all_rounder"];
const extras = [...PLAYERS.values()].filter((p) => !FIVE.includes(p.displayName)).sort((a, b) => b.ovr - a.ovr).slice(3, 12);
extras.forEach((p, i) => { p.archetype = EXTRA_ARCH[i]; p.injured = false; });
const COLLECTION = [...extras.map((p) => p.displayName), ...FIVE];
// KB-028: one Player's archetype changed after the week opened.
const CHANGED = { name: extras[0].displayName, now: "Goalkeeper", next: "Speedster" };

function cardWithNote(name, note) {
  const p = PLAYERS.get(name);
  const off = ARCHETYPE_OFFSETS[p.archetype];
  const s = (k) => Math.max(1, Math.min(99, p.ovr + off[k]));
  return renderToStaticMarkup(
    React.createElement(LiveCard, {
      size: "grid",
      badge: note ? React.createElement("span", { className: "ux-cardnote" }, note) : undefined,
      player: { id: p.id, injured: p.injured, displayName: p.displayName, archetype: p.archetype, liveOvr: p.ovr, rarityTier: p.rarity, pac: s("pac"), sho: s("sho"), pas: s("pas"), dri: s("dri"), def: s("def"), phy: s("phy") },
    }),
  );
}
const nextNote = (name) => (name === CHANGED.name ? `${CHANGED.next} from next week` : null);
const archLine = (name) => {
  const p = PLAYERS.get(name);
  return name === CHANGED.name ? CHANGED.now : archLabel(p.archetype);
};

// -------------------------------------------------------------- pieces -----

const lastWeek = `<a class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px">
  <span><span class="kicker kicker--faint">Last Wednesday &middot; 30 Sep</span><span style="display:block;margin-top:4px">You reached the semi-finals. +100 KUT Coins. Lieke won it.</span></span>
  <span class="link" style="white-space:nowrap">Bracket &rarr;</span></a>`;

const lockLine = (countdown) => `<p class="ux-lock">Squads lock <b>Wed 7 Oct, 19:55</b> <span class="cd">in ${countdown}</span></p>`;
const privacy = `<p class="mw-privacy">${icon("IconInfo")}<span>From 19:55 on Wednesday, members see the five cards you enter, never the rest of your collection. Your cards are never at stake: a result only pays coins.</span></p>`;

/** MidweekSaveBar (KB-029): status left, actions right; sticky only when dirty. */
function saveBar(kind) {
  const st = {
    none: ["none", "Not picked yet", "No pick by 19:55 on Wednesday? An auto squad plays for you, heavily handicapped."],
    dirty: ["dirty", "Unsaved changes", "Nothing counts until you save."],
    saved: ["saved", "Saved Tue 6 Oct, 14:02", "Change it as often as you like until Wed 7 Oct, 19:55."],
  }[kind];
  const act =
    kind === "saved"
      ? `<span class="btn btn--secondary btn--small">Change your five</span>`
      : `<span class="btn btn--secondary btn--small">Load last week&rsquo;s five</span><span class="btn btn--primary btn--small"${kind === "none" ? ' aria-disabled="true"' : ""}>Save your five</span>`;
  return `<div class="ux-savebar${kind === "dirty" ? " ux-savebar--sticky" : ""}"><div class="ux-savebar__st">${status(st[0], st[1])}<small>${st[2]}</small></div><div class="ux-savebar__act">${act}</div></div>`;
}

/** MidweekPickRow: the phone's compact list (from lg the LiveCard grid). */
function pickRow(name, { state = "add", slot = null } = {}) {
  const p = PLAYERS.get(name);
  const btn = state === "in" ? `<span class="chip chip--won">&#10003; In</span>` : `<span class="btn btn--secondary btn--small">${slot ? `Slot ${slot}` : "Add"}</span>`;
  return `<li class="ux-pick${state === "in" ? " ux-pick--in" : ""}">${mini(name)}<div><p class="ux-pick__name">${esc(p.displayName)}</p><p class="ux-pick__meta">${archLine(name)} &middot; ${tierLabel(p.rarity)} &middot; OVR ${p.ovr}</p>${nextNote(name) ? `<p class="ux-next">${CHANGED.now} this week, ${CHANGED.next} from next</p>` : ""}</div>${btn}</li>`;
}
function pickGrid(names, inFive, activeSlot) {
  return `<ul class="ux-pick-grid">${names
    .map((n) => {
      const isIn = inFive.includes(n);
      return `<li class="mw-pick${isIn ? " mw-pick--in" : ""}"><div class="mw-pick__card">${cardWithNote(n, nextNote(n))}</div>${isIn ? `<span class="mw-pick__btn mw-pick__btn--in">&#10003; In your five</span>` : `<span class="mw-pick__btn">${activeSlot ? `Put in slot ${activeSlot}` : "Add to your five"}</span>`}</li>`;
    })
    .join("")}</ul>`;
}
function filterRow(active = "all") {
  const count = (a) => COLLECTION.filter((n) => PLAYERS.get(n).archetype === a).length;
  const f = [
    ["all", "All", COLLECTION.length], ["goalkeeper", "Goalkeepers", count("goalkeeper")], ["defender", "Defenders", count("defender")],
    ["speedster", "Speedsters", count("speedster")], ["finisher", "Finishers", count("finisher")], ["playmaker", "Playmakers", count("playmaker")],
    ["all_rounder", "All-rounders", count("all_rounder")],
  ];
  return `<nav class="ux-filter" aria-label="Filter your cards by archetype">${f.map(([k, l, c]) => `<a${k === active ? ' aria-current="true"' : ""}>${l} <small>${c}</small></a>`).join("")}</nav>`;
}
/** The desktop team sheet with the KB-028 note under a changing card. */
function sheet(names, activeSlot) {
  return `<ol class="mw-sheet" aria-label="Your five">${names
    .map((n, i) => {
      const k = i + 1;
      const inner = n
        ? cardWithNote(n, nextNote(n))
        : k === activeSlot
          ? `<div class="mw-trialist mw-trialist--empty"><b>+</b><span>Choosing</span><p>Pick a card below for slot ${k}.</p></div>`
          : `<div class="mw-trialist"><b>30</b><span>Trialist</span><p>Plays here if you leave it empty. Handicapped, so a real card is always better.</p></div>`;
      return `<li class="mw-sheet__slot${k === activeSlot ? " mw-sheet__slot--active" : ""}"><p class="mw-sheet__cap"><span>Slot ${k}</span>${n ? `<span class="icon-btn" aria-label="Remove ${esc(n)} from slot ${k}">&#10005;</span>` : ""}</p>${inner}${n && nextNote(n) ? `<p class="mw-sheet__next">${CHANGED.now} this week, ${CHANGED.next} from next</p>` : ""}</li>`;
    })
    .join("")}</ol>`;
}
function slotRows(names, activeSlot) {
  return `<ol class="mw-slots mw-slots--rows">${names
    .map((n, i) => {
      if (!n || n !== CHANGED.name) return slotRow(i + 1, n, { active: activeSlot === i + 1 });
      return slotRow(i + 1, n).replace(/<\/div>\s*<div class="mw-slot__act">/, `<p class="ux-next">${CHANGED.now} this week, ${CHANGED.next} from next</p></div><div class="mw-slot__act">`).replace(/(<p class="mw-slot__meta">)[^<]*/, `$1${CHANGED.now} &middot; ${tierLabel(PLAYERS.get(n).rarity)} &middot; OVR ${PLAYERS.get(n).ovr}`);
    })
    .join("")}</ol>`;
}

function picker({ five, activeSlot = null, bar, countdown, filter = "all", strip = true }) {
  const listed = filter === "all" ? COLLECTION : COLLECTION.filter((n) => PLAYERS.get(n).archetype === filter);
  return chrome(
    `<div class="wrap">
  ${competeTabs("midweek")}
  ${strip ? lastWeek : ""}
  <div style="display:grid;gap:10px">${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "Pick your five" })}${lockLine(countdown)}</div>
  <section class="sec" aria-labelledby="five-h">
    <div class="sec__h"><h2 class="display h2" id="five-h">Your five</h2></div>
    ${slotRows(five, activeSlot)}
    ${sheet(five, activeSlot)}
    ${five.some(Boolean) ? keeperCheck(five) : ""}
    ${saveBar(bar)}
    ${privacy}
  </section>
  <section class="sec" aria-labelledby="cards-h">
    <div class="sec__h"><h2 class="display h2" id="cards-h">Your cards</h2><p class="small faint">One slot per Player. Where you own two copies, the stronger one plays.</p></div>
    ${filterRow(filter)}
    <ul class="ux-picks">${listed.map((n) => pickRow(n, { state: five.includes(n) ? "in" : "add", slot: activeSlot })).join("")}</ul>
    ${pickGrid(listed, five, activeSlot)}
  </section>
</div>`,
    { compete: bar === "saved" ? null : "pick" },
  );
}

// ---------------------------------------------------------------- Home -----

const ACTIVITY = [
  ["Sale", "Joris B. bought Djanco from Lieke M. for 430 KUT Coins.", "Today"],
  ["Packs", "Sophie D. opened 3 packs.", "Today"],
  ["Midweek", "Wout H. won Midweek Madness on 30 Sep.", "Wed 30 Sep"],
  ["Session", "Monday's session is published: 14 in, 9 G+A.", "Mon 28 Sep"],
  ["Trade", "Emma S. traded Max to Koen L. for 210 KUT Coins.", "Sun 27 Sep"],
  ["Packs", "Member B opened 5 packs.", "Sat 26 Sep"],
];
const risers = ["Laura", "Niels", "Joris", "Sophie", "Julia"]
  .map((m) => entryOf(m).cards.find((c) => !c.trialist)?.name)
  .filter(Boolean)
  .map((n) => n.replace(/ \([^)]*\)$/, ""));
function home(now) {
  return `<div class="wrap">
  <header class="ux-home-h"><p class="kicker">Terrible Football Haarlem</p><h1 class="display">This week in KUT</h1></header>
  <section class="ux-now" aria-label="Now">${now}</section>
  <div class="ux-stats">
    <a class="ux-stat"><span class="kicker kicker--faint">Club Value</span><b>6,653</b><small>See the maths &rarr;</small></a>
    <a class="ux-stat"><span class="kicker kicker--faint">Rank</span><b style="color:var(--color-steel)">#4</b><small>Standings &rarr;</small></a>
    <a class="btn btn--primary">${icon("IconPack")}Open a pack</a>
  </div>
  <section class="sec"><div class="sec__h"><h2 class="display h2">Top risers</h2><a class="link">Players &rarr;</a></div>
    <div class="ux-risers">${[...new Set(risers)].slice(0, 5).map((n) => card(n)).join("")}</div></section>
  <section class="sec"><div class="sec__h"><h2 class="display h2">Club activity</h2></div>
    <ol class="ux-feed">${ACTIVITY.map(([k, d, t]) => `<li><span class="k">${k}</span><time>${t}</time><p>${esc(d)}</p></li>`).join("")}</ol></section>
</div>`;
}
const reportCard = `<a class="ux-nowcard ux-nowcard--brass"><span class="kicker">Your report &middot; +50 KUT Coins</span><div class="row-end"><h2 class="display">Add G+A &amp; kudos</h2><span class="link" style="font-size:20px" aria-hidden="true">&rarr;</span></div><p class="small faint">For Monday&rsquo;s session. Closes Thu 23:59.</p></a>`;

// ------------------------------------------------------------ evening ------

const R2 = mOf(2, 3); // Sanne v Eline
const FINAL = mOf(5, 0); // Sophie v Joris
const yourNight = (rows, foot) => `<section class="ux-block" aria-labelledby="night-h"><div class="ux-block__h"><h2 class="display" id="night-h">Your night</h2><p class="small faint">${foot}</p></div><ol class="mw-path" aria-label="Your night">${rows}</ol></section>`;
const pathRow = (r, time, text, coins, kind = "won") => `<li class="mw-path__row${kind === "won" ? "" : ` mw-path__row--${kind}`}"><p class="mw-path__round">${roundShort(r)}<b>${time}</b></p><p class="mw-path__what">${text}</p><p class="mw-path__coins">${coins ?? (kind === "out" ? `<span class="chip chip--out">Out</span>` : "")}</p></li>`;
const roundRows = (r, state) => T.matches.filter((m) => m.round === r).map((m) => mrow(m, typeof state === "function" ? state(m) : state)).join("");
const evening = (now, body, { youThrough, updated = true } = {}) =>
  chrome(`${clock(now, { youThrough, updated: updated ? now : null })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}${body}</div>`, { compete: "live" });

// ---------------------------------------------------------------- report ---

function matchPage(m, now, { kicker, mode }) {
  const live = mode === "live";
  const inplay = mode === "inplay";
  const v = now ? seen(m, now) : null;
  const top = `<div style="display:grid;gap:12px">
    <a class="back">&larr; Wed 7 Oct bracket</a>
    <p class="kicker">${kicker}</p>
    ${mode === "ft" ? `<h1 class="display ux-headline">${colourNames(m.report.headline, m)}</h1>` : ""}
  </div>`;
  const sb = inplay
    ? `<div class="ux-sb" role="group" aria-label="${esc(`${m.managers[0]} v ${m.managers[1]}, in play. The result shows at full time.`)}"><div class="ux-sb__side"><p class="ux-sb__name">${mgr(m, 0)}</p></div><div class="ux-sb__mid"><span class="ux-inplay">In play</span><p class="ux-sb__sub">result at full time</p></div><div class="ux-sb__side ux-sb__side--r"><p class="ux-sb__name">${mgr(m, 1)}</p></div></div>`
    : scoreboard(m, { now: live ? now : null });
  const story = inplay
    ? `<p class="panel small muted">You&rsquo;re not in this match, so it isn&rsquo;t shown chance by chance. Its result and report appear at full time, at the same moment for everyone. Members watch their own match and the final live.</p>
       <div class="ux-opp">${fiveList(entryOf(m.managers[0]))}${fiveList(entryOf(m.managers[1]))}</div>`
    : `${mode === "ft" ? `<ul class="ux-facts">${m.report.facts.map((f) => `<li>${colourNames(f.text, m)}</li>`).join("")}</ul>` : ""}
       <section class="sec" aria-labelledby="tl-h"><div class="sec__h"><h2 class="display h2" id="tl-h">How it went</h2>${live ? `<p class="small faint">A new chance every 20 seconds</p>` : ""}</div>${laneTimeline(m, live ? v.events : m.report.timeline, { newest: live })}</section>
       ${m.report.shootout && (!live || v.kicks.length) ? shootoutLive(m, live ? now : null) : ""}
       ${mode === "ft" && m.report.shootout ? `<ol class="mw-so__lines" style="display:grid;gap:6px">${m.report.shootout.lines.map((l) => `<li>${colourNames(l, m)}</li>`).join("")}</ol>` : ""}`;
  const why = whyList(m, { stats: mode === "ft", open: mode === "ft", tip: mode === "ft" ? [0, 0, "Form"] : null });
  return { top, sb, story, why };
}
function matchScreen(m, now, opts) {
  const p = matchPage(m, now, opts);
  const body = `<div class="wrap">${p.top}${p.sb}<div class="ux-report ux-report--split"><div class="ux-report">${p.story}</div>${p.why}</div>${opts.mode === "live" ? `<p class="ux-upd">Updated ${hhmmss(now)} &middot; checks for new chances every 20 seconds</p>` : ""}</div>`;
  return now ? chrome(`${clock(now, { youThrough: opts.youThrough ?? 5 })}<div style="margin-top:20px">${body}</div>`, { compete: "live" }) : chrome(body);
}

// ---------------------------------------------------------------- bracket --
// One model of every round, drawn twice: a list per round below lg, and from
// lg the tree (the shipped KB-031 shape: one shared row grid, a round-r
// pairing spanning 2^(r-1) round-1 rows). Neutral names; no team colours.

function bracketModel(now) {
  const stateOf = (m) => {
    if (now < roundStart(m.round)) return "upcoming";
    if (now >= fullTimeAt(m)) return "ft";
    return m.managers.includes(YOU) || m.round === T.rounds ? "live" : "inplay";
  };
  const settled = (f) => !f || now >= fullTimeAt(f);
  const rounds = [];
  for (let r = 1; r <= T.rounds; r++) {
    const cells = [];
    for (let k = 0; k < T.size / 2 ** r; k++) {
      const m = mOf(r, k);
      if (r === 1) {
        cells.push(m ? { m, state: stateOf(m) } : { bye: true, who: mOf(2, Math.floor(k / 2)).managers[k % 2] });
        continue;
      }
      const fa = mOf(r - 1, 2 * k);
      const fb = mOf(r - 1, 2 * k + 1);
      if (settled(fa) && settled(fb)) {
        cells.push({ m, state: stateOf(m) });
        continue;
      }
      const side = (f, s, j) =>
        settled(f) ? { name: m.managers[s] } : { label: r === 2 ? `Winner of ${f.managers.join(" v ")}` : `Winner, ${shortMatch(r - 1, j)}` };
      cells.push({ tbd: true, r, sides: [side(fa, 0, 2 * k), side(fb, 1, 2 * k + 1)] });
    }
    rounds.push(cells);
  }
  return rounds;
}

const youChip = (n) => (n === YOU ? `<span class="chip chip--you">You</span>` : "");
function tbdRow(cell) {
  const you = cell.sides.some((x) => x.name === YOU);
  const side = (x) => `<div class="ux-mrow__side"><span class="who"><span${x.label ? ' class="faint"' : ""}>${esc(x.name ?? x.label)}</span>${youChip(x.name)}</span></div>`;
  return `<div class="ux-mrow${you ? " ux-mrow--you" : ""}"><div class="ux-mrow__sides">${cell.sides.map(side).join("")}</div><span class="ux-mrow__state"><span>Kick-off</span><b class="t">${hhmm(roundStart(cell.r))}</b></span></div>`;
}
const listCell = (c) => (c.bye ? byeRow(c.who) : c.tbd ? tbdRow(c) : mrow(c.m, c.state));

/** One box in the desktop tree. */
function treeBox(c, r) {
  if (c.bye)
    return `<div class="ux-tb ux-tb--bye${c.who === YOU ? " ux-tb--you" : ""}"><p class="ux-tb__side"><span>${esc(c.who)}</span>${youChip(c.who)}<span class="chip">Bye</span></p></div>`;
  const sides = c.tbd
    ? c.sides.map((x) => ({ text: x.name ?? x.label, faint: !!x.label, you: x.name === YOU }))
    : c.m.managers.map((n, s) => ({ text: n, you: n === YOU, won: c.state === "ft" && s === c.m.report.winnerSide, lost: c.state === "ft" && s !== c.m.report.winnerSide, score: c.state === "ft" ? `${finalScore(c.m)[s]}${c.m.report.shootout ? `<small> (${c.m.report.shootout.score[s]})</small>` : ""}` : "" }));
  const state = c.tbd || c.state === "upcoming" ? `<span class="ux-tb__t">${hhmm(roundStart(r))}</span>` : c.state === "live" ? `<span class="ux-live">Live</span>` : c.state === "inplay" ? `<span class="ux-inplay">In play</span>` : "";
  const you = sides.some((x) => x.you);
  return `<div class="ux-tb${you ? " ux-tb--you" : ""}"><div class="ux-tb__sides">${sides
    .map((x) => `<p class="ux-tb__side${x.won ? " won" : ""}${x.lost ? " lost" : ""}${x.faint ? " faint" : ""}"><span>${esc(x.text)}</span>${x.you ? `<span class="chip chip--you">You</span>` : ""}${x.won ? `<span aria-hidden="true" class="mk">&#10003;</span>` : ""}${x.score ? `<b>${x.score}</b>` : ""}</p>`)
    .join("")}</div>${state ? `<div class="ux-tb__st">${state}</div>` : ""}</div>`;
}

function bracketPage(now) {
  const model = bracketModel(now);
  const list = model
    .map(
      (cells, i) =>
        `<section class="ux-block" id="r${i + 1}" aria-labelledby="r${i + 1}-h"><div class="ux-block__h"><h2 class="display" id="r${i + 1}-h">${roundName(i + 1)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(i + 1))}</p></div><div class="ux-rows">${cells.map(listCell).join("")}</div></section>`,
    )
    .join("");
  const rows = T.size / 2;
  const tree = `<div class="ux-tree" aria-hidden="true" style="grid-template-columns:repeat(${T.rounds}, minmax(0, 1fr));grid-template-rows:auto repeat(${rows}, 54px)">${model
    .map((cells, i) => {
      const r = i + 1;
      const span = 2 ** i;
      return `<p class="ux-tree__h" style="grid-column:${r};grid-row:1"><b>${roundName(r)}</b><span>Kick-off ${hhmm(roundStart(r))}</span></p>${cells
        .map((c, k) => `<div class="ux-tc${r > 1 ? " ux-tc--in" : ""}${r < T.rounds ? " ux-tc--out" : ""}" style="grid-column:${r};grid-row:${2 + k * span} / span ${span}">${treeBox(c, r)}</div>`)
        .join("")}`;
    })
    .join("")}</div>`;
  return `<div class="ux-bk-list">${list}</div>${tree}`;
}

// ---------------------------------------------------------------- screens --

const t = (s) => at(s);
const DRAW = t("19:57:30");
const LIVE = t("20:18:20");
const OUT = t("20:41:00");
const FINAL_LIVE = t("21:05:15");

export const PAGES = [
  { id: "nav", name: "Compete, Home and Messages" },
  { id: "picking", name: "Picking your five" },
  { id: "evening", name: "Wednesday evening" },
  { id: "matches", name: "Matches" },
  { id: "bracket", name: "Bracket and past weeks" },
];

export const SCREENS = [
  // ------------------------------------------------------------------ nav --
  {
    file: "Home-Now-Picking.dc.html", page: "nav", route: "/", state: "Tuesday, not picked, report open",
    rule: "Review problem 1; ADR-097 Home card; owner decision C (Compete)",
    note: "A short header, then the 'now' stack ordered by deadline: picking (locks Wed 19:55), then the report (closes Thu). Coins tile gone (the pill shows it). Compete carries 'Pick' until the five are saved.",
    body: () => chrome(home(`<a class="ux-nowcard ux-nowcard--brass"><div class="ux-nowcard__top"><span class="kicker">Midweek Madness &middot; Wed 7 Oct</span><span class="small" style="color:var(--color-brass);font-weight:800">in 22 h</span></div><h2 class="display">Pick your five</h2><p class="small muted">Squads lock Wednesday at 19:55. You haven&rsquo;t picked yet, so an auto squad would play for you, heavily handicapped.</p><span class="btn btn--primary">Pick your five</span></a>${reportCard}`), { active: "home", compete: "pick", unread: 2 }),
  },
  {
    file: "Home-Now-Live.dc.html", page: "nav", route: "/", state: "Wednesday 20:18, your match live",
    rule: "Review problem 1; MM 2.0 'matches unfold chance by chance'",
    note: "During the evening the live card leads Home: your match's score, the latest chance in team colours, and one button. Home doesn't poll: it shows the match as it stood when the page loaded, and the button goes to the live page.",
    body: () => chrome(home(`<a class="ux-nowcard ux-nowcard--live"><div class="ux-nowcard__top"><span class="kicker">Midweek Madness &middot; ${roundName(2)}</span><span class="ux-live">Live</span></div>${scoreboard(R2, { now: LIVE, mini: true })}<p class="small muted">${(() => { const v = seen(R2, LIVE); const e = v.events[v.events.length - 1]; return `${e.minute}&prime; ${colourNames(e.text, R2)}`; })()}</p><span class="btn btn--primary">Watch your match</span></a>${reportCard}`), { active: "home", compete: "live", unread: 2 }),
  },
  {
    file: "Compete-Standings.dc.html", page: "nav", route: "/leaderboard", state: "Standings under Compete",
    rule: "Owner decision C: Leaderboard becomes Compete › Standings; /leaderboard keeps its URL",
    note: "Section tabs Midweek · Standings · Players on all three. The heading says Standings, like the section tab. The table itself is today's, unchanged.",
    body: () => chrome(`<div class="wrap wrap--read">${competeTabs("standings")}${head({ kicker: "KUT standings", title: "Standings", lede: "Club Value is your KUT Coins, plus the discard value of every card you own, plus your linked Player&rsquo;s Live card counted 4&times;." })}
      <table class="ux-table"><thead><tr><th>#</th><th>Member &amp; club</th><th style="text-align:right">Value</th></tr></thead><tbody>${[["Joris B.", "De Kelder", 8120, 31], ["Lieke M.", "Lieke's Club", 7310, 28], ["Sophie D.", "FC Zondag", 6980, 26], ["Sanne V.", "Sanne's Club", 6653, 24], ["Wout H.", "Wout's Club", 5420, 19], ["Emma S.", "Emma's Club", 4870, 17]].map(([n, c, v, k], i) => `<tr${n === "Sanne V." ? ' class="you"' : ""}><td>${i + 1}</td><td><b>${n}</b>${n === "Sanne V." ? ' <span class="chip chip--you">You</span>' : ""}<small>${c} &middot; ${k} cards</small></td><td class="num">${v.toLocaleString("en-GB")}</td></tr>`).join("")}</tbody></table></div>`),
  },
  {
    file: "Messages.dc.html", page: "nav", route: "/messages", state: "linked rows; a result for every entrant",
    rule: "Review problem 3; owner answer 3 (every entrant gets a result message, amends ADR-096)",
    note: "Each message is one link to its subject; opening it marks it read. Unread rows carry a filled dot AND the word New. The Midweek result now reaches members who won nothing too.",
    body: () => chrome(`<div class="wrap wrap--read">${head({ kicker: "KUT inbox", title: "Messages" })}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><p class="small muted"><b style="color:var(--color-brass)">2 new</b> &middot; opening one marks it read</p><span class="btn btn--secondary btn--small">Mark all read</span></div>
      <div class="ux-inbox"><h2>Today</h2>
      ${msg(true, "Midweek Madness", "You went out in the quarter-finals", "Sophie beat you on penalties, 7–6. +50 KUT Coins. Joris won it.", "21:09", "Bracket")}
      ${msg(true, "Sale", "Djanco sold for 430 KUT Coins", "Joris B. bought your listing. 409 after the 5% market fee.", "17:20", "Wallet")}
      <h2>Earlier this week</h2>
      ${msg(false, "Trade offer", "Lieke M. offered 2 cards for Max", "Answer before Thu 18:00.", "Mon", "Offers")}
      ${msg(false, "Kudos", "Teammates recognised you for The Wall", "With your G+A, your card rose +3 OVR this week.", "Mon", "Your card")}
      ${msg(false, "Session", "Monday's report is ready", "Reported G+A and kudos are in the Chronicle.", "Mon", "Chronicle")}
      </div></div>`, { active: null, unread: 2 }),
  },
  // -------------------------------------------------------------- picking --
  {
    file: "Picker-Empty.dc.html", page: "picking", route: "/midweek", state: "open, nothing picked",
    rule: "KB-029; review problem 4; §44.2 auto squads",
    note: "The lock time and countdown sit together on one line (KB-029); the seal moved to the bracket. Slots come first. The save bar is inline and states why it's disabled. Phones get a compact list with an archetype filter; from lg, the LiveCard grid.",
    body: () => picker({ five: [null, null, null, null, null], bar: "none", countdown: "2 days, 5 h" }),
  },
  {
    file: "Picker-Editing.dc.html", page: "picking", route: "/midweek", state: "three picked, choosing slot 4, unsaved",
    rule: "KB-028, KB-029; ADR-099 frozen archetypes",
    note: `${CHANGED.name} changed archetype after the week opened: "${CHANGED.now} this week, ${CHANGED.next} from next" now shows in the slot row, the phone list, the desktop team sheet and on the card face in the grid (LiveCard badge). With unsaved changes the save bar becomes sticky above the tab bar.`,
    body: () => picker({ five: [CHANGED.name, "Dirk S.", "Mo A.", null, null], activeSlot: 4, bar: "dirty", countdown: "1 day, 4 h" }),
  },
  {
    file: "Picker-Saved.dc.html", page: "picking", route: "/midweek", state: "saved, no earlier week",
    rule: "KB-029: the empty save bar",
    note: "Saved with no last week to load: the bar shows the saved time and one secondary action, with no empty column. Compete drops its Pick badge.",
    body: () => picker({ five: FIVE, bar: "saved", countdown: "1 day, 4 h", strip: false }),
  },
  // -------------------------------------------------------------- evening --
  {
    file: "Evening-Draw.dc.html", page: "evening", route: "/midweek", state: "19:57, the draw is out",
    rule: "MM 2.0: the bracket and every five are public from the lock; numbers from round 1",
    note: "Sanne has a bye, so her first match is round 2 at 20:15 against the winner of Mila v Eline: both possible opponents' fives are shown. Form, pick boost and chances appear at 20:00, so the fives carry archetype, tier and OVR only.",
    body: () =>
      evening(DRAW, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The draw is out" })}
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">Your first match</h2><p class="small faint">${roundName(2)} &middot; kick-off ${hhmm(roundStart(2))}</p></div>
        <p class="muted">Round 1 is a bye for you, which counts as a win (+17). In round 2 you meet the winner of Mila v Eline.</p>
        <div class="ux-opp">${fiveList(entryOf(YOU))}<div class="ux-opp__them">${fiveList(entryOf("Mila"))}${fiveList(entryOf("Eline"))}</div></div>
        <p class="small faint">Form, pick boost and the chances before kick-off appear when round 1 starts at 20:00.</p></section>
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(1)}</h2><a class="link">Full bracket &rarr;</a></div><div class="ux-rows ux-rows--2">${roundRows(1, "upcoming")}</div></section>`, { youThrough: 5, updated: false }),
  },
  {
    file: "Evening-YourMatch.dc.html", page: "evening", route: "/midweek", state: "20:18, your match live",
    rule: "MM 2.0: own match chance by chance; others at full time; whose chance",
    note: "Your match leads: the live scoreboard and the latest chance, then the link to the full match. This round's other matches say In play until their full time, never a score. No per-match full-time estimate: a shoot-out ends later, so a time would give a draw away.",
    body: () =>
      evening(LIVE, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: `${roundName(2)} is live` })}
      <div class="ux-two">
        <section class="ux-block"><div class="ux-block__h"><h2 class="display">Your match</h2><a class="link">Watch it &rarr;</a></div>${scoreboard(R2, { now: LIVE })}${latest(R2, LIVE)}</section>
        ${yourNight(pathRow(1, hhmm(roundStart(1)), "<b>Bye.</b> Counts as a win.", "+17") + pathRow(2, hhmm(roundStart(2)), `<b>Playing ${R2.managers[1]} now.</b>`, "<small>win</small>+33", "next"), "+17 so far &middot; paid after the final")}
      </div>
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">This round</h2><a class="link">Full bracket &rarr;</a></div><div class="ux-rows ux-rows--2">${roundRows(2, (m) => (m.managers.includes(YOU) ? "live" : "inplay"))}</div></section>`, { youThrough: 5 }),
  },
  {
    file: "Evening-Out.dc.html", page: "evening", route: "/midweek", state: "20:41, knocked out in the quarter-finals",
    rule: "MM 2.0: something to follow after being knocked out (placeholder); coins after the final",
    note: "Your result folds into 'Your night'. The follow-up option is undecided, so its slot is a marked placeholder. The final is the thing to come back for.",
    body: () =>
      evening(OUT, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "You&rsquo;re out" })}
      <div class="ux-two">
        ${yourNight(pathRow(1, hhmm(roundStart(1)), "<b>Bye.</b> Counts as a win.", "+17") + pathRow(2, hhmm(roundStart(2)), `Beat ${R2.managers[1]} 1&ndash;0. <a class="link">Report</a>`, "+33") + pathRow(3, hhmm(roundStart(3)), `Out: lost to Sophie 2&ndash;2, 6&ndash;7 on penalties. <a class="link">Report</a>`, null, "out"), `+${coinsFor(YOU)} &middot; paid after the final`)}
        <div style="display:grid;gap:14px">${placeholder("Something to follow after a knockout", "A prediction, a consolation bracket or a season table. Its card goes here once you choose one.")}
        <a class="ux-nowcard ux-nowcard--brass"><span class="kicker">The final &middot; ${hhmm(roundStart(5))}</span><h2 class="display">Everyone watches it live</h2><p class="small muted">Chance by chance, on this page.</p></a></div>
      </div>
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(4)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(4))}</p></div><div class="ux-rows ux-rows--2">${roundRows(4, "upcoming")}</div></section>
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(3)}</h2><a class="link">Full bracket &rarr;</a></div><div class="ux-rows ux-rows--2">${roundRows(3, "ft")}</div></section>`, { youThrough: 3 }),
  },
  {
    file: "Evening-FinalLive.dc.html", page: "evening", route: "/midweek", state: "21:05, the final in a shoot-out",
    rule: "MM 2.0: the final live for everyone; a kick every 5 s; champion after the end",
    note: "The final takes the place of 'your match' for everyone. Kicks land in the tally every 5 seconds; dashed rings are kicks still to come in the first five. Nobody is named champion and nothing is paid until the last kick.",
    body: () =>
      evening(FINAL_LIVE, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The final is live" })}
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">The final</h2><a class="link">Watch it &rarr;</a></div>${scoreboard(FINAL, { now: FINAL_LIVE })}${shootoutLive(FINAL, FINAL_LIVE)}</section>
      <p class="panel small muted">The champion is named and coins are paid when the final ends. You: +${coinsFor(YOU)} so far.</p>`, { youThrough: 3 }),
  },
  {
    file: "Evening-Champion.dc.html", page: "evening", route: "/midweek", state: "21:08, after the final",
    rule: "MM 2.0: post-tournament ratings and a shareable result (placeholders); D4 champion lead",
    note: "The champion hero as approved, with your night under it. Ratings and the share image are marked placeholders until decided. The fairness seal and seed live here and on the bracket.",
    body: () =>
      chrome(`<div class="wrap">${competeTabs("midweek")}
      <section class="mw-champ panel panel--brass" style="display:grid;gap:14px"><p class="kicker">Midweek Madness &middot; Wed 7 Oct &middot; Champion</p><h1 class="display" style="font-size:44px">${FINAL.managers[1]}</h1>
        <p class="muted">Beat ${FINAL.managers[0]} on penalties in the final, ${finalScore(FINAL).join("&ndash;")} and ${FINAL.report.shootout.score[1]}&ndash;${FINAL.report.shootout.score[0]} from the spot. ${coinsFor("Joris")} KUT Coins over the night. <a class="link">Report &rarr;</a></p>
        <div class="ux-risers">${entryOf("Joris").cards.filter((c) => !c.trialist).map((c) => card(c.name.replace(/ \([^)]*\)$/, ""))).join("")}</div></section>
      <dl class="mw-stats"><div><dt>You</dt><dd>+${coinsFor(YOU)}</dd><dd class="sub">paid to your wallet</dd></div><div><dt>Your finish</dt><dd>Quarters</dd><dd class="sub">out on penalties</dd></div><div><dt>Entrants</dt><dd>${T.entries.length}</dd><dd class="sub">${T.entries.filter((e) => e.auto).length} auto squads</dd></div><div><dt>Goals</dt><dd>${T.matches.reduce((a, m) => a + finalScore(m)[0] + finalScore(m)[1], 0)}</dd><dd class="sub">in ${T.matches.length} matches</dd></div></dl>
      ${placeholder("Your five's ratings", "Each card's 1–10 rating for the night, with a short line. Shape decided with the ratings ADR.")}
      ${placeholder("Share your night", "An image for the group chat. It must say what it shows beyond the members-only pages (ADR-079).")}
      <a class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><span><b>Next Wednesday is open.</b> <span class="muted">Pick your five for Wed 14 Oct. Locks at 19:55.</span></span><span class="link">&rarr;</span></a>
      <p><a class="link">Past weeks &rarr;</a></p>
      ${seedLine({ seed: T.seed })}</div>`),
  },
  // -------------------------------------------------------------- matches --
  {
    file: "Match-Yours-Live.dc.html", page: "matches", route: "/midweek/2026-10-05/match/[id]", state: "your match, live at 20:18",
    rule: "Whose chance (owner, 30 Sep and 1 Oct): lanes, blue and red names; no chance counter",
    note: "Both sides field Iris W.: on screen each is just 'Iris W.', blue for Sanne's and red for Eline's; screen readers hear whose. No headline or facts until full time (they give the result away), and no goals or assists in the Why until then either.",
    body: () => matchScreen(R2, LIVE, { kicker: `${roundName(2)} &middot; your match &middot; live`, mode: "live", youThrough: 5 }),
  },
  {
    file: "Match-Other-InPlay.dc.html", page: "matches", route: "/midweek/2026-10-05/match/[id]", state: "a match you're not in, before full time",
    rule: "MM 2.0: every match unfolds at the same pace; others show at full time",
    note: "Line-ups and the chances before kick-off, nothing that moves. The page says plainly why it isn't live.",
    body: () => matchScreen(mOf(2, 5), LIVE, { kicker: `${roundName(2)} &middot; in play`, mode: "inplay" }),
  },
  {
    file: "Match-Other-FullTime.dc.html", page: "matches", route: "/midweek/2026-10-05/match/[id]", state: "the same match after full time",
    rule: "§44.10 report; the simpler Why (owner, 1 and 2 Oct)",
    note: "The full report. Olaf G. and Kees R. play on both sides here, told apart by colour alone on screen. The Why list is shown with 'Show every factor' opened, to show what it reveals; closed, each card is one compact row: its Power in a pill coloured by strength (green strong to orange weak), the name, and a bar against 1.00. The five factors (Rating, Form, Pick, Fitness, Day) each explain themselves on hover, tap or focus; the first card's Form is shown hovered. Power is this match's: the week's power times the Day roll.",
    body: () => matchScreen(mOf(2, 5), null, { kicker: `${roundName(2)}, match 6 &middot; full time ${hhmm(fullTimeAt(mOf(2, 5)))}`, mode: "ft" }),
  },
  {
    file: "Match-Final-Live.dc.html", page: "matches", route: "/midweek/2026-10-05/match/[id]", state: "the final, live in the shoot-out",
    rule: "MM 2.0: the final live for everyone; 5 s per kick",
    note: "Regulation's chances stay above; the tally grows in place, so the page doesn't scroll as kicks land. The last kick is read out (aria-live polite).",
    body: () => matchScreen(FINAL, FINAL_LIVE, { kicker: "The final &middot; live", mode: "live", youThrough: 3 }),
  },
  // -------------------------------------------------------------- bracket --
  {
    file: "Bracket-FromLock.dc.html", page: "bracket", route: "/midweek/2026-10-05", state: "19:57, the draw",
    rule: "MM 2.0: the bracket is public from the lock; review problem 6",
    note: "Jump links to your match and each round. Round 1 shows kick-off times; round 2 names who is waiting, or 'Winner of …'. From lg, the tree as shipped (KB-031) with kick-off times in its boxes. Names are neutral: team colours only on a match page.",
    body: () => chrome(`${clock(DRAW, { youThrough: 5 })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The bracket", back: "Midweek Madness" })}
      <nav class="ux-jump" aria-label="Jump to"><a class="you">Your match &middot; R2 ${hhmm(roundStart(2))}</a>${Array.from({ length: T.rounds }, (_, i) => `<a>${roundShort(i + 1)}</a>`).join("")}</nav>
      ${bracketPage(DRAW, { youThrough: 5 })}</div>`, { compete: "live" }),
  },
  {
    file: "Bracket-Evening.dc.html", page: "bracket", route: "/midweek/2026-10-05", state: "20:18, round 2 in play",
    rule: "MM 2.0: nobody's bracket gets ahead",
    note: "Round 1 at full time; round 2 in play (your match Live, the others In play with no score); later rounds wait as 'Winner, …'. The tree from lg.",
    body: () => chrome(`${clock(LIVE, { youThrough: 5, updated: LIVE })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The bracket", back: "Midweek Madness" })}
      <nav class="ux-jump" aria-label="Jump to"><a class="you">Your match &middot; Live</a>${Array.from({ length: T.rounds }, (_, i) => `<a>${roundShort(i + 1)}</a>`).join("")}</nav>
      ${bracketPage(LIVE, { youThrough: 5 })}</div>`, { compete: "live" }),
  },
  {
    file: "Weeks-Past.dc.html", page: "bracket", route: "/midweek/past", state: "every past week",
    rule: "Review problem 2 (no archive); old HANDOFF open question 8",
    note: "One row per week: champion, field, your finish, or why it didn't run. Each opens that week's bracket.",
    body: () => chrome(`<div class="wrap wrap--read">${competeTabs("midweek")}${head({ kicker: "Midweek Madness", title: "Past weeks", back: "Midweek Madness" })}
      <div class="ux-weeks">${[["Wed 7 Oct", "Joris won it &middot; 22 entrants", "You: quarter-finals, +50"], ["Wed 30 Sep", "Wout H. won it &middot; 21 entrants", "You: semi-finals, +100"], ["Wed 23 Sep", "No Midweek Madness: the club was on a break", "Nothing played or paid"]].map(([w, a, b]) => `<a class="ux-week"><b>${w}</b><p>${a}. ${b}.</p><span class="go" aria-hidden="true">&rsaquo;</span></a>`).join("")}</div></div>`),
  },
];

function msg(isNew, kind, title, body, time, go) {
  return `<a class="ux-msg${isNew ? " ux-msg--new" : ""}"><span class="ux-msg__dot" aria-hidden="true"></span><p class="ux-msg__k">${kind}${isNew ? "<em>New</em>" : ""}</p><span class="ux-msg__go"><time>${time}</time><b aria-hidden="true">&rsaquo;</b></span><p class="ux-msg__t">${esc(title)}</p><p class="ux-msg__b">${esc(body)} <span style="color:var(--color-brass);font-weight:800">${go} &rarr;</span></p></a>`;
}
