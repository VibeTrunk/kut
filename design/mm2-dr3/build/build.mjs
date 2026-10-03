// Builds the MM 2.0 design round 3 mockups: one .dc.html per screen and state,
// plus design/mm2-dr3/canvas.json. Pages are measured in Chromium at 320, 412
// and 1440 px and the build fails if any scrolls sideways; the two share
// images are fixed 1080 x 1350 frames and must be exactly that size.
//
//   node design/mm2-dr3/build/build.mjs [--shots <dir>] [--only <prefix>]
//
// --shots also writes full-page PNGs for review (kept out of the repo).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { dcFile } from "./lib.mjs";
import { PAGES, SCREENS } from "./screens.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "..");
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > -1 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

const WIDTHS = [320, 412, 1440];
const COL_X = { 320: 0, 412: 440, 1440: 972 };
const PAIR_DX = 2560; // each colour variant sits this far right of the one before
const IMG = { w: 1080, h: 1350 };

const browser = await chromium.launch({ headless: true });
const errors = [];
const write = (s, ctx) => fs.writeFileSync(path.join(outDir, s.file), dcFile({ title: `${s.route} — ${s.state}`, theme: s.theme, body: s.image ? `<div class="r3-imgpage">${s.body(ctx)}</div>` : s.body(ctx) }));

// Pass 1: the share images, and a small JPEG of each for the in-page previews.
const thumbs = new Map();
const imgPage = await browser.newPage({ viewport: { width: IMG.w, height: IMG.h }, deviceScaleFactor: 0.5 });
imgPage.on("pageerror", (e) => errors.push(e.message));
for (const s of SCREENS.filter((x) => x.image)) {
  write(s, {});
  await imgPage.goto(pathToFileURL(path.join(outDir, s.file)).href);
  await imgPage.evaluate(() => document.fonts.ready);
  const box = await imgPage.evaluate(() => { const r = document.querySelector(".r3-img").getBoundingClientRect(); return { w: r.width, h: r.height, sw: document.documentElement.scrollWidth }; });
  if (box.w !== IMG.w || box.h !== IMG.h || box.sw > IMG.w) throw new Error(`${s.file} is ${box.w} x ${box.h} (scroll ${box.sw}), not ${IMG.w} x ${IMG.h}`);
  const jpg = await imgPage.locator(".r3-img").screenshot({ type: "jpeg", quality: 82 });
  thumbs.set(s.file, `data:image/jpeg;base64,${jpg.toString("base64")}`);
}
await imgPage.close();
const ctx = { thumb: (f) => thumbs.get(f) };

// Pass 2: every page.
for (const s of SCREENS.filter((x) => !x.image)) write(s, ctx);

const page = await browser.newPage({ viewport: { width: 412, height: 800 }, reducedMotion: "reduce" });
page.on("pageerror", (e) => errors.push(e.message));
const artboards = [];
const annotations = [];
const nextY = Object.fromEntries(PAGES.map((p) => [p.id, 0]));
let lastRow = null;

for (const s of SCREENS) {
  const url = pathToFileURL(path.join(outDir, s.file)).href;
  const sameRow = (s.col ?? 0) > 0;
  const y = sameRow ? lastRow.y : nextY[s.page];
  const dx = (s.col ?? 0) * PAIR_DX;
  let rowHeight = sameRow ? lastRow.h : 0;
  for (const w of s.image ? [IMG.w] : s.widths ?? WIDTHS) {
    await page.setViewportSize({ width: w, height: s.image ? IMG.h : w < 640 ? 800 : 900 });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }));
    if (m.sw > w) throw new Error(`${s.file} overflows at ${w}px: ${m.sw}px wide`);
    if (shots && (!only || s.file.startsWith(only))) await page.screenshot({ path: path.join(shots, `${s.file.replace(".dc.html", "")}-${w}.png`), fullPage: true });
    artboards.push({ file: s.file, title: `${s.route} — ${s.state}${s.image ? "" : ` · ${w}`}`, page: s.page, x: (s.image ? 0 : COL_X[w]) + dx, y, w, h: s.image ? IMG.h : m.h });
    rowHeight = Math.max(rowHeight, s.image ? IMG.h : m.h);
  }
  annotations.push({
    id: `note-${s.file.replace(".dc.html", "").toLowerCase()}`,
    page: s.page,
    x: dx - 380,
    y,
    w: 300,
    text: `${s.route.toUpperCase()} — ${s.state}\n\n${s.rule}\n\n${s.note}`,
  });
  lastRow = { y, h: rowHeight };
  nextY[s.page] = Math.max(nextY[s.page], y + rowHeight + 160);
}
await browser.close();
if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

const canvas = { pages: PAGES, artboards, annotations, launch: { view: "canvas", page: "ratings" } };
fs.writeFileSync(path.join(outDir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
console.log(`Wrote ${SCREENS.length} mockups and ${artboards.length} artboards${shots ? `; shots in ${shots}` : ""}.`);
