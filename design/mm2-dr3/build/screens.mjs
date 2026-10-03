// Every DR3 mockup: one entry per screen and state. Each body is one responsive
// page that build.mjs renders at 320, 412 and 1440 px; the two share images
// are fixed 1080 x 1350 frames. `ctx.thumb(file)` is a small JPEG of an image
// artboard, made in the build's first pass, for the in-page previews.
import { React, renderToStaticMarkup, src } from "../../midweek/build/source.mjs";
import { slotRow, keeperCheck, seedLine } from "../../midweek/build/lib.mjs";
import {
  T, PLAYERS, YOU, card, mini, esc, icon, finalScore, archLabel, tierLabel, roundName, roundShort,
  roundStart, hhmm, fullTimeAt, mOf, PICK_COINS, ratingsOf, ratingList, whyListRated,
  matchRatingsFor, predictBlock, PREDICT_FOOT, weeklyLine, lineCount, lineCountShort, balanceOf, factorText,
  posterImage, myNightImage, TOKENS_BEFORE, TOKENS_AFTER, TOKENS_ROYAL, PAIRS, SIDE_COLOURS, contrast, mix, simulate, deltaE, NEED, PLUSSES,
} from "./lib.mjs";
import {
  at, hhmmss, seen, chrome, competeTabs, head, clock, colourNames, scoreboard, laneTimeline, latest,
  shootoutLive, whyList, mrow, entryOf, coinsFor,
} from "../../ux-review/build/lib.mjs";

const { LiveCard } = src("components/live-card.tsx");
const { ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");

// ------------------------------------------------------------- the evening --

const OUT = at("20:41:00");
const FINAL_LIVE = at("21:05:15");
const LIVE = at("20:18:20");
const R2 = mOf(2, 3); // Sanne v Eline
const QF = mOf(3, 1); // Sophie v Sanne, 2-2, 7-6 on pens
const SF1 = mOf(4, 0); // Niels v Sophie
const SF2 = mOf(4, 1); // Julia v Joris
const FINAL = mOf(5, 0); // Sophie v Joris
const RATED = mOf(1, 7); // Mila v Eline, 0-3: the same score in both samples
const PLAIN_FT = mOf(2, 5); // Bart v Fleur, 1-0

const yourNight = (rows, foot, link = "") => `<section class="ux-block" aria-labelledby="night-h"><div class="ux-block__h"><h2 class="display" id="night-h">Your night</h2>${link || `<p class="small faint">${foot}</p>`}</div><ol class="mw-path" aria-label="Your night">${rows}</ol>${link ? `<p class="small faint">${foot}</p>` : ""}</section>`;
const pathRow = (r, time, text, coins, kind = "won") => `<li class="mw-path__row${kind === "won" ? "" : ` mw-path__row--${kind}`}"><p class="mw-path__round">${roundShort(r)}<b>${time}</b></p><p class="mw-path__what">${text}</p><p class="mw-path__coins">${coins ?? (kind === "out" ? `<span class="chip chip--out">Out</span>` : "")}</p></li>`;
const sannePath = () =>
  pathRow(1, hhmm(roundStart(1)), "<b>Bye.</b> Counts as a win.", "+17") +
  pathRow(2, hhmm(roundStart(2)), `Beat ${R2.managers[1]} 1&ndash;0. <a class="link">Report</a>`, "+33") +
  pathRow(3, hhmm(roundStart(3)), `Out: lost to Sophie 2&ndash;2, 6&ndash;7 on penalties. <a class="link">Report</a>`, null, "out");
const roundRows = (r, state) => T.matches.filter((m) => m.round === r).map((m) => mrow(m, typeof state === "function" ? state(m) : state)).join("");
const evening = (now, body, { youThrough = 3, updated = true } = {}) =>
  chrome(`${clock(now, { youThrough, updated: updated ? now : null })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}${body}</div>`, { compete: "live" });
const finalCard = `<a class="ux-nowcard ux-nowcard--brass"><span class="kicker">The final &middot; ${hhmm(roundStart(5))}</span><h2 class="display">Everyone watches it live</h2><p class="small muted">Chance by chance, on this page.</p></a>`;

// ------------------------------------------------------------ predictions --

const feederText = (r, k) => {
  const f = mOf(r, k);
  return `Winner of ${f.managers.join(" v ")}`;
};
const sf = (m, k, extra) => ({
  label: `Semi-final ${k + 1}`, kickoff: roundStart(4), sides: [...m.managers], feeders: [feederText(3, 2 * k), feederText(3, 2 * k + 1)],
  winner: m.report.winnerSide, ...extra,
});
const fin = (extra) => ({ label: "The final", kickoff: roundStart(5), sides: [...FINAL.managers], feeders: [feederText(4, 0), feederText(4, 1)], winner: FINAL.report.winnerSide, ...extra });
const notYetFinal = fin({ state: "notyet", sides: [null, null] });
const SPLIT = { sf1: [7, 4], sf2: [2, 10], final: [6, 9] };
// Sanne's calls: Sophie in SF1 (right), Joris in SF2 (right), Sophie in the final (not this time).
const CALLS = { picks: 3, correct: 2 };

// ---------------------------------------------------------------- reports --

function matchPage(m, now, { kicker, mode, ratings = null, why = null }) {
  const live = mode === "live";
  const v = now ? seen(m, now) : null;
  const top = `<div style="display:grid;gap:12px">
    <a class="back">&larr; Wed 7 Oct bracket</a>
    <p class="kicker">${kicker}</p>
    ${mode === "ft" ? `<h1 class="display ux-headline">${colourNames(m.report.headline, m)}</h1>` : ""}
  </div>`;
  const sb = scoreboard(m, { now: live ? now : null });
  const story = `${mode === "ft" ? `<ul class="ux-facts">${m.report.facts.map((f) => `<li>${colourNames(f.text, m)}</li>`).join("")}</ul>` : ""}
       <section class="sec" aria-labelledby="tl-h"><div class="sec__h"><h2 class="display h2" id="tl-h">How it went</h2>${live ? `<p class="small faint">A new chance every 20 seconds</p>` : ""}</div>${laneTimeline(m, live ? v.events : m.report.timeline, { newest: live })}</section>
       ${m.report.shootout && (!live || v.kicks.length) ? shootoutLive(m, live ? now : null) : ""}
       ${mode === "ft" && m.report.shootout ? `<ol class="mw-so__lines" style="display:grid;gap:6px">${m.report.shootout.lines.map((l) => `<li>${colourNames(l, m)}</li>`).join("")}</ol>` : ""}`;
  const whyHtml = why ?? (ratings ? whyListRated(m, ratings) : whyList(m, { stats: mode === "ft" }));
  return `<div class="wrap">${top}${sb}<div class="ux-report ux-report--split"><div class="ux-report">${story}</div>${whyHtml}</div>${live ? `<p class="ux-upd">Updated ${hhmmss(now)} &middot; checks for new chances every 20 seconds</p>` : ""}</div>`;
}
const matchScreen = (m, now, opts) =>
  now ? chrome(`${clock(now, { youThrough: opts.youThrough ?? 5 })}<div style="margin-top:20px">${matchPage(m, now, opts)}</div>`, { compete: "live" }) : chrome(matchPage(m, now, opts));

// ----------------------------------------------------------------- sharing --

const JORIS = ratingsOf("Joris");
const SANNE = ratingsOf(YOU);
const PHOTO_IN = ["Noor E.", "Bas V."]; // one Player with a photo in each image; the rest show the shirt back
const sanneBest = [...SANNE.five].sort((a, b) => b.rating - a.rating)[0];
const totalGoals = T.matches.reduce((a, m) => a + finalScore(m)[0] + finalScore(m)[1], 0);
const posterData = () => ({
  champion: FINAL.managers[1],
  final: `Beat ${FINAL.managers[0]} on penalties in the final, ${finalScore(FINAL).join("&ndash;")} and ${FINAL.report.shootout.score[1]}&ndash;${FINAL.report.shootout.score[0]} from the spot.`,
  five: JORIS.five,
  photo: PHOTO_IN,
  path: [["Round 1", "Bye"], ["Round 2", `7&ndash;0 Emma`], ["Quarters", `4&ndash;0 Wessel`], ["Semis", `1&ndash;0 Julia`], ["Final", `1&ndash;1, 5&ndash;4 pens Sophie`]],
  stats: `${T.entries.length} entrants &middot; ${totalGoals} goals`,
});
const nightData = () => ({
  manager: YOU, finish: "Quarter-finals", coins: coinsFor(YOU) + CALLS.correct * PICK_COINS,
  path: [["Round 1", "Bye"], ["Round 2", "Beat Eline 1&ndash;0"], ["Quarters", "Lost to Sophie on pens, 6&ndash;7", "out"]],
  five: SANNE.five, photo: PHOTO_IN, best: sanneBest,
  called: `Called ${CALLS.correct} of ${CALLS.picks} &middot; Joris won it`,
});

const SHARE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
const DL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
/** MidweekShare: a preview of each image and one button each. Share on phones, Download on desktop. */
function shareBlock(ctx, { done = false } = {}) {
  const item = (file, title, sub, name) => `<figure class="r3-shot">
    <img alt="${esc(`Preview: ${title}`)}" src="${ctx.thumb(file)}">
    <figcaption><b>${title}</b><small>${sub}</small></figcaption>
    <span class="btn btn--primary btn--small r3-touch">${SHARE_ICON}Share</span>
    <a class="r3-save r3-touch">Save image</a>
    <span class="btn btn--secondary btn--small r3-desk">${DL_ICON}${done && name === "night" ? "Downloaded" : "Download"}</span>
    ${done && name === "night" ? `<p class="r3-done r3-desk" role="status">&#10003; kut-midweek-7-oct-sanne.png is in your downloads. Drop it into the group chat.</p>` : ""}
  </figure>`;
  return `<section class="ux-block r3-share" aria-labelledby="share-h">
  <div class="ux-block__h"><h2 class="display" id="share-h">Share the night</h2><p class="small faint">Images for the club&rsquo;s group chat</p></div>
  <div class="r3-share__items">
    ${item("Share-Poster.dc.html", "The champion poster", `${FINAL.managers[1]}, the final and the five`, "poster")}
    ${item("Share-MyNight.dc.html", "Your night", "Your path, your five and their ratings", "night")}
  </div>
  <p class="r3-share__note">Both show managers&rsquo; and Players&rsquo; names and Players&rsquo; photos. Send them to the club; they&rsquo;re made on your phone, nothing is uploaded.</p>
</section>`;
}
function shareSheet(ctx) {
  return `<div class="r3-sheetwrap" aria-hidden="true"><p class="r3-sheet__lbl"><span class="r3-state">The phone&rsquo;s own share sheet, not KUT&rsquo;s</span></p><div class="r3-sheet">
    <span class="r3-sheet__grab"></span>
    <div class="r3-sheet__file"><img alt="" src="${ctx.thumb("Share-MyNight.dc.html")}"><span><b>kut-midweek-7-oct-sanne.png</b><small>Image &middot; 1080 &times; 1350</small></span></div>
    <div class="r3-sheet__apps"><span><i style="background:#25a35a">W</i>WhatsApp</span><span><i style="background:#3d7be0">M</i>Messages</span><span><i style="background:#6b6a66">&darr;</i>Save image</span><span><i style="background:#9a9892">&middot;&middot;&middot;</i>More</span></div>
  </div></div>`;
}

// -------------------------------------------------------- the champion view --

function championView(ctx, { extra = "" } = {}) {
  const coins = coinsFor(YOU);
  const calls = CALLS.correct * PICK_COINS;
  return chrome(`<div class="wrap">${competeTabs("midweek")}
      <section class="mw-champ panel panel--brass" style="display:grid;gap:14px"><p class="kicker">Midweek Madness &middot; Wed 7 Oct &middot; Champion</p><h1 class="display" style="font-size:44px">${FINAL.managers[1]}</h1>
        <p class="muted">Beat ${FINAL.managers[0]} on penalties in the final, ${finalScore(FINAL).join("&ndash;")} and ${FINAL.report.shootout.score[1]}&ndash;${FINAL.report.shootout.score[0]} from the spot. ${coinsFor("Joris")} KUT Coins over the night. <a class="link">Report &rarr;</a></p>
        <div class="ux-risers">${entryOf("Joris").cards.filter((c) => !c.trialist).map((c) => card(c.name.replace(/ \([^)]*\)$/, ""))).join("")}</div></section>
      <dl class="mw-stats"><div><dt>You</dt><dd>+${coins + calls}<span class="r3-unit">KUT</span><small>${coins} for wins, ${calls} for calls</small></dd></div><div><dt>Your finish</dt><dd>Quarters<small>out on penalties</small></dd></div><div><dt>Entrants</dt><dd>${T.entries.length}<small>${T.entries.filter((e) => e.auto).length} auto squads</small></dd></div><div><dt>Goals</dt><dd>${totalGoals}<small>in ${T.matches.length} matches</small></dd></div></dl>
      ${yourNight(sannePath(), "paid to your wallet", `<a class="link">Bracket and picks &rarr;</a>`)}
      <p class="r3-weekly"><b>${weeklyLine(CALLS.correct, CALLS.picks)}</b><a class="link">Your calls &rarr;</a></p>
      ${ratingList(YOU)}
      ${shareBlock(ctx)}
      <a class="panel" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><span><b>Next Wednesday is open.</b> <span class="muted">Pick your five for Wed 14 Oct. Locks at 19:55.</span></span><span class="link">&rarr;</span></a>
      <p><a class="link">Past weeks &rarr;</a></p>
      ${seedLine({ seed: T.seed })}${extra}</div>`);
}

// ----------------------------------------------------------------- bracket --

const callChip = (text, kind = "") => `<span class="r3-callchip${kind ? ` r3-callchip--${kind}` : ""}">${text}</span>`;
function bracketComplete(ctx) {
  const rows = (r) => T.matches.filter((m) => m.round === r).map((m) => mrow(m, "ft")).join("");
  const calls = [
    [SF1, "Semi-final 1", "Sophie", true], [SF2, "Semi-final 2", "Joris", true], [FINAL, "The final", "Sophie", false],
  ];
  return chrome(`<div class="wrap">${competeTabs("midweek")}${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The bracket", back: "Midweek Madness" })}
    <p class="r3-weekly"><span><b>Joris won it.</b> <span class="muted">${T.entries.length} entrants. You: quarter-finals, +${coinsFor(YOU) + CALLS.correct * PICK_COINS} KUT Coins.</span></span></p>
    <nav class="ux-jump" aria-label="Jump to"><a class="you">Your ratings</a><a>Your calls</a>${Array.from({ length: T.rounds }, (_, i) => `<a>${roundShort(i + 1)}</a>`).join("")}</nav>
    ${ratingList(YOU, { open: true })}
    <section class="ux-block" aria-labelledby="calls-h"><div class="ux-block__h"><h2 class="display" id="calls-h">Your calls</h2><p class="small faint">${weeklyLine(CALLS.correct, CALLS.picks)}</p></div>
      <ul class="r3-calls">${calls.map(([m, l, pick, ok]) => `<li><span class="r3-calls__k">${l}</span><span>You picked <b>${pick}</b>. ${m.managers[m.report.winnerSide]} won.</span>${ok ? `<span class="r3-called">&#10003; +${PICK_COINS}</span>` : `<span class="r3-missed">Not this time</span>`}</li>`).join("")}</ul></section>
    ${shareBlock(ctx)}
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(5)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(5))}</p></div><div class="ux-rows">${rows(5)}</div></section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(4)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(4))}</p></div><div class="ux-rows ux-rows--2">${rows(4)}</div></section>
    <p class="r3-note">Below this, unchanged from DR2 and the shipped page: the earlier rounds (or the tree from lg), pick shares and the seal.</p>
  </div>`);
}

/** The bracket while you're out: your calls on the rows, picking stays on the evening page. */
function bracketCalls() {
  const sfRow = (m, k, chip) => {
    const row = mrow(m, "upcoming");
    return row.replace(/<\/div><span class="ux-mrow__state">/, `<p class="r3-mrow__call">${chip}</p></div><span class="ux-mrow__state">`);
  };
  return chrome(`${clock(OUT, { youThrough: 3, updated: OUT })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The bracket", back: "Midweek Madness" })}
    <nav class="ux-jump" aria-label="Jump to"><a class="you">Call the semis &middot; 1 open</a>${Array.from({ length: T.rounds }, (_, i) => `<a>${roundShort(i + 1)}</a>`).join("")}</nav>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(4)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(4))}</p></div>
      <div class="ux-rows ux-rows--2">${sfRow(SF1, 0, callChip("&#10003; Your call: Sophie"))}${sfRow(SF2, 1, `${callChip("Open to call")}<a class="link small">Call it &rarr;</a>`)}</div></section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(3)}</h2><p class="small faint">Kick-off ${hhmm(roundStart(3))}</p></div><div class="ux-rows ux-rows--2">${roundRows(3, "ft")}</div></section>
    <p class="r3-note">Below this, unchanged from DR2: rounds 1 and 2, and the tree from lg (its semi-final boxes carry the same chip).</p>
  </div>`, { compete: "live" });
}

// ----------------------------------------------------------------- picker --
// Sanne's collection for the plusses mocks: her real five (All-rounders) plus
// twelve Players with archetypes set here. Players in the champion's five or
// hers keep their sample archetypes, because the share images show them.

const FIVE = ["Dirk S.", "Mo A.", "Gijs H.", "Iris W.", "Bas V."];
const keep = new Set([...FIVE, ...JORIS.five.map((c) => c.name)]);
const EXTRA_ARCH = ["goalkeeper", "goalkeeper", "goalkeeper", "speedster", "finisher", "defender", "playmaker", "tank", "all_rounder", "all_rounder", "speedster", "all_rounder"];
const extras = [...PLAYERS.values()].filter((p) => !keep.has(p.displayName)).sort((a, b) => b.ovr - a.ovr).slice(0, 12);
extras.forEach((p, i) => { p.archetype = EXTRA_ARCH[i]; p.injured = false; });
const COLLECTION = [...extras.map((p) => p.displayName), ...FIVE];
const byArch = (a, n = 0) => extras.filter((p) => p.archetype === a)[n].displayName;
const archOf = (name) => PLAYERS.get(name).archetype;

const lockLine = (countdown) => `<p class="ux-lock">Squads lock <b>Wed 7 Oct, 19:55</b> <span class="cd">in ${countdown}</span></p>`;
const privacy = `<p class="mw-privacy">${icon("IconInfo")}<span>From 19:55 on Wednesday, members see the five cards you enter, never the rest of your collection. Your cards are never at stake: a result only pays coins.</span></p>`;
function saveBar(kind, outfield, keeper) {
  const st = {
    dirty: ["dirty", "Unsaved changes", "Nothing counts until you save."],
    saved: ["saved", "Saved Tue 6 Oct, 14:02", "Change it as often as you like until Wed 7 Oct, 19:55."],
  }[kind];
  const act = kind === "saved" ? `<span class="btn btn--secondary btn--small">Change your five</span>` : `<span class="btn btn--secondary btn--small">Load last week&rsquo;s five</span><span class="btn btn--primary btn--small">Save your five</span>`;
  return `<div class="ux-savebar${kind === "dirty" ? " ux-savebar--sticky" : ""}"><div class="ux-savebar__st">${`<p class="mw-status mw-status--${st[0]}" role="status"><i aria-hidden="true"></i>${st[1]}</p>`}<small>${st[2]}</small></div><div class="ux-savebar__act">${act}</div>${kind === "dirty" ? `<p class="r3-savebar__lines">${lineCountShort(outfield, keeper)}</p>` : ""}</div>`;
}
function pickRow(name, inFive) {
  const p = PLAYERS.get(name);
  const pl = PLUSSES[p.archetype];
  const btn = inFive ? `<span class="chip chip--won">&#10003; In</span>` : `<span class="btn btn--secondary btn--small">Add</span>`;
  return `<li class="ux-pick${inFive ? " ux-pick--in" : ""}">${mini(name)}<div><p class="ux-pick__name">${esc(p.displayName)}</p><p class="ux-pick__meta">${archLabel(p.archetype)} &middot; ${tierLabel(p.rarity)} &middot; OVR ${p.ovr}</p><p class="r3-pl" aria-label="${esc(`Plusses: attack ${pl[0]}, midfield ${pl[1]}, defence ${pl[2]}`)}"><span>A ${"+".repeat(pl[0]) || "&ndash;"}</span><span>M ${"+".repeat(pl[1]) || "&ndash;"}</span><span>D ${"+".repeat(pl[2]) || "&ndash;"}</span></p></div>${btn}</li>`;
}
function cardFace(name) {
  const p = PLAYERS.get(name);
  const off = ARCHETYPE_OFFSETS[p.archetype];
  const s = (k) => Math.max(1, Math.min(99, p.ovr + off[k]));
  return renderToStaticMarkup(React.createElement(LiveCard, { size: "grid", player: { id: p.id, injured: false, displayName: p.displayName, archetype: p.archetype, liveOvr: p.ovr, rarityTier: p.rarity, pac: s("pac"), sho: s("sho"), pas: s("pas"), dri: s("dri"), def: s("def"), phy: s("phy") } }));
}
function sheet(names) {
  return `<ol class="mw-sheet" aria-label="Your five">${names.map((n, i) => `<li class="mw-sheet__slot"><p class="mw-sheet__cap"><span>Slot ${i + 1}</span><span class="icon-btn" aria-label="Remove ${esc(n)} from slot ${i + 1}">&#10005;</span></p>${cardFace(n)}</li>`).join("")}</ol>`;
}
function picker({ five, bar, keeper, countdown = "1 day, 4 h" }) {
  // The card in goal is left out; with several Goalkeepers, any one of them (all are 0/0/3).
  const outfield = keeper ? five.filter((n, i) => i !== five.indexOf(keeper.name)).map(archOf) : [];
  return chrome(`<div class="wrap">
  ${competeTabs("midweek")}
  <div style="display:grid;gap:10px">${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "Pick your five" })}${lockLine(countdown)}</div>
  <section class="sec" aria-labelledby="five-h">
    <div class="sec__h"><h2 class="display h2" id="five-h">Your five</h2></div>
    <ol class="mw-slots mw-slots--rows">${five.map((n, i) => slotRow(i + 1, n)).join("")}</ol>
    ${sheet(five)}
    ${keeperCheck(five)}
    ${lineCount(outfield, keeper)}
    ${saveBar(bar, outfield, keeper)}
    ${privacy}
  </section>
  <section class="sec" aria-labelledby="cards-h">
    <div class="sec__h"><h2 class="display h2" id="cards-h">Your cards</h2><p class="small faint">One slot per Player. Where you own two copies, the stronger one plays.</p></div>
    <ul class="ux-picks">${COLLECTION.slice(0, 8).map((n) => pickRow(n, five.includes(n))).join("")}</ul>
    <p class="r3-note">From lg the LiveCard grid as approved in DR2; each card face already shows its archetype, and the list rows gain the plusses line.</p>
  </section>
</div>`, { compete: bar === "saved" ? null : "pick" });
}
const BALANCED = [byArch("goalkeeper"), byArch("speedster"), byArch("finisher"), byArch("defender"), byArch("all_rounder")];
const ONE_SHORT = [byArch("goalkeeper"), byArch("speedster"), byArch("finisher"), byArch("all_rounder"), byArch("all_rounder", 1)];
const NO_KEEPER = [byArch("speedster"), byArch("finisher"), byArch("defender"), byArch("all_rounder"), byArch("all_rounder", 1)];
const TWO_SHORT = [byArch("goalkeeper"), byArch("goalkeeper", 1), byArch("goalkeeper", 2), byArch("all_rounder"), byArch("all_rounder", 1)];

// ---------------------------------------------------------- colours board --

function tokensBoard() {
  const board = "#15130f", panel = "#211c15", panel2 = "#2a2318";
  const sw = (name, v, use, checks) => `<div class="r3-sw"><span class="r3-sw__chip" style="background:${v}"></span><b><code>${name}</code> ${v}</b><small>${use}${checks ? `<br>${checks}` : ""}</small></div>`;
  const ratio = (a, b) => contrast(a, b).toFixed(2);
  const textChecks = (c, bg) => `${ratio(c, board)}:1 board &middot; ${ratio(c, panel)}:1 panel &middot; ${ratio(c, panel2)}:1 panel-2 &middot; ${ratio(c, mix(bg, board, 0.55))}:1 its lane`;
  const fillChecks = (c, bg, on) => `${ratio(c, board)}:1 board &middot; ${ratio(c, panel)}:1 panel &middot; ${ratio(c, mix(bg, board, 0.55))}:1 its lane &middot; text on it ${ratio(on, c)}:1`;
  const A = TOKENS_AFTER;
  const B = TOKENS_BEFORE;
  const G = TOKENS_ROYAL;
  const cvd = (label, a, b) => {
    const row = (kind) => {
      const [x, y] = kind ? [simulate(a, kind), simulate(b, kind)] : [a, b];
      return `<div class="r3-cvd__row"><span>${kind ?? "Typical"} &middot; &Delta;E ${deltaE(x, y).toFixed(0)}</span><span style="background:${x};color:${contrast(x, "#f4efe3") > 3 ? "#f4efe3" : "#15130f"}">Sanne</span><span style="background:${y};color:${contrast(y, "#f4efe3") > 3 ? "#f4efe3" : "#15130f"}">Eline</span></div>`;
    };
    return `<div class="r3-cvd"><p class="kicker kicker--faint">${label}</p>${row(null)}${row("deuteranopia")}${row("protanopia")}</div>`;
  };
  const side = (T, n, what, isNew) => {
    const k = n ? "red" : "blue";
    const t = (x) => T[`--color-team-${k}${x}`];
    return `
      ${sw(`--color-team-${k}`, t(""), `Side ${n} text, ${what}: names, score digits, side headings.`, textChecks(t(""), t("-bg")))}
      ${sw(`--color-team-${k}-fill`, t("-fill"), `${isNew ? "New. " : ""}Side ${n} fill, ${what}: rail, chance bar, penalty dot, strip.`, fillChecks(t("-fill"), t("-bg"), T[`--color-ink-on-team-${k}`]))}
      ${sw(`--color-team-${k}-bg / -line`, t("-bg"), `Side ${n} lane tint (55%) and five panel; border ${t("-line")}.`, "")}`;
  };
  const near = (c, h) => deltaE(c, h).toFixed(0);
  return `<div class="wrap r3-tok">
    ${head({ kicker: "Team colours &middot; DR3, round 3", title: "Violet and teal" })}
    <p class="muted">Chosen by the owner on 3 Oct: <b>violet</b> for side 0 and <b>teal</b> for side 1, two jewel tones that keep clear of the brass, moss and brick KUT already uses. Round 2&rsquo;s royal blue stays below for comparison. Each side has a text tone for names and numbers and a deep fill for everything drawn; Live keeps its pink on its own tokens. Every ratio below is computed from the values, not typed in.</p>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Violet, side 0</h2></div><div class="r3-tok__grid">${side(A, 0, "violet", true)}</div>
      <p class="small faint">The violet fill is ${ratio(A["--color-team-blue-fill"], board)}:1 on the board, just under 3:1, within the stretch the owner allowed. Nothing depends on it alone: the name, the lane&rsquo;s side, the percentages under the chance bar and the ✓ / ✕ on each penalty dot carry it.</p></section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Teal, side 1</h2></div><div class="r3-tok__grid">${side(A, 1, "teal", true)}
      ${sw("--color-ink-on-team-blue / -red", A["--color-ink-on-team-red"], "Light ink: the ✓ and ✕ on a deep penalty dot.", "")}
      ${sw("--color-live", A["--color-live"], "Unchanged pink, on its own tokens: the Live marker, the clock&rsquo;s live stop, the Compete badge.", `New <code>--color-live-bg</code> ${A["--color-live-bg"]} and <code>--color-live-line</code> ${A["--color-live-line"]}.`)}</div>
      <p class="small faint">Neither side is blue or red any more, so the tokens get side-neutral names when this is built: <code>--color-team-0*</code> for violet and <code>--color-team-1*</code> for teal. The mocks keep the old names.</p></section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Royal blue, round 2&rsquo;s choice</h2></div><div class="r3-tok__grid">${side(G, 0, "royal blue", false)}</div></section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Red&ndash;green colour blindness</h2></div>
      <div class="r3-trio">${cvd("Today, text", B["--color-team-blue"], B["--color-team-red"])}${cvd("Violet and teal, text", A["--color-team-blue"], A["--color-team-red"])}${cvd("Royal and teal, text", G["--color-team-blue"], G["--color-team-red"])}</div>
      <div class="r3-trio">${cvd("Today, fill", B["--color-team-blue-fill"], B["--color-team-red-fill"])}${cvd("Violet and teal, fill", A["--color-team-blue-fill"], A["--color-team-red-fill"])}${cvd("Royal and teal, fill", G["--color-team-blue-fill"], G["--color-team-red-fill"])}</div>
      <p class="small faint">Simulated with Machado et al. (2009) at full severity. With typical vision violet and teal differ in hue; deuteranopes tell them apart mainly by lightness, as they did royal and teal. Side, names and the sr-only sentences carry it too.</p>
    </section>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Kept apart</h2></div>
      <p style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><span class="tn tn--b">Sanne</span><span class="tn tn--r">Eline</span><span class="ux-live">Live</span><span class="chip chip--out">Out</span><span class="chip chip--won">&#10003; Through</span><span class="ux-wl__row ux-pw--1" style="display:inline-grid;border:0;padding:0"><span class="ux-wl__pw" style="padding:4px 8px">0.86</span></span><span class="ux-wl__row ux-pw--4" style="display:inline-grid;border:0;padding:0"><span class="ux-wl__pw" style="padding:4px 8px">1.19</span></span><span class="r3-rt r3-rt--sm"><b>7.5</b></span></p>
      <p class="small faint">Violet (hue about 300&deg;) has no neighbour on the board: the nearest are the steel grey-blue (&Delta;E ${near(A["--color-team-blue"], "#8fb0c2")}) and Live&rsquo;s pink (&Delta;E ${near(A["--color-team-blue"], A["--color-live"])}). Teal (about 175&deg;) keeps clear of the moss Through chip (&Delta;E ${near(A["--color-team-red"], "#8bbd6c")}) and the strong-Power band; Live&rsquo;s pink is far lighter and brighter than either side; ratings are never tinted.</p>
    </section>
  </div>`;
}

function elsewhere() {
  const R2live = `<section class="ux-block"><div class="ux-block__h"><h2 class="display">Your match</h2><a class="link">Watch it &rarr;</a></div>${scoreboard(R2, { now: LIVE })}${latest(R2, LIVE)}</section>`;
  const finalLive = `<section class="ux-block"><div class="ux-block__h"><h2 class="display">The final</h2><a class="link">Watch it &rarr;</a></div>${scoreboard(FINAL, { now: FINAL_LIVE })}${shootoutLive(FINAL, FINAL_LIVE)}</section>`;
  const v = seen(R2, LIVE);
  const e = v.events[v.events.length - 1];
  const home = `<a class="ux-nowcard ux-nowcard--live"><div class="ux-nowcard__top"><span class="kicker">Midweek Madness &middot; ${roundName(2)}</span><span class="ux-live">Live</span></div>${scoreboard(R2, { now: LIVE, mini: true })}<p class="small muted">${e.minute}&prime; ${colourNames(e.text, R2)}</p><span class="btn btn--primary">Watch your match</span></a>`;
  return chrome(`${clock(LIVE, { youThrough: 5, updated: LIVE })}<div class="wrap" style="margin-top:20px">${competeTabs("midweek", { live: true })}
    <p class="r3-note">Every other place the team and Live tokens reach: the evening&rsquo;s single-match blocks (DR2-1), Home&rsquo;s live card, the clock&rsquo;s live stop, the Compete badge and the Live chip.</p>
    <div class="ux-two">${R2live}${finalLive}</div>
    <section class="ux-block"><div class="ux-block__h"><h2 class="display">Home</h2></div>${home}</section>
  </div>`, { compete: "live" });
}

// ---------------------------------------------------------------- screens --

const THEMES = [["before", "Before", "today's colours"], ["after", "Violet", "violet and teal (chosen)"], ["royal", "Royal", "royal blue and teal (round 2's choice)"]];
const THEME_RULE = {
  before: "Today: --color-team-blue #7cb0ff, --color-team-red #ff8091",
  after: "Chosen (owner, 3 Oct): violet and teal; text tones for names and digits, deep fills for rails, bar, dots, strip",
  royal: "Round 2's choice, for comparison: royal blue and teal",
};

// ------------------------------------------------------------ colour pairs --
// Round 3 (owner, 3 Oct): "What if you let go of the blue?" Two-colour pairs,
// each side a text tone (AA) and a deep fill, scored for red-green colour
// blindness and kept away from the colours KUT already uses.

function pairsBoard() {
  const board = "#15130f", panel2 = "#2a2318";
  const RESERVED = { brass: "#e0ac4a", moss: "#8bbd6c", brick: "#dd7a55", "Power band 3": "#c3d27c", steel: "#8fb0c2", Live: "#ff8091" };
  const worst = (x, y) => ["", "deuteranopia", "protanopia"].map((k) => deltaE(k ? simulate(x, k) : x, k ? simulate(y, k) : y).toFixed(0)).join(" / ");
  const nearest = (c) => { const [k, v] = Object.entries(RESERVED).map(([n, h]) => [n, deltaE(c, h)]).sort((p, q) => p[1] - q[1])[0]; return `${k} &Delta;E ${v.toFixed(0)}`; };
  const chip = (c, label) => `<span style="display:inline-grid;place-items:center;min-width:64px;height:30px;padding:0 10px;border-radius:8px;background:${c};color:#f4efe3;font-size:12px;font-weight:800">${label}</span>`;
  const rows = PAIRS.map((p) => {
    const [a, b] = p.sides.map((k) => SIDE_COLOURS[k]);
    return `<div class="r3-pairrow">
      <p class="r3-pairrow__h"><b>${p.label}</b></p>
      <p class="r3-pairrow__sw"><span class="tn" style="color:${a.text}">Sanne</span> <span class="tn" style="color:${b.text}">Eline</span> ${chip(a.fill, a.name)} ${chip(b.fill, b.name)}</p>
      <p class="small faint">Text ${a.text} / ${b.text}: ${contrast(a.text, panel2).toFixed(1)} and ${contrast(b.text, panel2).toFixed(1)}:1 on panel-2. Fills ${a.fill} / ${b.fill}: ${contrast(a.fill, board).toFixed(1)} and ${contrast(b.fill, board).toFixed(1)}:1 on the board. Telling the sides apart (&Delta;E typical / deuteranopia / protanopia): text ${worst(a.text, b.text)}, fill ${worst(a.fill, b.fill)}. Nearest colour already in KUT: ${nearest(a.text)}, ${nearest(b.text)}.</p>
    </div>`;
  }).join("");
  return `<div class="wrap r3-tok">
    ${head({ kicker: "Team colours &middot; DR3, round 3", title: "Pairs without the blue" })}
    <p class="muted">Every hue was tried as a text tone that passes AA on the darkest panel at a moderate, classy saturation, with a deep fill of the same hue. Most warm hues are already KUT&rsquo;s: brass, brick, the orange weak-Power band, warning amber and Live pink, so a side colour there would read as one of those. The pairs colour-blind members tell apart best lie on the blue&ndash;yellow axis: an olive against an indigo or a violet. Teal with plum or petrol looked good but fell apart for deuteranopes (&Delta;E 18 and 2), so they are not shown. Today&rsquo;s blue and pink scored 74 / 66 / 46. The owner chose violet and teal.</p>
    <div class="r3-pairs">${rows}</div>
  </div>`;
}

export const PAGES = [
  { id: "ratings", name: "Ratings" },
  { id: "predictions", name: "Predictions" },
  { id: "share", name: "The shareable result" },
  { id: "picker", name: "The picker's plusses count" },
  { id: "colours", name: "Deeper team colours" },
  { id: "pairs", name: "Colour pairs without the blue" },
];

const outBody = (cards, opts = {}) => predictBlock(cards, { foot: PREDICT_FOOT, ...opts });
const stateItem = (label, html) => `<div class="r3-board__item"><p><span class="r3-state">${label}</span></p>${html}</div>`;

export const SCREENS = [
  // ---------------------------------------------------------------- share images (first: the rest preview them)
  {
    file: "Share-Poster.dc.html", page: "share", route: "image", state: "the champion poster, 1080 × 1350", image: true,
    rule: "Owner Q4: a champion poster anyone may share; names and photos allowed (F8's ADR)",
    note: "Drawn on a <canvas> at 1080 x 1350 (4:5). Every size here is canvas px. Noor E. has a photo (an illustration stands in for a real one); the others show LiveCard's shirt back. The circle under each card is its night rating (ratings sample, so it replays the same world on today's engine; the path and final are the DR2 story).",
    body: () => posterImage(posterData()),
  },
  {
    file: "Share-MyNight.dc.html", page: "share", route: "image", state: "my night, 1080 × 1350", image: true,
    rule: "Owner Q4: 'my night', your own five and path, with your five's night ratings",
    note: "Sanne's path, her coins (wins + calls), her five with night ratings, and the best card's line exactly as the ratings function wrote it. Bas V. has a photo; the others the shirt back. A line never mocks a card, so a low night just shows its number.",
    body: () => myNightImage(nightData()),
  },
  // ---------------------------------------------------------------- ratings
  {
    file: "Evening-Champion.dc.html", page: "ratings", route: "/midweek", state: "21:08, the week complete",
    rule: "ADR-117 ratings once complete; ADR-118 weekly line; Q4 share; DR2 champion view",
    note: "The DR2 placeholders are filled: 'Your five's ratings' best first, each with its line and a neutral circle (never tinted, so it can't be read as Power); the weekly calls line under Your night; and the share block with both previews. 'You' now adds wins and calls. Below lg one row per card; from lg the five LiveCards.",
    body: (ctx) => championView(ctx),
  },
  {
    file: "Bracket-Complete.dc.html", page: "ratings", route: "/midweek/2026-10-05", state: "the week's bracket once complete",
    rule: "Ratings outlive Thursday: the bracket keeps them; Show each match opened",
    note: "The champion view leads only until Thursday 23:59 (D4); the week's bracket keeps your ratings for good. Here 'Show each match' is open: each card's match ratings, each a link to that match's report. Your calls and the share block sit here too.",
    body: (ctx) => bracketComplete(ctx),
  },
  {
    file: "Match-Rated.dc.html", page: "ratings", route: "/midweek/2026-10-05/match/[id]", state: "a report after the week is complete",
    rule: "ADR-117 per-match ratings in MidweekWhyList, apart from the Power pill",
    note: "Mila v Eline, 0-3 in both samples. Each card's rating for this match sits on the right as the same neutral circle; Power keeps its tinted pill on the left. A key above the list names both. Until the week is complete the column isn't there (DR2's list unchanged).",
    body: () => matchScreen(RATED, null, { kicker: `${roundName(1)}, match 8 &middot; full time ${hhmm(fullTimeAt(RATED))}`, mode: "ft", ratings: matchRatingsFor(RATED) }),
  },
  // ---------------------------------------------------------------- predictions
  {
    file: "Evening-Out.dc.html", page: "predictions", route: "/midweek", state: "20:41, out, the semi-finals open",
    rule: "ADR-118: only members who are out; open once both feeders have ended; change until kick-off",
    note: "Replaces the DR2 placeholder. Semi-final 1 is called and saved; semi-final 2 is open with no pick; the final opens when both semi-finals have ended. A tap saves at once (no submit). Cards are neutral: they list matches (DR2-1).",
    body: () =>
      evening(OUT, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "You&rsquo;re out" })}
      <div class="ux-two">
        ${yourNight(sannePath(), `+${coinsFor(YOU)} &middot; paid after the final`)}
        <div style="display:grid;gap:14px">${outBody([sf(SF1, 0, { state: "saved", pick: 1, savedAt: "20:38" }), sf(SF2, 1, { state: "open", pick: null }), notYetFinal])}${finalCard}</div>
      </div>
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">${roundName(3)}</h2><a class="link">Full bracket &rarr;</a></div><div class="ux-rows ux-rows--2">${roundRows(3, "ft")}</div></section>`),
  },
  {
    file: "Predict-States.dc.html", page: "predictions", route: "/midweek", state: "every state of a call",
    rule: "ADR-118 Part L #28: open, change, close at kick-off; split from kick-off; own picks only",
    note: "The block in each state, top to bottom: nothing open yet (Laura at 20:35, out while both other quarter-finals are still in their shoot-outs), open, saving, saved, changed, a refused save, closed at kick-off with the club's split, the final open, resolving, and the weekly line once the week is complete. Blue-grey labels are design notes, not app copy.",
    body: () =>
      chrome(`<div class="wrap wrap--read r3-board">
        ${stateItem("Out, nothing open yet · Laura, 20:35", predictBlock([sf(SF1, 0, { state: "notyet", sides: [SF1.managers[0], null] }), sf(SF2, 1, { state: "notyet", sides: [null, SF2.managers[1]] }), notYetFinal], { note: "Nothing to call yet" }))}
        ${stateItem("A round open, no pick", predictBlock([sf(SF1, 0, { state: "open", pick: null })]))}
        ${stateItem("Saving (a tap saves at once)", predictBlock([sf(SF1, 0, { state: "saving", pick: 1 })]))}
        ${stateItem("Saved", predictBlock([sf(SF1, 0, { state: "saved", pick: 1, savedAt: "20:38" })]))}
        ${stateItem("Changed", predictBlock([sf(SF1, 0, { state: "changed", pick: 0, savedAt: "20:39" })]))}
        ${stateItem("Cleared (tapped the pick again)", predictBlock([sf(SF1, 0, { state: "cleared", pick: null })]))}
        ${stateItem("Refused (e.g. the kick-off passed while the page sat open)", predictBlock([sf(SF1, 0, { state: "saved", pick: 1, savedAt: "20:38", error: "Couldn&rsquo;t change it: picks closed at kick-off, 20:45. Your pick stays Sophie." })]))}
        ${stateItem("Closed at kick-off, the club's split", predictBlock([sf(SF1, 0, { state: "closed", pick: 1, split: SPLIT.sf1, live: true }), sf(SF2, 1, { state: "closed", pick: null, split: SPLIT.sf2 })], { title: "Your calls", note: "1 called &middot; the final opens next" }))}
        ${stateItem("The final open, semi-finals resolved · 20:52", predictBlock([fin({ state: "open", pick: null }), sf(SF1, 0, { state: "ended", pick: 1, split: SPLIT.sf1 }), sf(SF2, 1, { state: "ended", pick: 1, split: SPLIT.sf2 })], { note: `2 right so far &middot; +${2 * PICK_COINS} after the final` }))}
        ${stateItem("The final resolved · the week complete", predictBlock([fin({ state: "ended", pick: 0, split: SPLIT.final, paid: true })], { title: "Your calls", note: "Paid" }) + `<p class="r3-weekly"><b>${weeklyLine(CALLS.correct, CALLS.picks)}</b></p>`)}
      </div>`, { compete: "live" }),
  },
  {
    file: "Evening-FinalLive.dc.html", page: "predictions", route: "/midweek", state: "21:05, the final live, your calls",
    rule: "ADR-118: the split from kick-off; your picks resolve as matches end",
    note: "The final leads for everyone (DR2). Below it, your calls: both semi-finals came true, the final is closed and shows how the club split (counts only). Coins for calls are paid with the rest after the final.",
    body: () =>
      evening(FINAL_LIVE, `${head({ kicker: "Midweek Madness &middot; Wed 7 Oct", title: "The final is live" })}
      <section class="ux-block"><div class="ux-block__h"><h2 class="display">The final</h2><a class="link">Watch it &rarr;</a></div>${scoreboard(FINAL, { now: FINAL_LIVE })}${shootoutLive(FINAL, FINAL_LIVE)}</section>
      ${predictBlock([fin({ state: "closed", pick: 0, split: SPLIT.final, live: true }), sf(SF1, 0, { state: "ended", pick: 1, split: SPLIT.sf1 }), sf(SF2, 1, { state: "ended", pick: 1, split: SPLIT.sf2 })], { title: "Your calls", note: `2 right so far &middot; +${2 * PICK_COINS} after the final` })}
      <p class="panel small muted">The champion is named and coins are paid when the final ends. You: +${coinsFor(YOU)} so far, and ${PICK_COINS} for each call that comes true.</p>`),
  },
  {
    file: "Bracket-Calls.dc.html", page: "predictions", route: "/midweek/2026-10-05", state: "20:41, your calls on the bracket",
    rule: "Where else picking goes: the bracket shows your calls and links to them; it doesn't take picks",
    note: "Recommendation: one place to pick (the evening page, where a member who is out already is), and the bracket shows each call on its row, with a jump link while one is open. Fewer places that save, one set of states to build and test.",
    body: () => bracketCalls(),
  },
  // ---------------------------------------------------------------- sharing in the page
  {
    file: "Share-Flow.dc.html", page: "share", route: "/midweek", state: "tapping Share (phone) or Download (desktop)",
    rule: "Owner Q4: Web Share on phones, a download on desktop; no server",
    note: "Phones (320, 412): Share opens the phone's own share sheet with the PNG attached; WhatsApp is one tap. 'Save image' downloads instead. Desktop (1440): Download saves the PNG and says where it went. The image is drawn when the button is tapped, from data the page already has.",
    body: (ctx) => championView(ctx, { extra: shareSheet(ctx) }).replace(shareBlock(ctx), shareBlock(ctx, { done: true })),
  },
  // ---------------------------------------------------------------- picker
  {
    file: "Picker-Lines-Balanced.dc.html", page: "picker", route: "/midweek", state: "saved, a balanced five",
    rule: "ADR-116: 3 plusses per line from the four not in goal; ×0.88 per plus short",
    note: `A Goalkeeper, a Speedster, a Finisher, a Defender and an All-rounder: attack ${balanceOf(BALANCED.slice(1).map(archOf)).sum[0]}, midfield ${balanceOf(BALANCED.slice(1).map(archOf)).sum[1]}, defence ${balanceOf(BALANCED.slice(1).map(archOf)).sum[2]}. The count sits under the keeper check, above the save bar. Each list row shows the card's plusses as A/M/D.`,
    body: () => picker({ five: BALANCED, bar: "saved", keeper: { name: BALANCED[0] } }),
  },
  {
    file: "Picker-Lines-OneShort.dc.html", page: "picker", route: "/midweek", state: "unsaved, defence 1 short",
    rule: "ADR-116; DR2's sticky save bar on phones",
    note: `A Goalkeeper, a Speedster, a Finisher and two All-rounders: defence has ${balanceOf(ONE_SHORT.slice(1).map(archOf)).sum[2]} of ${NEED}, so the five plays at ${factorText(balanceOf(ONE_SHORT.slice(1).map(archOf)).factor).replace("&times;", "×")}. On a phone the sticky save bar carries the one-line verdict, so the cost is visible at the moment of saving even when the count has scrolled away.`,
    body: () => picker({ five: ONE_SHORT, bar: "dirty", keeper: { name: ONE_SHORT[0] } }),
  },
  {
    file: "Picker-Lines-NoKeeper.dc.html", page: "picker", route: "/midweek", state: "unsaved, no Goalkeeper: no count",
    rule: "Owner Q8 (3 Oct): no count until a Goalkeeper is picked",
    note: "Without a Goalkeeper the stand-in is only settled at the lock (it depends on form), so the picker can't say which four count. It shows no count and says why; the sticky bar says the same in one line. The keeper check above already warns.",
    body: () => picker({ five: NO_KEEPER, bar: "dirty", keeper: null }),
  },
  {
    file: "Picker-Lines-TwoShort.dc.html", page: "picker", route: "/midweek", state: "unsaved, three keepers, two lines short",
    rule: "ADR-116; with the table, two lines short needs two Goalkeepers outfield",
    note: `Three Goalkeepers and two All-rounders: one keeper in goal, two outfield at 0/0/3. Attack and midfield are each 1 short, 2 plusses in all: ${factorText(balanceOf(TWO_SHORT.slice(1).map(archOf)).factor).replace("&times;", "×")}. With today's table this is the only way to fall short in two lines.`,
    body: () => picker({ five: TWO_SHORT, bar: "dirty", keeper: { name: TWO_SHORT[0], many: true } }),
  },
  {
    file: "Picker-Lines-NoColour.dc.html", page: "picker", route: "/midweek", state: "the same, without colour",
    rule: "Colour is never the only signal",
    note: "The two-short five in greyscale: filled against dashed pips, the threshold tick after the third, the ✓ and ! marks and the words 'enough' and '1 short' all still say it.",
    body: () => picker({ five: TWO_SHORT, bar: "dirty", keeper: { name: TWO_SHORT[0], many: true } }).replace('<div class="pg">', '<div class="pg" style="filter:grayscale(1)">'),
  },
  // ---------------------------------------------------------------- colours
  {
    file: "Colours-Tokens.dc.html", page: "colours", route: "tokens", state: "violet and teal, and the checks",
    rule: "Owner, 3 Oct: 'deeper colours would be more classy'; round 2: 'an even darker / deeper red, or an alternative'",
    note: "Chosen (owner, 3 Oct): violet and teal. Royal blue (round 2) kept for comparison. Text tones for names and numbers (AA on every surface), deep fills for everything drawn, Live on its own tokens. Ratios and colour-blind simulations are computed by the generator.",
    body: () => chrome(tokensBoard()),
  },
  ...[
    ["FullTime", "regular-time result", PLAIN_FT, null, { kicker: `${roundName(2)}, match 6 &middot; full time ${hhmm(fullTimeAt(PLAIN_FT))}`, mode: "ft" }],
    ["Shootout", "a penalty shoot-out", QF, null, { kicker: `${roundName(3)} &middot; your match &middot; full time ${hhmm(fullTimeAt(QF))}`, mode: "ft" }],
    ["Live", "a match still being played", R2, LIVE, { kicker: `${roundName(2)} &middot; your match &middot; live`, mode: "live", youThrough: 5 }],
  ].flatMap(([key, state, m, now, opts]) =>
    THEMES.map(([theme, Name, words], col) => ({
      file: `Colours-Report-${key}-${Name}.dc.html`, page: "colours", theme, col,
      route: "/midweek/2026-10-05/match/[id]", state: `${state}, ${words}`,
      rule: THEME_RULE[theme],
      note: col === 0 ? `The match report with today's tokens (${state}). Violet and teal (chosen), then royal blue and teal (round 2), sit to the right on the same row.` : `The same report (${state}) with ${words}. Names and the score keep AA; rails, the chance bar and penalty dots take the deep fills.`,
      body: () => matchScreen(m, now, opts),
    })),
  ),
  ...THEMES.map(([theme, Name, words], col) => ({
    file: `Colours-Elsewhere-${Name}.dc.html`, page: "colours", theme, col,
    route: "/midweek and /", state: `the other places, ${words}`,
    rule: "Everything else that uses the tokens: Your match, The final, Home's live card, Live",
    note: col === 0 ? "Today: Live and the red team share one pink." : `With ${words}: Live keeps its pink on its own tokens, so 'Live' never reads as 'side 1'.`,
    body: () => elsewhere(),
  })),
  {
    file: "Pairs-Board.dc.html", page: "pairs", route: "tokens", state: "four pairs and their checks", widths: [1440],
    rule: "Owner, 3 Oct: 'What if you let go of the blue? Are there any two-colour combinations that could work?'",
    note: "Violet and teal (chosen), royal blue and teal (round 2's choice) and two more pairs without the blue. Each side is a text tone (AA) and a deep fill. Ratios and colour-blind separations are computed by the generator.",
    body: () => chrome(pairsBoard()),
  },
  ...PAIRS.map((pair, i) => ({
    file: `Pairs-${pair.id}.dc.html`, page: "pairs", route: "/midweek/2026-10-05/match/[id]", state: pair.label.toLowerCase(), theme: `pair-${pair.id}`, widths: [412, 1440],
    rule: pair.id === "violet-teal" ? "Chosen (owner, 3 Oct)" : i === 0 ? "Round 2's choice, for reference" : "A pair without the blue",
    note: `${pair.label}: the shoot-out report (Sophie v Sanne), with lanes, penalty dots, the chance bar and the Why list. Side 0 (left) is ${SIDE_COLOURS[pair.sides[0]].name.toLowerCase()}, side 1 (right) ${SIDE_COLOURS[pair.sides[1]].name.toLowerCase()}; which colour takes which side is free.`,
    body: () => matchScreen(QF, null, { kicker: `${roundName(3)} &middot; your match &middot; full time ${hhmm(fullTimeAt(QF))}`, mode: "ft" }),
  })),
];
