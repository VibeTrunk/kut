// Shared pieces for the Midweek Madness mockups: the sample data, the real
// LiveCard and icons from src/, the app chrome, and the proposed components as
// HTML builders. Design only; nothing in the app imports this.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { React, renderToStaticMarkup, root, src, here } from "./source.mjs";

const require = createRequire(import.meta.url);

export const T = require("../sample-tournament.json");
const { LiveCard } = src("components/live-card.tsx");
const icons = src("components/icons.tsx");
const { ARCHETYPE_LABELS } = src("game/archetypes.ts");
const { ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");
export const { roundPayouts } = src("game/midweek/rewards.ts");
export const { MIDWEEK } = src("game/midweek/config.ts");
export const { revealAt, lockAt, finalRevealAt } = src("game/midweek/schedule.ts");

// ---------------------------------------------------------------- helpers ----

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const ppm = (v) => (v / 1_000_000).toFixed(2);
export const pct = (v) => `${Math.round(v / 10_000)}%`;
const AMS = "Europe/Amsterdam";
export const hhmm = (d) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: AMS, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
export const dayDate = (d) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: AMS, weekday: "short", day: "numeric", month: "short" }).format(new Date(d));
export const icon = (name, cls = "") =>
  `<span aria-hidden="true" class="ic ${cls}">${renderToStaticMarkup(React.createElement(icons[name]))}</span>`;
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** A round's name, counted from the end so it holds for every bracket size. */
export function roundName(r, rounds = T.rounds) {
  const fromEnd = rounds - r;
  return fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semi-finals" : fromEnd === 2 ? "Quarter-finals" : `Round ${r}`;
}
export function roundShort(r, rounds = T.rounds) {
  const fromEnd = rounds - r;
  return fromEnd === 0 ? "Final" : fromEnd === 1 ? "Semis" : fromEnd === 2 ? "Quarters" : `Round ${r}`;
}
/** "QF 1", "SF 2": short enough for a bracket cell. */
export function shortMatch(r, pairing, rounds = T.rounds) {
  const fromEnd = rounds - r;
  return fromEnd === 1 ? `SF ${pairing + 1}` : fromEnd === 2 ? `QF ${pairing + 1}` : `R${r} M${pairing + 1}`;
}
export function matchName(r, pairing, rounds = T.rounds) {
  const fromEnd = rounds - r;
  if (fromEnd === 0) return "the final";
  if (fromEnd === 1) return `semi-final ${pairing + 1}`;
  if (fromEnd === 2) return `quarter-final ${pairing + 1}`;
  return `round ${r}, match ${pairing + 1}`;
}

// ---------------------------------------------------------------- players ----

const LABEL_TO_SLUG = Object.fromEntries(Object.entries(ARCHETYPE_LABELS).map(([k, v]) => [v, k]));
/** Every Player in the sample, keyed by display name. Ids are invented. */
export const PLAYERS = new Map();
for (const entry of T.entries)
  for (const c of entry.cards) {
    if (c.trialist || PLAYERS.has(c.name)) continue;
    PLAYERS.set(c.name, {
      id: `sample-${slugify(c.name)}`,
      displayName: c.name,
      ovr: c.ovr,
      rarity: c.rarity,
      archetype: LABEL_TO_SLUG[c.archetype] ?? c.archetype,
      injured: c.injured,
    });
  }
/** "Olaf G. (Joris)" → the Player. The renderer adds the manager for doubles. */
export const playerOf = (name) => PLAYERS.get(name.replace(/ \([^)]*\)$/, ""));

export function card(name, size = "grid") {
  const p = PLAYERS.get(name);
  const off = ARCHETYPE_OFFSETS[p.archetype];
  const at = (k) => Math.max(1, Math.min(99, p.ovr + off[k]));
  return renderToStaticMarkup(
    React.createElement(LiveCard, {
      size,
      player: {
        id: p.id, injured: p.injured, displayName: p.displayName, archetype: p.archetype,
        liveOvr: p.ovr, rarityTier: p.rarity,
        pac: at("pac"), sho: at("sho"), pas: at("pas"), dri: at("dri"), def: at("def"), phy: at("phy"),
      },
    }),
  );
}
export const archLabel = (slug) => ARCHETYPE_LABELS[slug] ?? slug;
const TIER = { common: "Common", bronze: "Bronze", silver: "Silver", gold: "Gold", holo: "Holo", elite: "Elite" };
export const tierLabel = (t) => TIER[t];
export const tierChip = (t) => `<span aria-hidden="true" class="tier-chip" data-rarity="${t}"><span></span></span>`;

/** MidweekMiniCard: rarity, OVR and the plaster in 46px. */
export function mini(name) {
  const p = PLAYERS.get(name);
  return `<span aria-hidden="true" class="mw-mini" data-rarity="${p.rarity}"${p.injured ? " data-injured" : ""}><b>${p.ovr}</b><small>OVR</small></span>`;
}
export const plasterChip = `<span class="chip chip--plaster">Injured</span>`;

// ---------------------------------------------------------------- bracket ----

export const YOU = "Sanne";
export const matchesBy = new Map(T.matches.map((m) => [`${m.round}/${m.pairing}`, m]));
export function finalScore(m) {
  const tl = m.report.timeline;
  return tl.length ? tl[tl.length - 1].score : [0, 0];
}

/** Rebuilds every pairing, byes included (the sample lists byes without positions). */
export function buildBracket() {
  const rounds = [];
  for (let r = 1; r <= T.rounds; r++) {
    const count = T.size / 2 ** r;
    const pairs = [];
    for (let k = 0; k < count; k++) {
      const m = matchesBy.get(`${r}/${k}`);
      if (m) {
        pairs.push({ round: r, pairing: k, sides: m.managers, match: m, winner: m.managers[m.report.winnerSide] });
        continue;
      }
      // Round 1 bye: the entrant is whoever round 2 names on this side.
      const next = matchesBy.get(`2/${Math.floor(k / 2)}`);
      const who = next.managers[k % 2];
      pairs.push({ round: r, pairing: k, sides: [who, null], bye: true, winner: who });
    }
    rounds.push(pairs);
  }
  return rounds;
}
export const BRACKET = buildBracket();
export const revealTimes = Array.from({ length: T.rounds }, (_, i) => revealAt(new Date(T.lockAt), i + 1));

// ---------------------------------------------------------------- chrome -----

const TABS = [
  ["home", "Home", "IconHome"],
  ["collection", "Collection", "IconCollection"],
  ["packs", "Packs", "IconPack"],
  ["market", "Market", "IconMarket"],
  ["leaderboard", "Leaderboard", "IconLeaderboard"],
];

export function chrome(body, { active = "home", balance = "1,240", initials = "SV", admin = null } = {}) {
  const cur = (k) => (k === active ? ' aria-current="true"' : "");
  return `<div class="pg">
<header class="m-top">
  <span class="logo"><i></i>KUT</span>
  <div class="chrome-right">
    <span class="coin-pill">${icon("IconCoin")}<span>${balance}</span></span>
    <span class="round-btn">${icon("IconMessages")}</span>
    <span class="avatar">${initials}</span>
  </div>
</header>
<header class="d-top"><div class="d-top__in">
  <span class="logo"><i></i>KUT</span>
  <nav class="d-nav" aria-label="Primary">${TABS.map(([k, l, i]) => `<a${cur(k)}>${icon(i)}${l}</a>`).join("")}</nav>
  <div class="chrome-right">
    <span class="coin-pill">${icon("IconCoin")}<span>${balance}</span></span>
    <span class="round-btn">${icon("IconMessages")}</span>
    <span class="avatar">${initials}</span>
  </div>
</div></header>
${admin ?? ""}
<main>${body}</main>
<nav class="m-tabs" aria-label="Primary">${TABS.map(([k, l, i]) => `<a${cur(k)}>${icon(i)}<span>${l}</span></a>`).join("")}</nav>
</div>`;
}

export function adminBar(activeKey) {
  const tabs = [
    ["attendance", "Attendance"], ["roster", "Roster"], ["links", "Accounts"], ["accounts", "Recovery"],
    ["economy", "Economy"], ["editions", "Editions"], ["invites", "Invites"], ["midweek", "Midweek"],
  ];
  return `<div class="admin-bar"><div class="admin-bar__in"><p>Admin</p><nav class="row-tabs" aria-label="Admin">${tabs
    .map(([k, l]) => `<a${k === activeKey ? ' aria-current="page"' : ""}${k === "midweek" ? ' class="new"' : ""}>${l}</a>`)
    .join("")}</nav></div></div>`;
}

// ---------------------------------------------------------- components ----

export const pageHead = ({ kicker, title, lede, back }) => `<header class="ph">
  ${back ? `<a class="back">&larr; ${esc(back)}</a>` : ""}
  <p class="kicker">${kicker}</p>
  <h1 class="display">${title}</h1>
  ${lede ? `<p class="lede lede--m-hide">${lede}</p>` : ""}
</header>`;

/** MidweekSeed. `seed` set = the tournament is complete and the seed is public. */
export function seedLine({ open = false, seed = null } = {}) {
  const hash = T.seedHash;
  const short = `${hash.slice(0, 8)}&hellip;${hash.slice(-8)}`;
  return `<details class="mw-seed"${open ? " open" : ""}>
  <summary>Fairness seal <code>${short}</code></summary>
  <p>This week's draws were fixed before anyone picked. The seal is a fingerprint (SHA-256) of a secret seed; the seed is published once the final is shown, so anyone can check the fingerprint matches and nobody, admins included, could have re-rolled the week.</p>
  <code>seal ${hash}</code>
  ${seed ? `<code>seed ${seed}</code><p><span class="ok">&#10003; Matches the seal.</span> SHA-256 of the seed is the seal above.</p>` : ""}
</details>`;
}

export const privacyLine = (text = "From 20:30 on Wednesday, members see the five cards you enter. Never the rest of your collection.") =>
  `<p class="mw-privacy">${icon("IconInfo")}<span>${text}</span></p>`;

export function status(kind, text) {
  return `<p class="mw-status mw-status--${kind}" role="status"><i aria-hidden="true"></i>${text}</p>`;
}

/** One slot row (phones and tablets). */
export function slotRow(n, name, { active = false } = {}) {
  if (!name) {
    return `<li class="mw-slot mw-slot--trialist${active ? " mw-slot--active" : ""}">
  <span class="mw-slot__n">${n}</span>
  ${active ? `<span aria-hidden="true" class="mw-mini mw-mini--empty"><b>+</b></span>` : `<span aria-hidden="true" class="mw-mini mw-mini--trialist"><b>30</b><small>TRI</small></span>`}
  <div><p class="mw-slot__name">${active ? "Choosing&hellip;" : "Trialist"}</p>
  <p class="mw-slot__meta">${active ? "Tap a card below to put it here." : "Plays here if you leave it empty: a Common All-rounder, OVR 30, handicapped."}</p></div>
  <div class="mw-slot__act">${active ? `<span class="btn btn--ghost btn--small">Cancel</span>` : `<span class="btn btn--ghost btn--small">Add</span>`}</div>
</li>`;
  }
  const p = PLAYERS.get(name);
  return `<li class="mw-slot${active ? " mw-slot--active" : ""}">
  <span class="mw-slot__n">${n}</span>
  ${mini(name)}
  <div><p class="mw-slot__name">${esc(p.displayName)}</p>
  <p class="mw-slot__meta">${archLabel(p.archetype)} &middot; ${tierLabel(p.rarity)} &middot; OVR ${p.ovr}${p.injured ? " &middot; plays at reduced fitness" : ""}</p>
  ${p.injured ? `<p class="mw-slot__tags">${plasterChip}</p>` : ""}</div>
  <div class="mw-slot__act"><span class="icon-btn" aria-label="Remove ${esc(p.displayName)} from slot ${n}">&#10005;</span></div>
</li>`;
}

/** The desktop team sheet: LiveCards and trialist frames side by side. */
export function sheet(names, { activeSlot = null } = {}) {
  return `<ol class="mw-sheet" aria-label="Your five">${names
    .map((name, i) => {
      const n = i + 1;
      const active = activeSlot === n;
      const inner = name
        ? card(name)
        : active
          ? `<div class="mw-trialist mw-trialist--empty"><b>+</b><span>Choosing</span><p>Pick a card below for slot ${n}.</p></div>`
          : `<div class="mw-trialist"><b>30</b><span>Trialist</span><p>Plays here if you leave it empty. Handicapped, so a real card is always better.</p></div>`;
      return `<li class="mw-sheet__slot${active ? " mw-sheet__slot--active" : ""}"><p class="mw-sheet__cap"><span>Slot ${n}</span>${name ? `<span class="icon-btn" aria-label="Remove">&#10005;</span>` : ""}</p>${inner}</li>`;
    })
    .join("")}</ol>`;
}

/** MidweekKeeperCheck, from archetypes alone (no factor is known before the lock). */
export function keeperCheck(names) {
  const picked = names.filter(Boolean).map((n) => PLAYERS.get(n));
  const gks = picked.filter((p) => p.archetype === "goalkeeper");
  if (gks.length === 1)
    return `<p class="mw-keeper mw-keeper--ok"><span aria-hidden="true" class="mw-keeper__glove">GK</span><span><b>${esc(gks[0].displayName)}</b> goes in goal.</span></p>`;
  if (gks.length > 1)
    return `<p class="mw-keeper mw-keeper--ok"><span aria-hidden="true" class="mw-keeper__glove">GK</span><span>Your strongest Goalkeeper on the night goes in goal; <b>the other${gks.length > 2 ? "s play" : " plays"} outfield</b>.</span></p>`;
  return `<p class="mw-keeper mw-keeper--warn"><span aria-hidden="true" class="mw-keeper__glove">!</span><span><b>No Goalkeeper in your five.</b> Your best defender goes in goal, and keeps goal much worse than a real one.</span></p>`;
}

/** A pickable card in the grid below the slots. */
export function pickTile(name, { state = "add", slot = null, copies = 1 } = {}) {
  const p = PLAYERS.get(name);
  const btn =
    state === "in"
      ? `<span class="mw-pick__btn mw-pick__btn--in">&#10003; In your five</span>`
      : `<span class="mw-pick__btn">${slot ? `Put in slot ${slot}` : "Add to your five"}</span>`;
  return `<li class="mw-pick${state === "in" ? " mw-pick--in" : ""}"><div class="mw-pick__card">${card(name)}${copies > 1 ? `<span class="mw-pick__copies">&times;${copies} copies</span>` : ""}</div>${btn}<span class="sr-only">${esc(p.displayName)}${p.injured ? ", injured" : ""}</span></li>`;
}

/** MidweekRevealClock. stops: [{time, name, state: lock|done|next|hidden, you}] */
export function clock(stops, { compact = false, label = "Wednesday's schedule" } = {}) {
  const stateWord = { lock: "Locked", done: "Out", next: "Next", hidden: "Hidden" };
  return `<ol class="mw-clock${compact ? " mw-clock--compact" : ""}" style="--n:${stops.length}" aria-label="${label}">${stops
    .map(
      (s) => `<li class="mw-clock__stop" data-state="${s.state}"${s.you ? " data-you" : ""}>
  <span class="mw-clock__time">${s.time}</span>
  <span aria-hidden="true" class="mw-clock__dot">${s.state === "done" ? "&#10003;" : s.state === "lock" ? "&#9679;" : ""}</span>
  <span class="mw-clock__name">${s.name}</span>
  <span class="mw-clock__state">${stateWord[s.state]}</span>
</li>`,
    )
    .join("")}</ol>`;
}
/** The standard evening: lock plus every round, with `revealed` rounds out. */
export function eveningStops(revealed, { lockState = "lock", youThrough = 0 } = {}) {
  return [
    { time: hhmm(T.lockAt), name: "Lock", state: lockState },
    ...revealTimes.map((t, i) => ({
      time: hhmm(t),
      name: roundShort(i + 1),
      state: i < revealed ? "done" : i === revealed ? "next" : "hidden",
      you: i < youThrough,
    })),
  ];
}

/** MidweekMatchRow. `revealed` false shows the time instead of a result. */
export function matchRow(pair, { revealed = true, you = YOU, known = true, href = true } = {}) {
  const r = pair.round;
  const isYou = pair.sides.includes(you);
  if (pair.bye) {
    const who = pair.sides[0];
    return `<div class="mw-match mw-match--bye${isYou ? " mw-match--you" : ""}" role="group" aria-label="${esc(`${who} has a bye. A bye counts as a win.`)}">
  <div class="mw-match__sides"><div class="mw-match__side mw-match__side--won${isYou ? " mw-match__side--you" : ""}"><span class="mw-match__mark" aria-hidden="true">&#10003;</span><span class="mw-match__who"><span>${esc(who)}</span>${isYou ? `<span class="chip chip--you">You</span>` : ""}<span class="chip">Bye</span></span><span></span></div></div>
</div>`;
  }
  const m = pair.match;
  const auto = (name) => T.entries.find((e) => e.manager === name)?.auto;
  if (!revealed) {
    const names = known ? pair.sides : [`Winner, ${shortMatch(r - 1, pair.pairing * 2)}`, `Winner, ${shortMatch(r - 1, pair.pairing * 2 + 1)}`];
    return `<div class="mw-match mw-match--hidden${isYou && known ? " mw-match--you" : ""}" role="group" aria-label="${esc(`${names[0]} v ${names[1]}, result revealed at ${hhmm(revealTimes[r - 1])}`)}">
  <div class="mw-match__sides">${names
    .map((n) => `<div class="mw-match__side${n === you ? " mw-match__side--you" : ""}"><span></span><span class="mw-match__who"><span>${esc(n)}</span>${n === you ? `<span class="chip chip--you">You</span>` : ""}</span><span></span></div>`)
    .join("")}</div>
  <div class="mw-match__hid"><span>Reveals</span><b>${hhmm(revealTimes[r - 1])}</b></div>
</div>`;
  }
  const score = finalScore(m);
  const so = m.report.shootout;
  const w = m.report.winnerSide;
  const label = `${m.managers[0]} ${score[0]}, ${m.managers[1]} ${score[1]}${so ? `, ${so.score[0]}–${so.score[1]} on penalties` : ""}. ${m.managers[w]} won.`;
  return `<div class="mw-match${isYou ? " mw-match--you" : ""}" role="group" aria-label="${esc(label)}">
  <div class="mw-match__sides">${m.managers
    .map((n, s) => {
      const won = s === w;
      return `<div class="mw-match__side ${won ? "mw-match__side--won" : "mw-match__side--lost"}${n === you ? " mw-match__side--you" : ""}"><span class="mw-match__mark" aria-hidden="true">${won ? "&#10003;" : ""}</span><span class="mw-match__who"><span>${esc(n)}</span>${n === you ? `<span class="chip chip--you">You</span>` : ""}${auto(n) ? `<span class="chip chip--auto">Auto</span>` : ""}</span><span class="mw-match__score">${score[s]}${so ? `<small>(${so.score[s]})</small>` : ""}</span></div>`;
    })
    .join("")}</div>
  ${href ? `<a class="mw-match__go" aria-label="Match report">&rsaquo;</a>` : ""}
</div>`;
}

// ------------------------------------------------------------- report ----

export function scoreboard(m) {
  const score = finalScore(m);
  const so = m.report.shootout;
  const w = m.report.winnerSide;
  const why = m.report.why;
  return `<div class="mw-sb" role="group" aria-label="${esc(`Final score: ${m.managers[0]} ${score[0]}, ${m.managers[1]} ${score[1]}${so ? `; ${m.managers[w]} won ${Math.max(...so.score)}–${Math.min(...so.score)} on penalties` : ""}.`)}">
  ${[0, 1]
    .map((s, i) => {
      const side = `<div class="mw-sb__side ${s === w ? "mw-sb__side--won" : "mw-sb__side--lost"}">
    <p class="mw-sb__name">${esc(m.managers[s])}</p>
    <p class="mw-sb__tags">${s === w ? `<span class="chip chip--won">&#10003; Through</span>` : `<span class="chip chip--out">Out</span>`}${m.managers[s] === YOU ? `<span class="chip chip--you">You</span>` : ""}${why[s].auto ? `<span class="chip chip--auto">Auto squad</span>` : ""}</p>
  </div>`;
      return i === 0
        ? `${side}<div class="mw-sb__score" aria-hidden="true"><b>${score[0]}&ndash;${score[1]}</b>${so ? `<small>${so.score[0]}&ndash;${so.score[1]} on pens</small>` : "<small>full time</small>"}</div>`
        : side;
    })
    .join("")}
</div>`;
}

const KIND = { goal: "Goal", save: "Save", block: "Block", woodwork: "Woodwork", wide: "Wide" };
export function timeline(m) {
  return `<ol class="mw-tl" aria-label="Key moments">${m.report.timeline
    .map((t) => {
      const who = m.managers[t.side];
      const [a, b] = t.score;
      const sc = t.kind === "goal" ? (t.side === 0 ? `<b>${a}</b>&ndash;${b}` : `${a}&ndash;<b>${b}</b>`) : `${a}&ndash;${b}`;
      return `<li data-kind="${t.kind}">
  <span class="mw-tl__min">${t.minute}&prime;</span>
  <div class="mw-tl__body">
    <p class="mw-tl__tag"><span class="kind kind--${t.kind}">${KIND[t.kind]}</span><span>${t.kind === "goal" ? `for ${esc(who)}` : `${esc(who)}&rsquo;s chance`}</span></p>
    <p class="mw-tl__text">${esc(t.text)}</p>
  </div>
  <span class="mw-tl__score"><span class="sr-only">Score after this: ${m.managers[0]} ${a}, ${m.managers[1]} ${b}. </span><span aria-hidden="true">${sc}</span></span>
</li>`;
    })
    .join("")}</ol>`;
}

export function shootout(m) {
  const so = m.report.shootout;
  if (!so) return "";
  const perSide = [0, 1].map((s) => so.kicks.filter((k) => k.side === s));
  const rows = [0, 1]
    .map((s) => {
      const kicks = perSide[s]
        .map((k) => {
          const g = k.outcome === "goal";
          return `<span class="mw-so__k ${g ? "mw-so__k--goal" : "mw-so__k--miss"}${k.round > 5 ? " mw-so__k--sd" : ""}" aria-hidden="true">${g ? "&#10003;" : "&#10005;"}</span>`;
        })
        .join("");
      return `<div class="mw-so__row"><span class="mw-so__name">${esc(m.managers[s])}</span><span style="display:flex;gap:10px;align-items:center"><span class="mw-so__kicks">${kicks}</span><span class="mw-so__tally">${so.score[s]}</span></span></div>`;
    })
    .join("");
  const sr = so.kicks
    .map((k) => `<tr><td>${k.round}</td><td>${esc(m.managers[k.side])}</td><td>${esc(k.kicker)}</td><td>${k.outcome === "goal" ? "scored" : "missed"}</td></tr>`)
    .join("");
  return `<section class="mw-so" aria-labelledby="so-h">
  <div class="sec__h"><h2 class="display h2" id="so-h">Penalties</h2><p class="small faint">${so.kicks.length} kicks &middot; ${perSide[0].length > 5 ? "sudden death" : "five each"}</p></div>
  <div class="mw-so__grid" aria-hidden="true">${rows}</div>
  <p class="legend" aria-hidden="true"><span><span class="mw-so__k mw-so__k--goal">&#10003;</span>scored</span><span><span class="mw-so__k mw-so__k--miss">&#10005;</span>missed</span>${perSide[0].length > 5 ? `<span><span class="mw-so__k mw-so__k--goal mw-so__k--sd"></span>sudden death</span>` : ""}</p>
  <table class="sr-only"><caption>Every kick in order</caption><thead><tr><th>Round</th><th>Side</th><th>Kicker</th><th>Result</th></tr></thead><tbody>${sr}</tbody></table>
  <ol class="mw-so__lines">${so.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ol>
</section>`;
}

function fx(label, v, { neutral = false } = {}) {
  const n = v / 1_000_000;
  const cls = neutral ? "" : n >= 1.005 ? "up" : n <= 0.995 ? "down" : "";
  return `<div><dt>${label}</dt><dd class="${cls}">${n.toFixed(2)}</dd></div>`;
}
export function whyPanel(m) {
  const why = m.report.why;
  const a = why[0].winChancePpm;
  const side = (s) => {
    const w = why[s];
    return `<section class="mw-why__side" aria-label="${esc(`${w.manager}'s five`)}">
  <div class="mw-why__sh"><h3>${esc(w.manager)}${w.auto ? ` <span class="chip chip--auto">Auto squad</span>` : ""}${w.keeperless ? ` <span class="chip chip--warn">No keeper</span>` : ""}</h3><p>${pct(w.winChancePpm)} before kick-off</p></div>
  <ul>${w.cards
    .map((c) => {
      const p = c.trialist ? null : playerOf(c.name);
      const tags = [
        c.inGoal ? `<span class="chip">In goal</span>` : "",
        c.trialist ? `<span class="chip">Trialist</span>` : "",
        c.injured ? plasterChip : "",
        c.handicapPpm !== 1_000_000 ? `<span class="chip chip--auto">handicap &times;${ppm(c.handicapPpm)}</span>` : "",
        c.pickLabel && c.pickLabel !== "auto squad" ? `<span class="chip${c.pickLabel === "a rare pick" ? " chip--auto" : ""}">${esc(c.pickLabel)}</span>` : "",
        c.goals ? `<span class="chip chip--won">${c.goals} goal${c.goals > 1 ? "s" : ""}</span>` : "",
        c.assists ? `<span class="chip">${c.assists} assist${c.assists > 1 ? "s" : ""}</span>` : "",
      ].join("");
      return `<li class="mw-wc">
    <div class="mw-wc__top">${p ? tierChip(p.rarity) : `<span aria-hidden="true" class="mw-wc__tchip"></span>`}<p class="mw-wc__name">${esc(c.name)}<small>${archLabel(c.archetype)} &middot; OVR ${c.ovr}</small></p><p class="mw-wc__power">${ppm(c.powerPpm)}<small>Power</small></p></div>
    <dl class="mw-fx">${fx("OVR", c.ovrFactorPpm)}${fx("Form", c.formRollPpm)}${fx("Pick", c.pickFactorPpm)}${fx("Fitness", c.fitnessPpm)}${fx("Day", c.dayRollPpm)}</dl>
    ${tags ? `<p class="mw-wc__tags">${tags}</p>` : ""}
  </li>`;
    })
    .join("")}</ul>
</section>`;
  };
  return `<section class="mw-why" aria-labelledby="why-h">
  <div class="sec__h"><h2 class="display h2" id="why-h">Why</h2></div>
  <div class="mw-odds">
    <p class="kicker--faint kicker">Chances before kick-off</p>
    <div class="mw-odds__bar" role="img" aria-label="${esc(`Before kick-off: ${why[0].manager} ${pct(a)}, ${why[1].manager} ${pct(why[1].winChancePpm)}`)}"><span style="width:${a / 10_000}%">${pct(a)}</span><span style="width:${why[1].winChancePpm / 10_000}%">${pct(why[1].winChancePpm)}</span></div>
    <p class="mw-odds__legend" aria-hidden="true"><span>${esc(why[0].manager)}</span><span>${esc(why[1].manager)}</span></p>
  </div>
  ${side(0)}${side(1)}
  <p class="mw-why__formula">Power is the card's week: <code>OVR &times; Form &times; Pick &times; Fitness</code>, times any handicap, fixed at the lock. Each match multiplies it by a fresh Day roll. A green arrow is above 1.00, a red one below.</p>
</section>`;
}

// ------------------------------------------------------------- page file ----

const kutCss = fs
  .readFileSync(path.join(root, "src/app/globals.css"), "utf8")
  .replace('@import "tailwindcss";', "")
  .replace("@theme inline {", ":root {");
const mwCss = fs.readFileSync(path.join(here, "midweek.css"), "utf8");

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
  <!-- Generated by design/midweek/build/build.mjs from the real LiveCard, icons and
       globals.css in src/, and from design/midweek/sample-tournament.json. Edit the
       generator, not this file. -->
  <style>
${kutCss}
${mwCss}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}
