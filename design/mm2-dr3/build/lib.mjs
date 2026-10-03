// Shared pieces for the MM 2.0 design round 3 mockups: ratings, predictions,
// the shareable images, the picker's plusses count and the deeper team
// colours. Builds on design/ux-review/build (DR2: the evening clock, Compete
// chrome, scoreboard, lane timeline, Why list) and design/midweek/build (the
// real LiveCard, icons and sample tournament). Design only; nothing in the app
// imports this.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { React, renderToStaticMarkup, root, src } from "../../midweek/build/source.mjs";
import { MIDWEEK, roundPayouts } from "../../midweek/build/lib.mjs";
import {
  T, PLAYERS, YOU, card, mini, esc, icon, finalScore, archLabel, tierLabel, roundName, roundShort,
  roundStart, hhmm, fullTimeAt, mOf, mgr, baseName, playerOf,
} from "../../ux-review/build/lib.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
export const R = require("../../midweek/sample-ratings.json");
const { LiveCard } = src("components/live-card.tsx");
export const { RATING } = src("lib/midweek/report/ratings.ts");
export const { predictionCoins } = src("game/midweek/rewards.ts");
export { MIDWEEK, roundPayouts };

/** Coins a correct pick pays this week (ADR-118): 30 split over the matches after round 1. */
export const PICK_COINS = predictionCoins(T.rounds);
const signedPct = (v) => (v > 0 ? `+${v}` : `${v}`);
export const fmtRating = (r) => r.toFixed(1);

// ---------------------------------------------------------------- ratings ----
// The ratings sample (ADR-117) replays the DR2 world on today's engine, so its
// scores differ from sample-tournament.json; its opponents match for Sanne.
// Numbers and lines are used exactly as the real function wrote them.

export const ratingsOf = (manager) => R.members.find((m) => m.manager === manager);

/** The neutral rating disc: a circle, never tinted, so it can't be read as Power's bands. */
export function ratingDisc(r, { size = "", what = "for the night" } = {}) {
  return `<span class="r3-rt${size ? ` r3-rt--${size}` : ""}"><b aria-hidden="true">${fmtRating(r)}</b><span class="sr-only">rated ${fmtRating(r)} out of 10 ${what}</span></span>`;
}

const tierOf = (c) => (c.trialist ? "" : tierLabel(c.rarity));
function miniFor(c) {
  if (c.trialist) return `<span aria-hidden="true" class="mw-mini mw-mini--trialist"><b>30</b><small>TRI</small></span>`;
  return mini(c.name);
}

/**
 * MidweekRatingList: a member's five after the night, best first. Below lg one
 * row per card; from lg the five LiveCards with the rating under each. `open`
 * shows each card's match-by-match ratings, each linking to its report.
 */
export function ratingList(manager, { open = false, heading = "Your five&rsquo;s ratings", id = "rt-h", link = null } = {}) {
  const m = ratingsOf(manager);
  const rows = m.five.map((c, slot) => ({ ...c, slot })).sort((a, b) => b.rating - a.rating || a.slot - b.slot);
  const best = rows[0].rating;
  const played = m.matches.length;
  const matchChips = (c) =>
    `<ul class="r3-pm" aria-label="${esc(`${c.name}, match by match`)}">${m.matches
      .map((x, i) => `<li><a><span>${roundShort(x.round)} v ${esc(x.opponent)}</span>${ratingDisc(c.matchRatings[i], { size: "xs", what: `against ${x.opponent}` })}</a></li>`)
      .join("")}</ul>`;
  const meta = (c) => [c.archetype, tierOf(c), c.inGoal ? "in goal" : ""].filter(Boolean).join(" &middot; ");
  const bestChip = (c) => (c.rating === best ? `<span class="r3-best"><span aria-hidden="true">&#9733;</span> Best of your five</span>` : "");
  const list = rows
    .map(
      (c) => `<li class="r3-rl">
    ${miniFor(c)}
    <div class="r3-rl__body"><p class="r3-rl__name"><b>${esc(c.name)}</b>${bestChip(c)}</p><p class="r3-rl__meta">${meta(c)}</p><p class="r3-line">${esc(c.line)}</p>${open ? matchChips(c) : ""}</div>
    ${ratingDisc(c.rating)}
  </li>`,
    )
    .join("");
  const grid = rows
    .map(
      (c) => `<li class="r3-rg">
    <div class="r3-rg__card">${c.trialist ? `<div class="mw-trialist"><b>30</b><span>Trialist</span></div>` : card(c.name)}</div>
    <div class="r3-rg__row">${ratingDisc(c.rating, { size: "lg" })}<p class="r3-rl__name"><b>${esc(c.name)}</b>${bestChip(c)}</p></div>
    <p class="r3-line">${esc(c.line)}</p>${open ? matchChips(c) : ""}
  </li>`,
    )
    .join("");
  return `<section class="ux-block r3-ratings" aria-labelledby="${id}">
  <div class="ux-block__h"><h2 class="display" id="${id}">${heading}</h2>${link ?? `<p class="small faint">Out of 10, the mean of ${played} matches</p>`}</div>
  <ol class="r3-rlist" aria-label="Ratings, best first">${list}</ol>
  <ol class="r3-rgrid" aria-label="Ratings, best first">${grid}</ol>
  <p class="r3-ratings__act"><span class="btn btn--secondary btn--small" aria-expanded="${open}">${open ? "Hide each match" : "Show each match"}</span><a class="link">How ratings work &rarr;</a></p>
  <p class="r3-foot">Every card starts at ${RATING.base} and gains for goals, assists, saves and blocks, more for the harder ones; a win adds ${RATING.result} and a defeat takes ${RATING.result} off. A miss never costs the shooter. The night&rsquo;s rating is the mean of the card&rsquo;s matches; a bye isn&rsquo;t a match.</p>
</section>`;
}

// ------------------------------------------------------------- Why, rated --
// DR2's MidweekWhyList, with each card's rating for this match on the right
// once the week is complete. Power stays the coloured pill on the left.

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const LO = 0.5;
const HI = 1.5;
function powerBar(power) {
  const x = Math.max(2, Math.min(100, ((power - LO) / (HI - LO)) * 100));
  return `<svg class="ux-wl__bar" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="6" rx="3" class="bg"/><rect x="0" y="0" width="${x.toFixed(1)}" height="6" rx="3" class="fill"/><rect x="49.6" y="0" width="0.8" height="6" class="tick"/></svg>`;
}
const BANDS = [[1.1, 4, "strong"], [1.0, 3, "above ordinary"], [0.9, 2, "below ordinary"], [-Infinity, 1, "weak"]];
const bandOf = (power) => BANDS.find(([min]) => power >= min);

/** `ratings` is [side 0, side 1], each the match ratings in slot order; null before the week is complete. */
export function whyListRated(m, ratings) {
  const why = m.report.why;
  const a = Math.round(why[0].winChancePpm / 10_000);
  const side = (s) => {
    const w = why[s];
    const matchPower = (c) => (c.powerPpm / 1e6) * (c.dayRollPpm / 1e6);
    const rows = w.cards.map((c, slot) => ({ c, slot })).sort((x, y) => matchPower(y.c) - matchPower(x.c));
    return `<section class="ux-wl" aria-label="${esc(`${w.manager}'s five`)}">
  <h3 class="ux-wl__h">${mgr(m, s)}<small>${Math.round(w.winChancePpm / 10_000)}% before kick-off</small>${w.auto ? `<span class="chip chip--auto">Auto squad</span>` : ""}${w.keeperless ? `<span class="chip chip--warn">No keeper</span>` : ""}${ratings ? `<span class="r3-colh" aria-hidden="true">Rating</span>` : ""}</h3>
  <ul>${rows
    .map(({ c, slot }) => {
      const notes = [
        c.inGoal ? "in goal" : "", c.trialist ? "trialist" : "", c.injured ? "injured" : "",
        c.handicapPpm !== 1_000_000 ? `handicap &times;${(c.handicapPpm / 1e6).toFixed(3)}` : "",
        c.goals ? plural(c.goals, "goal") : "", c.assists ? plural(c.assists, "assist") : "",
      ].filter(Boolean);
      const power = matchPower(c);
      const [, band, bandName] = bandOf(power);
      return `<li class="ux-wl__row ux-pw--${band}${ratings ? " r3-wl__row" : ""}">
    <p class="ux-wl__pw">${power.toFixed(2)}<span class="sr-only"> power, ${bandName}</span></p>
    <p class="ux-wl__name"><span class="tn tn--${s === 0 ? "b" : "r"}">${esc(baseName(c.name))}</span> <small>${archLabel(c.archetype)} &middot; ${c.ovr}${notes.length ? ` &middot; <b>${notes.join(", ")}</b>` : ""}</small></p>
    ${powerBar(power)}
    ${ratings ? ratingDisc(ratings[s][slot], { size: "sm", what: "for this match" }) : ""}
  </li>`;
    })
    .join("")}</ul>
</section>`;
  };
  return `<section class="ux-why" aria-labelledby="why-h">
  <div class="sec__h"><h2 class="display h2" id="why-h">Why</h2></div>
  ${ratings ? `<p class="r3-key" aria-hidden="true"><span><span class="r3-key__pw">1.19</span> Power: how strong a card was going in</span><span>${ratingDisc(7.2, { size: "xs" })} Rating: how it played, out of 10</span></p>` : ""}
  <div class="ux-odds">
    <p class="kicker kicker--faint">Chances before kick-off</p>
    <svg class="ux-odds__bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(`Before kick-off: ${why[0].manager} ${a}%, ${why[1].manager} ${100 - a}%`)}"><rect x="0" y="0" width="${a}" height="10" class="b"/><rect x="${a}" y="0" width="${100 - a}" height="10" class="r"/></svg>
    <p class="ux-odds__legend"><span>${mgr(m, 0)} <b>${a}%</b></span><span><b>${100 - a}%</b> ${mgr(m, 1)}</span></p>
  </div>
  <div class="ux-why__sides">${side(0)}${side(1)}</div>
  <p><span class="btn btn--secondary btn--small" aria-expanded="false">Show every factor</span></p>
  <p class="ux-why__foot">Power is a card&rsquo;s strength in this match; 1.00, the tick on each bar, is an ordinary card. Green is stronger than that, amber and orange weaker. It multiplies the card&rsquo;s rating, form, pick, fitness and this match&rsquo;s day roll.${ratings ? ` The circle on the right is how the card played in this match, out of 10, from what it did: every card starts at ${RATING.base}.` : ""} Who picked whom is on the bracket page after the final.</p>
</section>`;
}

/** Both sides' ratings for one sample match, in slot order (ratings sample, ADR-117). */
export function matchRatingsFor(m) {
  return [0, 1].map((s) => {
    const mem = ratingsOf(m.managers[s]);
    const i = mem.matches.findIndex((x) => x.round === m.round);
    return mem.five.map((c) => c.matchRatings[i]);
  });
}

// ------------------------------------------------------------ predictions --
// MidweekPredictions: the matches a member who is out can call. Cards are
// neutral (a list of matches, DR2-1). Each is a fieldset of two radios that
// save on change; the status line is aria-live.

/**
 * spec: { label, kickoff (Date), sides: [name|null, name|null], feeders: [text, text],
 *   state: notyet|open|saving|saved|changed|closed|ended, pick: 0|1|null, savedAt,
 *   split: [n0, n1], winner: 0|1, live, error }
 */
export function predictCard(p) {
  const closed = p.state === "closed" || p.state === "ended";
  const names = p.sides.map((n, i) => n ?? p.feeders[i]);
  const legend = `${p.label} &middot; kick-off ${hhmm(p.kickoff)}`;
  if (p.state === "notyet")
    return `<li class="r3-pc r3-pc--notyet"><p class="r3-pc__k">${legend}</p><div class="r3-opts" aria-hidden="true"><span class="r3-opt r3-opt--tbd">${esc(names[0])}</span><span class="r3-pc__v">v</span><span class="r3-opt r3-opt--tbd">${esc(names[1])}</span></div><p class="r3-pc__st"><span class="r3-ic r3-ic--wait" aria-hidden="true"></span>Opens when both matches before it have ended.</p></li>`;
  const option = (i) => {
    const mine = p.pick === i;
    const won = p.state === "ended" && p.winner === i;
    const busy = p.state === "saving" && mine;
    return `<button type="button" class="r3-opt${mine ? " r3-opt--mine" : ""}${won ? " r3-opt--won" : ""}${closed ? " r3-opt--closed" : ""}" aria-pressed="${mine}"${closed || p.state === "saving" ? " disabled" : ""}>
      <span class="r3-opt__dot" aria-hidden="true">${mine ? "&#10003;" : ""}</span>
      <span class="r3-opt__name">${esc(names[i])}</span>
      ${busy ? `<span class="r3-opt__tag">Saving&hellip;</span>` : mine ? `<span class="r3-opt__tag">Your pick</span>` : ""}
      ${won ? `<span class="r3-opt__won">Won</span>` : ""}
    </button>`;
  };
  const split = p.split
    ? (() => {
        const [x, y] = p.split;
        const tot = x + y || 1;
        const w0 = Math.round((x / tot) * 100);
        return `<div class="r3-split"><p class="r3-split__h">How the club called it</p>
        <svg class="r3-split__bar" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${esc(`${x} picked ${names[0]}, ${y} picked ${names[1]}`)}"><rect x="0" y="0" width="${Math.max(0, w0 - 0.6)}" height="8" class="a"/><rect x="${Math.min(100, w0 + 0.6)}" y="0" width="${Math.max(0, 100 - w0 - 0.6)}" height="8" class="b"/></svg>
        <p class="r3-split__legend" aria-hidden="true"><span>${esc(names[0])} <b>${x}</b></span><span><b>${y}</b> ${esc(names[1])}</span></p></div>`;
      })()
    : "";
  const status = {
    open: p.pick == null ? `Tap a name to call it. Closes at kick-off, ${hhmm(p.kickoff)}.` : "",
    cleared: `Pick cleared. Tap a name to call it. Closes at kick-off, ${hhmm(p.kickoff)}.`,
    saving: `Saving your pick&hellip;`,
    saved: `<span class="r3-ok">&#10003; Saved ${p.savedAt}.</span> Change it until kick-off, ${hhmm(p.kickoff)}; tap ${esc(names[p.pick] ?? "")} again to clear it.`,
    changed: `<span class="r3-ok">&#10003; Changed to ${esc(names[p.pick] ?? "")}, ${p.savedAt}.</span> Change it until kick-off, ${hhmm(p.kickoff)}; tap ${esc(names[p.pick] ?? "")} again to clear it.`,
    closed: p.pick == null ? `Closed at kick-off. You didn&rsquo;t call this one.` : `Closed at kick-off. You picked ${esc(names[p.pick])}.`,
    ended:
      p.pick == null
        ? `${esc(names[p.winner])} won. You didn&rsquo;t call this one.`
        : p.pick === p.winner
          ? `<span class="r3-called">&#10003; You called it</span> ${esc(names[p.winner])} won. +${PICK_COINS} KUT Coins${p.paid ? "" : " after the final"}.`
          : `<span class="r3-missed">Not this time</span> ${esc(names[p.winner])} won.`,
  }[p.state];
  const err = p.error ? `<p class="r3-pc__err" role="alert">${p.error}</p>` : "";
  const right = p.live ? `<span class="ux-live">Live</span>` : p.state === "ended" ? `<span class="r3-pc__ft">Full time</span>` : closed ? `<span class="r3-pc__ft">Closed</span>` : `<span class="r3-pc__coins">+${PICK_COINS}</span>`;
  return `<li class="r3-pc r3-pc--${p.state}"><div class="r3-pc__in" role="group" aria-label="${esc(`${legend.replace("&middot;", ",")}. Who wins?`)}"${p.state === "saving" ? ' aria-busy="true"' : ""}>
    <div class="r3-pc__k" aria-hidden="true"><span>${legend}</span>${right}</div>
    <div class="r3-opts">${option(0)}<span class="r3-pc__v" aria-hidden="true">v</span>${option(1)}</div>
    ${split}
    ${status ? `<p class="r3-pc__st" aria-live="polite">${status}</p>` : ""}${err}
  </div></li>`;
}

/** The block on the evening page once you're out. */
export function predictBlock(cards, { foot = null, title = "Call the winners", note = null } = {}) {
  return `<section class="ux-block r3-predict" aria-labelledby="pr-h">
  <div class="ux-block__h"><h2 class="display" id="pr-h">${title}</h2><p class="small faint">${note ?? `+${PICK_COINS} KUT Coins a correct pick &middot; paid after the final`}</p></div>
  <ol class="r3-pcs">${cards.map(predictCard).join("")}</ol>
  ${foot ? `<p class="r3-foot">${foot}</p>` : ""}
</section>`;
}
export const PREDICT_FOOT = `You&rsquo;re out, so you can call the winners of the matches still to come. A match opens once both matches before it have ended, and closes at its kick-off. Your picks are yours: from kick-off everyone sees how the club split, never who picked whom.`;

/** The weekly line (ADR-118), as in the result message. */
export const weeklyLine = (correct, picks) =>
  correct > 0 ? `You called ${correct} of ${picks} right: +${correct * PICK_COINS} KUT Coins.` : `You called 0 of ${picks} right.`;

// --------------------------------------------------------- plusses count --
// MidweekLineCount (ADR-116, Q13's later slice): the plusses the four cards
// not in goal give each line, against the 3 a line needs; every plus short
// multiplies the whole five by 0.88. Pips are shape AND count AND words.

export const PLUSSES = MIDWEEK.shape.plusses;
export const NEED = MIDWEEK.balance.minPlusses;
const SHORTFALL = MIDWEEK.balance.shortfallPpm;
const LINES = ["Attack", "Midfield", "Defence"];
export function balanceOf(archetypes) {
  const sum = [0, 1, 2].map((l) => archetypes.reduce((a, k) => a + PLUSSES[k][l], 0));
  const short = sum.map((v) => Math.max(0, NEED - v));
  let ppm = 1_000_000;
  for (let i = 0; i < short[0] + short[1] + short[2]; i++) ppm = Math.floor((ppm * SHORTFALL) / 1_000_000);
  return { sum, short, total: short[0] + short[1] + short[2], factor: ppm / 1e6 };
}
/** Always the 3 a line needs, filled or dashed; anything above 3 as "+n". */
const pips = (n) =>
  `<span class="r3-pips" aria-hidden="true">${Array.from({ length: NEED }, (_, i) => `<i class="${i < n ? "on" : "off"}"></i>`).join("")}${n > NEED ? `<em>+${n - NEED}</em>` : ""}</span>`;
export const factorText = (f) => `&times;${f.toFixed(2)}`;
/**
 * keeper: { name, stand: false } the Goalkeeper in goal, or { name, stand: true } the
 * likely stand-in in a five without one.
 */
export function lineCount(archetypes, keeper) {
  if (!keeper) {
    return `<section class="r3-lc r3-lc--none" aria-labelledby="lc-h">
  <div class="r3-lc__h"><h3 id="lc-h">Plusses per line</h3><a class="link small">How plusses work &rarr;</a></div>
  <p class="r3-lc__v">Add a Goalkeeper to see your count. Without one, who stands in goal is only settled at the lock, so the picker can&rsquo;t say which four cards count.</p>
  <p class="r3-lc__k">Each line needs ${NEED} plusses from the four cards not in goal; every plus short costs the whole five ${factorText(SHORTFALL / 1e6)}.</p>
</section>`;
  }
  const b = balanceOf(archetypes);
  const rows = LINES.map((l, i) => {
    const ok = b.short[i] === 0;
    return `<li class="r3-lc__row${ok ? "" : " r3-lc__row--short"}"><span class="r3-lc__l">${l}</span>${pips(b.sum[i])}<span class="r3-lc__n"><b>${b.sum[i]}</b> of ${NEED}</span><span class="r3-lc__st">${ok ? `<span aria-hidden="true">&#10003;</span> enough` : `<span aria-hidden="true" class="r3-lc__bang">!</span> ${b.short[i]} short`}</span></li>`;
  }).join("");
  const shortLines = LINES.map((l, i) => [l, b.short[i]]).filter(([, n]) => n);
  const verdict = b.total === 0
    ? `<b>Balanced.</b> Every line has ${NEED} or more, so no penalty.`
    : `<b>${shortLines.map(([l, n]) => `${l} ${n} short`).join(", ")}:</b> ${b.total === 1 ? "one plus" : `${b.total} plusses`} short, so your whole five plays at <b>${factorText(b.factor)}</b> this week.`;
  const kp = keeper.many
    ? `One of your Goalkeepers goes in goal and isn&rsquo;t counted; the others play outfield with their plusses.`
    : `<b>${esc(keeper.name)}</b> goes in goal and isn&rsquo;t counted.`;
  return `<section class="r3-lc${b.total ? " r3-lc--short" : ""}" aria-labelledby="lc-h">
  <div class="r3-lc__h"><h3 id="lc-h">Plusses per line</h3><a class="link small">How plusses work &rarr;</a></div>
  <ul class="r3-lc__rows" aria-label="${esc(LINES.map((l, i) => `${l} ${b.sum[i]} of ${NEED}${b.short[i] ? `, ${b.short[i]} short` : ", enough"}`).join("; "))}">${rows}</ul>
  <p class="r3-lc__v" aria-live="polite">${verdict}</p>
  <p class="r3-lc__k">${kp} Each line needs ${NEED} plusses from the four cards not in goal; every plus short costs the whole five ${factorText(SHORTFALL / 1e6)}.</p>
</section>`;
}
/** The one line the sticky save bar carries on a phone. */
export function lineCountShort(archetypes, keeper = true) {
  if (!keeper) return `<span class="r3-lcs r3-lcs--none">No Goalkeeper yet, so no line count</span>`;
  const b = balanceOf(archetypes);
  if (!b.total) return `<span class="r3-lcs"><span aria-hidden="true">&#10003;</span> Lines balanced</span>`;
  const shortLines = LINES.map((l, i) => [l, b.short[i]]).filter(([, n]) => n);
  return `<span class="r3-lcs r3-lcs--short"><span aria-hidden="true">!</span> ${shortLines.map(([l, n]) => `${l} ${n} short`).join(", ")} &middot; ${factorText(b.factor)}</span>`;
}

// ---------------------------------------------------------- share images --
// Drawn on a <canvas> in the browser at 1080 x 1350 (4:5). These HTML versions
// are the design the canvas code copies: every position is a fixed px value
// in that frame. The card art is the LiveCard's own (photo or shirt back).

/** A stand-in "photo": an illustration, not a person. The app uses the Player's real photo. */
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c8fae"/><stop offset="1" stop-color="#2f4a3a"/></linearGradient></defs><rect width="200" height="200" fill="url(#s)"/><rect y="150" width="200" height="50" fill="#3d6b3f"/><path d="M0 150 L200 150" stroke="#e8e4d4" stroke-width="2" opacity=".5"/><circle cx="100" cy="74" r="30" fill="#c99a78"/><path d="M70 62 Q100 30 130 62 Q128 46 100 40 Q72 46 70 62Z" fill="#3b2a20"/><path d="M38 200 C40 140 66 118 100 118 C134 118 160 140 162 200Z" fill="#b8323f"/><path d="M84 118 L100 140 L116 118" fill="none" stroke="#f1ead8" stroke-width="5"/></svg>`)}`;

export function shareCard(name, { photo = false } = {}) {
  const p = PLAYERS.get(name);
  return renderToStaticMarkup(
    React.createElement(LiveCard, {
      size: "grid",
      player: { id: p.id, injured: false, displayName: p.displayName, archetype: p.archetype, liveOvr: p.ovr, rarityTier: p.rarity, photoUrl: photo ? PHOTO : null, pac: p.ovr, sho: p.ovr, pas: p.ovr, dri: p.ovr, def: p.ovr, phy: p.ovr },
    }),
  );
}

const imgHead = (kicker) => `<div class="r3-img__top"><span class="logo"><i></i>KUT</span><span>${kicker}</span></div>`;
const imgFoot = (text) => `<div class="r3-img__foot"><span>${text}</span></div>`;

/** The champion poster, anyone may share it. */
export function posterImage({ champion, final: f, five, photo, path: route, stats }) {
  return `<div class="r3-img r3-img--poster" role="img" aria-label="${esc(`Midweek Madness champion poster: ${champion}`)}">
  ${imgHead("Midweek Madness &middot; Wed 7 Oct 2026")}
  <div class="r3-img__hero"><p class="r3-img__k">Champion</p><p class="r3-img__name"><span class="r3-img__shield" aria-hidden="true"></span>${esc(champion)}</p><p class="r3-img__sub">${f}</p></div>
  <p class="r3-img__cap">${esc(champion)}&rsquo;s five &middot; rated out of 10 for the night</p>
  <ol class="r3-img__five">${five
    .map((c) => `<li>${shareCard(c.name, { photo: photo.includes(c.name) })}<p><b>${fmtRating(c.rating)}</b><span>${esc(c.name)}</span></p></li>`)
    .join("")}</ol>
  <ol class="r3-img__path">${route.map(([r, t]) => `<li><span>${r}</span><b>${t}</b></li>`).join("")}</ol>
  ${imgFoot(stats)}
</div>`;
}

/** "My night": your own five and path, with the night's ratings. */
export function myNightImage({ manager, finish, coins, path: route, five, photo, best, called }) {
  return `<div class="r3-img r3-img--night" role="img" aria-label="${esc(`${manager}'s night at Midweek Madness`)}">
  ${imgHead("Midweek Madness &middot; Wed 7 Oct 2026")}
  <div class="r3-img__hero r3-img__hero--night"><p class="r3-img__k">${esc(manager)}&rsquo;s night</p><p class="r3-img__name r3-img__name--night">${finish}</p><p class="r3-img__coins">+${coins} <small>KUT Coins</small></p></div>
  <ol class="r3-img__path r3-img__path--night">${route.map(([r, t, mark]) => `<li class="${mark ?? ""}"><span>${r}</span><b>${t}</b></li>`).join("")}</ol>
  <p class="r3-img__cap">${esc(manager)}&rsquo;s five &middot; rated out of 10 for the night</p>
  <ol class="r3-img__five">${five
    .map((c) => `<li${c.name === best.name ? ' class="best"' : ""}>${shareCard(c.name, { photo: photo.includes(c.name) })}<p><b>${fmtRating(c.rating)}</b><span>${esc(c.name)}</span></p></li>`)
    .join("")}</ol>
  <p class="r3-img__quote"><span>&#9733; ${esc(best.name)} ${fmtRating(best.rating)}</span>${esc(best.line)}</p>
  ${imgFoot(called)}
</div>`;
}

// ------------------------------------------------------------ team colours --

export const TOKENS_BEFORE = {
  "--color-team-blue": "#7cb0ff", "--color-team-blue-fill": "#7cb0ff", "--color-team-blue-bg": "#14213a", "--color-team-blue-line": "#2f4f86", "--color-ink-on-team-blue": "#0b1424",
  "--color-team-red": "#ff8091", "--color-team-red-fill": "#ff8091", "--color-team-red-bg": "#331419", "--color-team-red-line": "#7a2d3b", "--color-ink-on-team-red": "#2a0a10",
  "--color-live": "#ff8091", "--color-ink-on-live": "#2a0a10", "--color-live-bg": "#331419", "--color-live-line": "#7a2d3b",
};
/** Chosen (owner, 3 Oct): violet and teal. Text tones for names and numbers, deep fills for everything drawn. */
export const TOKENS_AFTER = {
  "--color-team-blue": "#9e80d1", "--color-team-blue-fill": "#6f4fa1", "--color-team-blue-bg": "#181322", "--color-team-blue-line": "#423658", "--color-ink-on-team-blue": "#f4efe3",
  "--color-team-red": "#4fb3a0", "--color-team-red-fill": "#1f7a6c", "--color-team-red-bg": "#0e1f1c", "--color-team-red-line": "#23514a", "--color-ink-on-team-red": "#f4efe3",
  "--color-live": "#ff8091", "--color-ink-on-live": "#2a0a10", "--color-live-bg": "#331419", "--color-live-line": "#7a2d3b",
};
/** Round 2's choice, royal blue and teal, kept for comparison. */
export const TOKENS_ROYAL = {
  ...TOKENS_AFTER,
  "--color-team-blue": "#7d9bdb", "--color-team-blue-fill": "#3966c2", "--color-team-blue-bg": "#111a2f", "--color-team-blue-line": "#2c4677", "--color-ink-on-team-blue": "#f4efe3",
};
const tokenCss = (sel, t) => `${sel} { ${Object.entries(t).map(([k, v]) => `${k}: ${v};`).join(" ")} }`;

/** OKLCH to sRGB hex (null when out of gamut): how the pair colours below were found. */
export function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (lin.some((v) => v < -0.001 || v > 1.001)) return null;
  const enc = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
  return `#${lin.map((v) => enc(v).toString(16).padStart(2, "0")).join("")}`;
}
/** One side colour: a text tone (AA on panel-2) and a deep fill at OKLCH L 0.5, with a dark tint and a border of the same hue. */
const sideColour = (name, h, text, fill) => ({ name, h, text, fill, bg: oklch(0.2, 0.03, h), line: oklch(0.36, 0.06, h) });
export const SIDE_COLOURS = {
  royal: sideColour("Royal blue", 262, "#7d9bdb", "#3966c2"),
  teal: sideColour("Teal", 175, "#4fb3a0", "#1f7a6c"),
  olive: sideColour("Olive", 100, "#a4932e", "#71640b"),
  indigo: sideColour("Indigo", 280, "#8489da", "#5658ab"),
  plum: sideColour("Plum", 330, "#bb76b5", "#8b4486"),
  violet: sideColour("Violet", 300, "#9e80d1", "#6f4fa1"),
};
/** Pairs for the owner (round 3): side 0, side 1. The owner chose violet and teal. */
export const PAIRS = [
  { id: "royal-teal", sides: ["royal", "teal"], label: "Royal blue and teal (round 2's choice)" },
  { id: "indigo-olive", sides: ["indigo", "olive"], label: "Indigo and olive" },
  { id: "plum-olive", sides: ["plum", "olive"], label: "Plum and olive" },
  { id: "violet-teal", sides: ["violet", "teal"], label: "Violet and teal (chosen)" },
];
export function pairTokens(pair) {
  const [a, b] = pair.sides.map((k) => SIDE_COLOURS[k]);
  return {
    "--color-team-blue": a.text, "--color-team-blue-fill": a.fill, "--color-team-blue-bg": a.bg, "--color-team-blue-line": a.line, "--color-ink-on-team-blue": "#f4efe3",
    "--color-team-red": b.text, "--color-team-red-fill": b.fill, "--color-team-red-bg": b.bg, "--color-team-red-line": b.line, "--color-ink-on-team-red": "#f4efe3",
  };
}

// Contrast and colour-blindness, computed from the values above (not typed in).
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = hexRgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const mix = (fg, bg, a) => `#${hexRgb(fg).map((c, i) => Math.round(c * a + hexRgb(bg)[i] * (1 - a)).toString(16).padStart(2, "0")).join("")}`;
// Machado et al. (2009), severity 1.0, applied in linear RGB.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const delin = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)); };
export function simulate(h, kind) {
  const c = hexRgb(h).map(lin);
  const m = CVD[kind];
  return `#${m.map((row) => delin(row[0] * c[0] + row[1] * c[1] + row[2] * c[2]).toString(16).padStart(2, "0")).join("")}`;
}
function lab(h) {
  const [r, g, b] = hexRgb(h).map(lin);
  const xyz = [0.4124 * r + 0.3576 * g + 0.1805 * b, 0.2126 * r + 0.7152 * g + 0.0722 * b, 0.0193 * r + 0.1192 * g + 0.9505 * b];
  const n = [0.95047, 1, 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / n[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => { const [p, q] = [lab(a), lab(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

// ------------------------------------------------------------- page file ----

const kutCss = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";', "").replace("@theme inline {", ":root {");
const mwCss = fs.readFileSync(path.join(root, "design/midweek/build/midweek.css"), "utf8");
const uxCss = fs.readFileSync(path.join(root, "design/ux-review/build/ux.css"), "utf8");
const dr3Css = fs.readFileSync(path.join(here, "dr3.css"), "utf8");

/** theme: "after" (the proposal, every DR3 screen) or "before" (today's tokens, for comparison). */
export function dcFile({ title, body, theme = "after" }) {
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
  <!-- Generated by design/mm2-dr3/build/build.mjs from the real LiveCard, icons and
       globals.css in src/, design/ux-review/build, design/midweek/build and the
       sample data in design/midweek. Edit the generator, not this file. -->
  <style>
${kutCss}
${mwCss}
${uxCss}
${tokenCss(":root", TOKENS_AFTER)}
${tokenCss(".tc-before", TOKENS_BEFORE)}
${tokenCss(".tc-royal", TOKENS_ROYAL)}
${PAIRS.map((p) => tokenCss(`.tc-pair-${p.id}`, pairTokens(p))).join("\n")}
${dr3Css}
  </style>
</helmet>
<div class="tc-${theme}${theme.startsWith("pair-") ? " tc-pair" : ""}">
${body}
</div>
</x-dc>
</body>
</html>
`;
}

export { T, PLAYERS, YOU, card, mini, esc, icon, finalScore, archLabel, tierLabel, roundName, roundShort, roundStart, hhmm, fullTimeAt, mOf, mgr, baseName, playerOf, signedPct };
