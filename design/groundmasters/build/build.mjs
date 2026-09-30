// Groundmaster card directions (docs/ROADMAP.md, "Groundmasters"): the real
// LiveCard and globals.css from src/, re-dressed per option through a data-gm
// attribute. Design only; nothing in the app imports this. Writes one .dc.html
// per direction plus design/groundmasters/canvas.json (Claude Design canvas).
//
//   node design/groundmasters/build/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  React,
  renderToStaticMarkup,
  src,
  root,
} from "../../midweek/build/source.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..");
fs.mkdirSync(out, { recursive: true });

const { LiveCard } = src("components/live-card.tsx");
const { ARCHETYPE_OFFSETS } = src("game/rating-engine.ts");

const kutCss = fs
  .readFileSync(path.join(root, "src/app/globals.css"), "utf8")
  .replace('@import "tailwindcss";', "")
  .replace("@theme inline {", ":root {");
const gmCss = fs.readFileSync(path.join(here, "gm.css"), "utf8");

const BOOST = 8;
let uid = 0;

function render({ name, ovr, archetype, tier, size }, badge) {
  const off = ARCHETYPE_OFFSETS[archetype];
  const at = (k) => Math.max(1, Math.min(99, ovr + off[k]));
  const html = renderToStaticMarkup(
    React.createElement(LiveCard, {
      size,
      badge: badge ? React.createElement("span", { className: "gm-serial" }, badge) : undefined,
      player: {
        id: `sample-${name}`, injured: false, displayName: name, archetype,
        liveOvr: ovr, rarityTier: tier,
        pac: at("pac"), sho: at("sho"), pas: at("pas"), dri: at("dri"), def: at("def"), phy: at("phy"),
      },
    }),
  );
  const id = `arc-${++uid}`;
  return html.replaceAll("shirt-arc-_R_i_", id);
}

// Per-option extra markup: [before the portrait, inside the pennant, in the plate].
const ORN = {
  pitch: {
    under: `<span aria-hidden="true" class="gm-under"><i class="gm-circle"></i><i class="gm-box"></i></span>`,
    pennant: `<svg class="gm-flag" viewBox="0 0 26 36" aria-hidden="true"><path d="M5 2 V34" stroke="#f4f1e6" stroke-width="2.2" stroke-linecap="round" fill="none"></path><path d="M6.2 3 L23 8.4 L6.2 14 Z" fill="#e7c13c"></path><path d="M6.2 3 L23 8.4 L6.2 8.4 Z" fill="#d4512d"></path></svg>`,
    plate: `<span class="gm-year">2026</span>`,
  },
  deed: {
    under: "",
    pennant: `<span class="gm-stamp">Renewed</span>`,
    plate: `<span class="gm-seal" aria-hidden="true"><b>GM</b></span><span class="gm-year">Haarlem, 2026</span>`,
  },
  keys: {
    under: `<svg class="gm-under gm-key" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke-linecap="round"><circle cx="48" cy="52" r="30" stroke-width="7"></circle><circle cx="48" cy="52" r="11" stroke-width="4"></circle><path d="M70 74 L186 190" stroke-width="7"></path><path d="M150 154 L168 136 M162 166 L174 154 M136 140 L150 126" stroke-width="7"></path></g></svg>`,
    pennant: `<span class="gm-tag"><i></i><b>GM</b></span>`,
    plate: `<span class="gm-year">2026</span>`,
  },
  honours: {
    under: `<span aria-hidden="true" class="gm-under"><span class="gm-header">Groundmasters</span></span>`,
    pennant: "",
    plate: `<span class="gm-year">MMXXVI</span>`,
  },
  plan: {
    under: `<span aria-hidden="true" class="gm-under"><i class="gm-pitch"></i><i class="gm-half"></i><i class="gm-circle"></i><i class="gm-dim"><b>Groundmaster</b></i></span>`,
    pennant: `<svg class="gm-north" viewBox="0 0 30 40" aria-hidden="true"><circle cx="15" cy="23" r="12" fill="none" stroke="#fff" stroke-width="1.4"></circle><path d="M15 9 L20 30 L15 26 L10 30 Z" fill="#fff"></path><text x="15" y="7" text-anchor="middle" font-size="7" fill="#fff" font-weight="700">N</text></svg>`,
    plate: `<span class="gm-year"><small>Issued</small>2026</span>`,
  },
};

function gmCard(opt, p, { serial = null } = {}) {
  const o = ORN[opt];
  let html = render({ ...p, tier: "common" }, serial);
  html = html
    .replace('data-rarity="common"', `data-rarity="groundmaster" data-gm="${opt}"`)
    .replace(" · Common</p>", " · Groundmaster</p>")
    .replace('<div aria-hidden="true" class="live-card__portrait">', `${o.under}<div aria-hidden="true" class="live-card__portrait">`)
    .replace('<span class="live-card__tier-icon live-card__tier-icon--common"></span>', o.pennant)
    .replace("</p></div><dl", `</p>${o.plate}</div><dl`);
  if (serial)
    html = html.replace(
      /<div class="live-card__badge">(.*?)<\/div>/,
      `<sc-if value="{{showSerial}}" hint-placeholder-val="{{true}}"><div class="live-card__badge">$1</div></sc-if>`,
    );
  return html;
}

const liveCard = (p) => render(p);

// Invented sample Players (design/midweek/sample-tournament.json).
const KEES = { name: "Kees R.", ovr: 47, archetype: "finisher", tier: "bronze" };
const ANOUK = { name: "Anouk B.", ovr: 74, archetype: "goalkeeper", tier: "holo" };
const gm = (p) => ({ ...p, ovr: Math.min(95, p.ovr + BOOST) });

const W = 1100;
const H = 600;
const GRID = 170;

function dc({ title, body, props = {} }) {
  const dataProps = JSON.stringify({ ...props, $preview: { width: W, height: H } });
  const vals = Object.keys(props)
    .map((k) => `${k}: this.props.${k} ?? ${JSON.stringify(props[k].default)}`)
    .join(", ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&amp;family=Instrument+Serif:ital@0;1&amp;family=Courier+Prime:wght@400;700&amp;family=IBM+Plex+Mono:wght@500;600&amp;display=swap">
<style>
body{margin:0}
html,body{overflow:hidden}
${kutCss}
${gmCss}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${dataProps}'>
class Component extends DCLogic {
renderVals() {
return { ${vals} };
}
}
</script>
</body>
</html>
`;
}

const stage = (inner) =>
  `<div class="board-ground gm-stage" style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 40px; display: flex; gap: 56px; align-items: flex-start; overflow: hidden; font-family: var(--font-sans); color: #f4efe3">${inner}</div>`;

const OPTIONS = [
  ["pitch", "1 · Mown stripes"],
  ["deed", "2 · The agreement"],
  ["keys", "3 · Keys to the ground"],
  ["honours", "4 · Honours board"],
  ["plan", "5 · Site plan"],
];

const files = {};
for (const [opt, title] of OPTIONS) {
  const body = stage(`
<div style="width: 330px; flex-shrink: 0">${gmCard(opt, gm(KEES), { serial: "No. 04 / 10" })}</div>
<div style="display: flex; gap: 28px; align-items: flex-start">
<div style="display: flex; flex-direction: column; gap: 14px">
<p class="gm-kicker">Groundmaster · in the collection</p>
<div style="display: grid; grid-template-columns: repeat(2, ${GRID}px); gap: 16px">
<figure class="gm-fig">${gmCard(opt, gm(KEES))}<figcaption><b>Kees R.</b>Groundmaster · ${KEES.ovr + BOOST}</figcaption></figure>
<figure class="gm-fig">${gmCard(opt, gm(ANOUK))}<figcaption><b>Anouk B.</b>Groundmaster · ${ANOUK.ovr + BOOST}</figcaption></figure>
</div>
</div>
<div style="align-self: stretch; width: 1px; background: #4a4030"></div>
<div style="display: flex; flex-direction: column; gap: 14px">
<p class="gm-kicker">For comparison · Live card</p>
<figure class="gm-fig">${liveCard(KEES)}<figcaption><b>Kees R.</b>Live · Bronze · ${KEES.ovr} (unchanged)</figcaption></figure>
</div>
</div>`);
  const file = `${opt === "pitch" ? "Main" : opt[0].toUpperCase() + opt.slice(1)}.dc.html`;
  files[file] = title;
  fs.writeFileSync(
    path.join(out, file),
    dc({ title: `Groundmaster — ${title.slice(4)}`, body, props: { showSerial: { editor: "boolean", default: true, section: "Edition" } } }),
  );
}

// Reference: today's Live ladder at grid size.
const LADDER = [
  { name: "Gijs H.", ovr: 39, archetype: "all_rounder", tier: "common" },
  KEES,
  { name: "Ayla D.", ovr: 58, archetype: "tank", tier: "silver" },
  { name: "Tess F.", ovr: 66, archetype: "playmaker", tier: "gold" },
  { name: "Sem O.", ovr: 77, archetype: "all_rounder", tier: "holo" },
];
fs.writeFileSync(
  path.join(out, "Reference.dc.html"),
  dc({
    title: "Live tiers today",
    body: `<div class="board-ground gm-stage" style="width: ${W}px; height: ${H}px; box-sizing: border-box; padding: 40px; display: flex; flex-direction: column; gap: 14px; font-family: var(--font-sans); color: #f4efe3">
<p class="gm-kicker">Live cards today, for comparison</p>
<div style="display: grid; grid-template-columns: repeat(5, ${GRID}px); gap: 16px">${LADDER.map((p) => `<div style="width: ${GRID}px">${liveCard(p)}</div>`).join("")}</div>
<p class="gm-caption">Common &middot; Bronze &middot; Silver &middot; Gold &middot; Holo. Elite (80+, black lacquer and gold leaf) has no Player in the sample.</p>
</div>`,
  }),
);
files["Reference.dc.html"] = "0 · Live tiers today";

// Index: reference on top, options in two columns below.
const boards = {};
const order = [];
const place = (file, x, y) => {
  boards[file] = { x, y, w: W, h: H, title: files[file] };
  order.push(file);
};
place("Reference.dc.html", 0, 0);
const optFiles = Object.keys(files).filter((f) => f !== "Reference.dc.html");
optFiles.forEach((f, i) => place(f, (i % 2) * (W + 80), (Math.floor(i / 2) + 1) * (H + 120)));
const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString() },
  title: "Groundmaster card designs",
  launch: { view: "canvas" },
  pages: [],
  boards,
  order,
  notes: {
    title: { x: 0, y: -300, text: "Groundmasters — five card directions", kind: "title1", maxW: 2 * W + 80 },
  },
  designSystems: [],
};
fs.writeFileSync(path.join(out, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
console.log(Object.keys(files).join("\n"));
