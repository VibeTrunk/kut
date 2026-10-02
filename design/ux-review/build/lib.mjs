// Shared pieces for the UX review mockups: the MM 2.0 evening clock, the
// Compete chrome, team colours, the lane timeline, the Why table. Builds on
// design/midweek/build (the real LiveCard, icons, sample tournament and the
// approved mw- components). Design only; nothing in the app imports this.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root } from "../../midweek/build/source.mjs";
import {
  T, PLAYERS, card, mini, esc, icon, matchesBy, finalScore, BRACKET, tierChip, archLabel,
  tierLabel, roundName, roundShort, shortMatch, status, plasterChip, playerOf,
} from "../../midweek/build/lib.mjs";

export { T, PLAYERS, card, mini, esc, icon, matchesBy, finalScore, BRACKET, tierChip, archLabel, tierLabel, roundName, roundShort, shortMatch, status, plasterChip, playerOf };

const here = path.dirname(fileURLToPath(import.meta.url));
export const YOU = "Sanne";

// ------------------------------------------------------------ the evening ----
// MM 2.0 as decided (owner, 30 Sep and 1 Oct): lock 19:55, round r starts at
// lock + 5 min + 15 min x (r - 1); a chance slot every 20 s (14 slots, 4:40),
// a penalty kick every 5 s; coins and the champion after the END of the final.
export const LOCK = new Date("2026-10-07T17:55:00Z");
export const SLOT_S = 20;
export const SLOTS = 14;
export const KICK_S = 5;
const MIN = 60_000;
export const roundStart = (r) => new Date(LOCK.getTime() + (5 + 15 * (r - 1)) * MIN);
export const at = (hhmmss) => new Date(`2026-10-07T${hhmmss}+02:00`);
const AMS = "Europe/Amsterdam";
export const hhmm = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: AMS, hour: "2-digit", minute: "2-digit" }).format(d);
export const hhmmss = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: AMS, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);

/** As `matchTiming` (ADR-104): the match clock runs 0' to 90' over 14 slots of 20 s, so a chance is due at kick-off + minute x 280 s / 90. */
const REGULATION_MS = SLOTS * SLOT_S * 1000;
export const eventAt = (m, ev) => new Date(roundStart(m.round).getTime() + Math.floor((ev.minute * REGULATION_MS) / 90));
export const kickAt = (m, j) => new Date(roundStart(m.round).getTime() + (SLOTS * SLOT_S + (j + 1) * KICK_S) * 1000);
export const fullTimeAt = (m) => {
  const kicks = m.report.shootout ? m.report.shootout.kicks.length : 0;
  return new Date(roundStart(m.round).getTime() + (SLOTS * SLOT_S + kicks * KICK_S) * 1000);
};
/** What a member watching this match live has seen by `now`. */
export function seen(m, now) {
  const events = m.report.timeline.filter((ev) => eventAt(m, ev) <= now);
  const kicks = m.report.shootout ? m.report.shootout.kicks.filter((_, j) => kickAt(m, j) <= now) : [];
  const score = events.length ? events[events.length - 1].score : [0, 0];
  const minute = Math.min(90, Math.round(((now - roundStart(m.round)) / 1000 / SLOT_S) * (90 / SLOTS)));
  return { events, kicks, score, minute, done: now >= fullTimeAt(m) };
}
export const youIn = (m) => m.managers.includes(YOU);
export const mOf = (r, p) => matchesBy.get(`${r}/${p}`);

// -------------------------------------------------------------- chrome -----

const TABS = [
  ["home", "Home", "IconHome"],
  ["collection", "Collection", "IconCollection"],
  ["packs", "Packs", "IconPack"],
  ["market", "Market", "IconMarket"],
  ["compete", "Compete", "IconLeaderboard"],
];
const BADGE = {
  pick: { text: "Pick", sr: "Midweek Madness: you haven't picked your five" },
  live: { text: "Live", sr: "Midweek Madness is live", cls: " tab-badge--live" },
};

/** The app shell with Compete as the fifth tab. `compete` sets its status badge. */
export function chrome(body, { active = "compete", balance = "1,240", initials = "SV", compete = null, unread = 0 } = {}) {
  const cur = (k) => (k === active ? ' aria-current="true"' : "");
  const badge = (k) => {
    if (k !== "compete" || !compete) return "";
    const b = BADGE[compete];
    return `<span class="tab-badge${b.cls ?? ""}">${b.text}<span class="sr-only">. ${b.sr}</span></span>`;
  };
  const msg = `<span class="round-btn" style="position:relative">${icon("IconMessages")}${unread ? `<span class="tab-badge" style="top:-4px;left:auto;right:-4px">${unread}</span>` : ""}</span>`;
  return `<div class="pg">
<header class="m-top">
  <span class="logo"><i></i>KUT</span>
  <div class="chrome-right"><span class="coin-pill">${icon("IconCoin")}<span>${balance}</span></span>${msg}<span class="avatar">${initials}</span></div>
</header>
<header class="d-top"><div class="d-top__in">
  <span class="logo"><i></i>KUT</span>
  <nav class="d-nav" aria-label="Primary">${TABS.map(([k, l, i]) => `<a${cur(k)}>${icon(i)}${l}${badge(k)}</a>`).join("")}</nav>
  <div class="chrome-right"><span class="coin-pill">${icon("IconCoin")}<span>${balance}</span></span>${msg}<span class="avatar">${initials}</span></div>
</div></header>
<main>${body}</main>
<nav class="m-tabs" aria-label="Primary">${TABS.map(([k, l, i]) => `<a${cur(k)}><span class="tab-ic">${icon(i)}${badge(k)}</span><span>${l}</span></a>`).join("")}</nav>
</div>`;
}

/** COMPETE_TABS: Midweek · Standings · Players (SectionTabs). */
export function competeTabs(active, { live = false } = {}) {
  const tabs = [["midweek", "Midweek"], ["standings", "Standings"], ["players", "Players"]];
  return `<nav class="ux-sectabs" aria-label="Compete">${tabs
    .map(([k, l]) => `<a${k === active ? ' aria-current="page"' : ""}><span>${l}${k === "midweek" && live ? `<span class="tab-badge tab-badge--live">Live</span>` : ""}</span></a>`)
    .join("")}</nav>`;
}

export const head = ({ kicker, title, lede, back }) => `<header class="ph">
  ${back ? `<a class="back">&larr; ${esc(back)}</a>` : ""}
  <p class="kicker">${kicker}</p>
  <h1 class="display">${title}</h1>
  ${lede ? `<p class="lede lede--m-hide">${lede}</p>` : ""}
</header>`;

export const placeholder = (what, note) => `<div class="ux-ph" role="note"><b>Placeholder · not decided</b><span><strong>${what}.</strong> ${note}</span></div>`;

// ------------------------------------------------------- MidweekClock ------

const STATE_WORD = { locked: "Locked", played: "Played", live: "Live", next: "Next", later: "Later" };
/**
 * The evening as stops. `now` decides each stop's state; `youThrough` is the
 * number of rounds the member is still in (their stops get a marker).
 */
export function clock(now, { youThrough = T.rounds, updated = null } = {}) {
  const stops = [{ t: LOCK, n: "Lock", st: "locked" }];
  let nextGiven = false;
  for (let r = 1; r <= T.rounds; r++) {
    const s = roundStart(r);
    const roundMatches = T.matches.filter((m) => m.round === r);
    const end = new Date(Math.max(...roundMatches.map((m) => fullTimeAt(m).getTime())));
    let st = "later";
    if (now >= end) st = "played";
    else if (now >= s) st = "live";
    else if (!nextGiven) { st = "next"; nextGiven = true; }
    stops.push({ t: s, n: roundShort(r), st, you: r <= youThrough });
  }
  if (now < LOCK) stops[0].st = "next";
  return `<div class="ux-clock"><ol style="--n:${stops.length}" aria-label="Wednesday evening, ${stops.map((s) => `${s.n} ${hhmm(s.t)} ${STATE_WORD[s.st]}`).join(", ")}">${stops
    .map(
      (s) => `<li data-state="${s.st}"${s.you ? " data-you" : ""} aria-hidden="true"><span class="t">${hhmm(s.t)}</span><span class="d">${s.st === "played" ? "&#10003;" : ""}</span><span class="n">${s.n}</span><span class="s">${STATE_WORD[s.st]}</span></li>`,
    )
    .join("")}</ol>${updated ? `<p class="ux-clock__upd">Updated ${hhmmss(updated)}</p>` : ""}</div>`;
}

// --------------------------------------------------- team-coloured names ----
// Only where one match is open (its page, or a single-match block such as
// "Your match"): lists of matches stay neutral (owner, 2 Oct).

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The base Player name: the renderer's "(manager)" suffix is dropped, colour carries the side. */
export const baseName = (n) => n.replace(/ \([^)]*\)$/, "");
/**
 * PlayerName: every Player and manager in `text` in their side's colour. A
 * Player both sides field loses the renderer's "(manager)" suffix on screen;
 * screen readers still hear whose it is.
 */
export function colourNames(text, m) {
  const names = [];
  [0, 1].forEach((s) => {
    names.push({ n: m.managers[s], s, dup: false });
    for (const c of m.report.why[s].cards) if (!c.trialist) names.push({ n: c.name, s, dup: c.name !== baseName(c.name) });
  });
  names.sort((a, b) => b.n.length - a.n.length);
  const by = new Map(names.map((x) => [x.n, x]));
  const re = new RegExp(`(?<![A-Za-z])(${names.map((x) => reEsc(x.n)).join("|")})(?![A-Za-z])`, "g");
  return esc(text).replace(re, (n) => {
    const x = by.get(n);
    return `<span class="tn tn--${x.s === 0 ? "b" : "r"}">${baseName(n)}${x.dup ? `<span class="sr-only"> (${esc(m.managers[x.s])}&rsquo;s)</span>` : ""}</span>`;
  }).replace(/\.((?:<span class="sr-only">[^<]*<\/span>)?<\/span>)\./g, ".$1"); // "Kees R. (Bart)." loses its suffix, not its sentence
}
export const mgr = (m, s) => `<span class="tn tn--${s === 0 ? "b" : "r"}">${esc(m.managers[s])}</span>`;

// ---------------------------------------------------------- scoreboard -----

/** MidweekScoreboard: side 0 blue left, side 1 red right; live or full time. */
export function scoreboard(m, { now = null, mini: small = false } = {}) {
  const v = now ? seen(m, now) : null;
  const done = !v || v.done;
  const sc = done ? finalScore(m) : v.score;
  const so = m.report.shootout;
  const kicks = done ? (so ? so.kicks : []) : v.kicks;
  const pens = so && kicks.length ? [0, 1].map((s) => kicks.filter((k) => k.side === s && k.outcome === "goal").length) : null;
  const w = m.report.winnerSide;
  const why = m.report.why;
  const tags = (s) =>
    [
      done ? (s === w ? `<span class="chip chip--won">&#10003; Through</span>` : `<span class="chip chip--out">Out</span>`) : "",
      m.managers[s] === YOU ? `<span class="chip chip--you">You</span>` : "",
      why[s].auto ? `<span class="chip chip--auto">Auto squad</span>` : "",
    ].join("");
  const sub = done
    ? so ? `${pens[0]}&ndash;${pens[1]} on pens` : "full time"
    : kicks.length || (so && v.minute >= 90) ? `<span class="ux-live">Live &middot; pens ${pens ? `${pens[0]}&ndash;${pens[1]}` : ""}</span>` : `<span class="ux-live">Live &middot; ${v.minute}&prime;</span>`;
  const label = `${done ? "Final score" : "Live"}: ${m.managers[0]} ${sc[0]}, ${m.managers[1]} ${sc[1]}${pens ? `, penalties ${pens[0]}–${pens[1]}` : ""}.`;
  return `<div class="ux-sb${small ? " ux-sb--mini" : ""}" role="group" aria-label="${esc(label)}">
  <div class="ux-sb__side"><p class="ux-sb__name">${mgr(m, 0)}</p><p class="ux-sb__tags">${tags(0)}</p></div>
  <div class="ux-sb__mid" aria-hidden="true"><p class="ux-sb__score"><span class="b">${sc[0]}</span>&ndash;<span class="r">${sc[1]}</span></p><p class="ux-sb__sub">${sub}</p></div>
  <div class="ux-sb__side ux-sb__side--r"><p class="ux-sb__name">${mgr(m, 1)}</p><p class="ux-sb__tags">${tags(1)}</p></div>
</div>`;
}

// ------------------------------------------------------- lane timeline -----

const KIND = { goal: "Goal", save: "Save", block: "Block", woodwork: "Woodwork", wide: "Wide" };
function evItem(m, t, { isNew = false } = {}) {
  const [a, b] = t.score;
  const sc = t.kind === "goal" ? (t.side === 0 ? `<b>${a}</b>&ndash;${b}` : `${a}&ndash;<b>${b}</b>`) : `${a}&ndash;${b}`;
  const whose = t.kind === "goal" ? `Goal for ${m.managers[t.side]}` : `${m.managers[t.side]}'s chance`;
  return `<li><div class="ux-ev${isNew ? " ux-ev--new" : ""}" data-side="${t.side}" data-kind="${t.kind}">
    <p class="ux-ev__head"><span class="ux-ev__min">${t.minute}&prime;</span><span class="kind kind--${t.kind}">${KIND[t.kind]}</span>${mgr(m, t.side)}<span class="ux-ev__score" aria-hidden="true">${sc}</span></p>
    <p class="sr-only">${esc(`${t.minute}th minute. ${whose}.`)}</p>
    <p class="ux-ev__text">${colourNames(t.text, m)}</p>
    <p class="sr-only">Score: ${esc(`${m.managers[0]} ${a}, ${m.managers[1]} ${b}`)}.</p>
  </div><p class="ux-spine" aria-hidden="true"><span>${t.minute}&prime;</span><b>${sc}</b></p></li>`;
}
/** MidweekLaneTimeline: chronological; each chance leans to its side. */
export function laneTimeline(m, events = m.report.timeline, { newest = false, label = "How it went" } = {}) {
  return `<div class="ux-ltc"><ol class="ux-lt" aria-label="${esc(label)}">${events.map((t, i) => evItem(m, t, { isNew: newest && i === events.length - 1 })).join("")}</ol></div>`;
}
/** The pinned latest chance on a live page. */
export function latest(m, now) {
  const v = seen(m, now);
  const last = v.events[v.events.length - 1];
  return last ? `<div class="ux-ltc"><ol class="ux-lt" aria-label="Latest chance" aria-live="polite">${evItem(m, last, { isNew: true })}</ol></div>` : `<p class="faint small">Kick-off. The first chance is 20 seconds away.</p>`;
}

/** The live shoot-out tally: name, running total, then the kicks (5 s apart). */
export function shootoutLive(m, now = null) {
  const so = m.report.shootout;
  if (!so) return "";
  const shown = now ? seen(m, now).kicks : so.kicks;
  const rows = [0, 1]
    .map((s) => {
      const mine = shown.filter((k) => k.side === s);
      const total = mine.filter((k) => k.outcome === "goal").length;
      const due = Math.max(0, 5 - mine.length);
      return `<div class="ux-so__row ux-so__row--${s === 0 ? "b" : "r"}"><span>${mgr(m, s)}</span><span class="ux-so__tally">${total}</span><span class="ux-so__kicks">${mine
        .map((k) => `<span class="ux-so__k ${k.outcome === "goal" ? "ux-so__k--goal" : "ux-so__k--miss"}">${k.outcome === "goal" ? "&#10003;" : "&#10005;"}</span>`)
        .join("")}${'<span class="ux-so__k ux-so__k--due"></span>'.repeat(due)}</span></div>`;
    })
    .join("");
  const last = shown[shown.length - 1];
  return `<section class="ux-so" aria-label="Penalties">
  <div class="sec__h"><h2 class="display h2">Penalties</h2><p class="small faint">${now && shown.length < so.kicks.length ? `${shown.length} kicks so far &middot; one every 5 seconds` : `${so.kicks.length} kicks`}</p></div>
  <div aria-hidden="true" style="display:grid;gap:8px">${rows}</div>
  ${last ? `<p class="small" aria-live="polite">Last kick: <span class="tn tn--${last.side === 0 ? "b" : "r"}">${esc(baseName(last.kicker))}</span> ${last.outcome === "goal" ? "scores" : "misses"}.</p>` : ""}
</section>`;
}

// ------------------------------------------------------------- Why list ----
// MidweekWhyList (owner, 2 Oct: "make it simple"): per card its Power, a bar
// against an ordinary card (1.00), and the one factor that moved it most. Every
// factor is one tap away. No tables, so nothing scrolls sideways.

const pctOf = (ppm) => Math.round((ppm / 1_000_000 - 1) * 100);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const signed = (d) => (d > 0 ? `+${d}%` : d < 0 ? `&minus;${Math.abs(d)}%` : "&ndash;");
const LO = 0.5;
const HI = 1.5;
/** Power as a bar from 0.50 to 1.50 with a tick at 1.00. SVG attributes, so no inline style under the CSP. */
function powerBar(power) {
  const x = Math.max(2, Math.min(100, ((power - LO) / (HI - LO)) * 100));
  return `<svg class="ux-wl__bar" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="6" rx="3" class="bg"/><rect x="0" y="0" width="${x.toFixed(1)}" height="6" rx="3" class="fill"/><rect x="49.6" y="0" width="0.8" height="6" class="tick"/></svg>`;
}
/** Strength bands for Power: the colour of its pill and bar. The number and bar length carry it too. */
const BANDS = [
  [1.1, 4, "strong"],
  [1.0, 3, "above ordinary"],
  [0.9, 2, "below ordinary"],
  [-Infinity, 1, "weak"],
];
const bandOf = (power) => BANDS.find(([min]) => power >= min);
/** What each factor means, shown on hover, tap or focus. Ranges from MIDWEEK config. */
const FACTOR_TIP = {
  Rating: "From the card's OVR: no boost at OVR 30, up to +10% at OVR 83.",
  Form: "The Player's form this week, rolled once at the lock: from −20% to +25%, usually close to zero. Every copy of the Player shares it.",
  Pick: "Picking against the crowd pays: up to +25% when few owners picked this Player, down to −12.5% when nearly all of them did.",
  Fitness: "−5% when the Player is injured; otherwise no change.",
  Day: "A fresh roll for this match only, between −12% and +12%.",
};
let tipSeq = 0;
function factorBox(label, d, tipOpen) {
  const id = `fx-tip-${++tipSeq}`;
  return `<div class="ux-fx${tipOpen ? " is-tip" : ""}"><dt><button type="button" class="ux-fx__q" aria-describedby="${id}">${label}</button></dt><dd class="${d > 0 ? "up" : d < 0 ? "down" : "flat"}">${signed(d)}</dd><span class="ux-fx__tip" role="tooltip" id="${id}">${esc(FACTOR_TIP[label])}</span></div>`;
}
export function whyList(m, { stats = true, open = false, tip = null } = {}) {
  const why = m.report.why;
  const a = Math.round(why[0].winChancePpm / 10_000);
  const side = (s) => {
    const w = why[s];
    // Power in this match: the week's power (fixed at the lock) times this match's Day roll.
    const matchPower = (c) => (c.powerPpm / 1e6) * (c.dayRollPpm / 1e6);
    const rows = [...w.cards].sort((x, y) => matchPower(y) - matchPower(x));
    return `<section class="ux-wl" aria-label="${esc(`${w.manager}'s five`)}">
  <h3 class="ux-wl__h">${mgr(m, s)}<small>${Math.round(w.winChancePpm / 10_000)}% before kick-off</small>${w.auto ? `<span class="chip chip--auto">Auto squad</span>` : ""}${w.keeperless ? `<span class="chip chip--warn">No keeper</span>` : ""}</h3>
  <ul>${rows
    .map((c, i) => {
      const f = [["Rating", c.ovrFactorPpm], ["Form", c.formRollPpm], ["Pick", c.pickFactorPpm], ["Fitness", c.fitnessPpm], ["Day", c.dayRollPpm]].map(([l, p]) => [l, pctOf(p)]);
      const notes = [
        c.inGoal ? "in goal" : "",
        c.trialist ? "trialist" : "",
        c.injured ? "injured" : "",
        c.handicapPpm !== 1_000_000 ? `handicap &times;${(c.handicapPpm / 1e6).toFixed(3)}` : "",
        stats && c.goals ? plural(c.goals, "goal") : "",
        stats && c.assists ? plural(c.assists, "assist") : "",
      ].filter(Boolean);
      const power = matchPower(c);
      const [, band, bandName] = bandOf(power);
      return `<li class="ux-wl__row ux-pw--${band}">
    <p class="ux-wl__pw">${power.toFixed(2)}<span class="sr-only"> power, ${bandName}</span></p>
    <p class="ux-wl__name"><span class="tn tn--${s === 0 ? "b" : "r"}">${esc(baseName(c.name))}</span> <small>${archLabel(c.archetype)} &middot; ${c.ovr}${notes.length ? ` &middot; <b>${notes.join(", ")}</b>` : ""}</small></p>
    ${powerBar(power)}
    ${open ? `<dl class="ux-wl__fx">${f.map(([l, d]) => factorBox(l, d, tip && tip[0] === s && tip[1] === i && tip[2] === l)).join("")}</dl>` : ""}
  </li>`;
    })
    .join("")}</ul>
</section>`;
  };
  return `<section class="ux-why" aria-labelledby="why-h">
  <div class="sec__h"><h2 class="display h2" id="why-h">Why</h2></div>
  <div class="ux-odds">
    <p class="kicker kicker--faint">Chances before kick-off</p>
    <svg class="ux-odds__bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(`Before kick-off: ${why[0].manager} ${a}%, ${why[1].manager} ${100 - a}%`)}"><rect x="0" y="0" width="${a}" height="10" class="b"/><rect x="${a}" y="0" width="${100 - a}" height="10" class="r"/></svg>
    <p class="ux-odds__legend"><span>${mgr(m, 0)} <b>${a}%</b></span><span><b>${100 - a}%</b> ${mgr(m, 1)}</span></p>
  </div>
  <div class="ux-why__sides">${side(0)}${side(1)}</div>
  <p><span class="btn btn--secondary btn--small" aria-expanded="${open}">${open ? "Hide the factors" : "Show every factor"}</span></p>
  <p class="ux-why__foot">Power is a card's strength in this match; 1.00, the tick on each bar, is an ordinary card. Green is stronger than that, amber and orange weaker. It multiplies the card's rating, form, pick, fitness and this match's day roll${open ? "; hover or tap a factor to see what it means" : ""}.${stats ? "" : " Goals and assists are added at full time."} Who picked whom is on the bracket page after the final.</p>
</section>`;
}

// --------------------------------------------------------- match rows ------
// Lists of matches are neutral: no team colours (owner, 2 Oct).

const auto = (name) => T.entries.find((e) => e.manager === name)?.auto;
/** A round's match row. state: ft | inplay | live | upcoming. */
export function mrow(m, state, { you = YOU } = {}) {
  const isYou = m.managers.includes(you);
  const sc = finalScore(m);
  const so = m.report.shootout;
  const w = m.report.winnerSide;
  const sides = m.managers
    .map((n, s) => {
      const cls = state === "ft" ? (s === w ? " ux-mrow__side--won" : " ux-mrow__side--lost") : "";
      return `<div class="ux-mrow__side${cls}"><span class="who"><span>${esc(n)}</span>${state === "ft" && s === w ? `<span aria-hidden="true" class="mk">&#10003;</span>` : ""}${n === you ? `<span class="chip chip--you">You</span>` : ""}${auto(n) ? `<span class="chip chip--auto">Auto</span>` : ""}</span>${state === "ft" ? `<span class="sc">${sc[s]}${so ? `<small class="faint"> (${so.score[s]})</small>` : ""}</span>` : ""}</div>`;
    })
    .join("");
  const right =
    state === "ft" ? `<span class="ux-mrow__state"><span>Full time</span><b aria-hidden="true">&rsaquo;</b></span>`
    : state === "inplay" ? `<span class="ux-mrow__state"><span class="ux-inplay">In play</span><span>result at full time</span></span>`
    : state === "live" ? `<span class="ux-mrow__state"><span class="ux-live">Live</span><b aria-hidden="true">&rsaquo;</b></span>`
    : `<span class="ux-mrow__state"><span>Kick-off</span><b class="t">${hhmm(roundStart(m.round))}</b></span>`;
  const label =
    state === "ft" ? `${m.managers[0]} ${sc[0]}, ${m.managers[1]} ${sc[1]}${so ? `, ${so.score[0]}–${so.score[1]} on penalties` : ""}. ${m.managers[w]} won.`
    : state === "inplay" ? `${m.managers[0]} v ${m.managers[1]}, in play. The result shows at full time.`
    : state === "live" ? `${m.managers[0]} v ${m.managers[1]}, live now.`
    : `${m.managers[0]} v ${m.managers[1]}, kick-off ${hhmm(roundStart(m.round))}.`;
  return `<div class="ux-mrow${isYou ? " ux-mrow--you" : ""}" role="group" aria-label="${esc(label)}"><div class="ux-mrow__sides" aria-hidden="true">${sides}</div>${right}</div>`;
}
export const byeRow = (who) =>
  `<div class="ux-mrow${who === YOU ? " ux-mrow--you" : ""}" role="group" aria-label="${esc(`${who} has a bye, which counts as a win.`)}"><div class="ux-mrow__sides" aria-hidden="true"><div class="ux-mrow__side"><span class="who"><span>${esc(who)}</span>${who === YOU ? `<span class="chip chip--you">You</span>` : ""}<span class="chip">Bye</span></span></div></div><span class="ux-mrow__state"><span>counts as a win</span></span></div>`;

/** MidweekFiveList: an entered five as mini cards, neutral (draw from the lock). */
export function fiveList(entry) {
  const you = entry.manager === YOU;
  return `<div class="ux-five${you ? " ux-five--you" : ""}">
  <p class="ux-five__h"><b>${esc(entry.manager)}</b>${you ? ` <span class="chip chip--you">You</span>` : ""}${entry.auto ? ` <span class="chip chip--auto">Auto squad</span>` : ""}</p>
  <ul>${entry.cards
    .map((c) => {
      if (c.trialist) return `<li><span aria-hidden="true" class="mw-mini mw-mini--trialist"><b>30</b></span><span>Trialist<small>Common All-rounder &middot; 30</small></span></li>`;
      const p = playerOf(c.name);
      return `<li>${mini(p.displayName)}<span>${esc(baseName(c.name))}<small>${esc(c.archetype)} &middot; ${tierLabel(p.rarity)} &middot; ${c.ovr}${c.inGoal ? " &middot; in goal" : ""}</small></span></li>`;
    })
    .join("")}</ul>
</div>`;
}
export const entryOf = (manager) => T.entries.find((e) => e.manager === manager);

/** What a manager has been paid so far (display only until the final ends). */
export const coinsFor = (manager, throughRound = T.rounds) =>
  T.payouts.filter((p) => p.manager === manager && p.round <= throughRound).reduce((a, p) => a + p.amount, 0);

// ------------------------------------------------------------ page file ----

const kutCss = fs
  .readFileSync(path.join(root, "src/app/globals.css"), "utf8")
  .replace('@import "tailwindcss";', "")
  .replace("@theme inline {", ":root {");
const mwCss = fs.readFileSync(path.join(root, "design/midweek/build/midweek.css"), "utf8");
const uxCss = fs.readFileSync(path.join(here, "ux.css"), "utf8");

export function dcFile({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Instrument+Serif&display=swap">
  <!-- Generated by design/ux-review/build/build.mjs from the real LiveCard, icons and
       globals.css in src/, design/midweek/build and design/midweek/sample-tournament.json.
       Edit the generator, not this file. -->
  <style>
${kutCss}
${mwCss}
${uxCss}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}
