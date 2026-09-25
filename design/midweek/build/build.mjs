// Builds the Midweek Madness mockups: one .dc.html per screen and state, plus
// design/midweek/canvas.json. Every artboard is measured in Chromium at its
// real width, and the build fails if any page scrolls sideways.
//
//   node design/midweek/build/build.mjs [--shots <dir>]
//
// --shots also writes full-page PNGs for review (kept out of the repo).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { here } from "./source.mjs";
import { dcFile } from "./lib.mjs";
import { SCREENS } from "./screens.mjs";

const outDir = path.resolve(here, "..");
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > -1 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const PAGES = [
  { id: "picking", name: "Picking your five" },
  { id: "wednesday", name: "Wednesday night" },
  { id: "bracket", name: "Bracket and reports" },
  { id: "entry", name: "Entry points" },
  { id: "settings", name: "Settings, rules and admin" },
];
const WIDTHS = [320, 412, 1440];
const COL_X = { 320: 0, 412: 440, 1440: 972 };

for (const s of SCREENS) {
  const title = `${s.route} — ${s.state}`;
  fs.writeFileSync(path.join(outDir, s.file), dcFile({ title, body: s.body() }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const artboards = [];
const annotations = [];
const nextY = Object.fromEntries(PAGES.map((p) => [p.id, 0]));

for (const s of SCREENS) {
  const widths = s.desktop === false ? WIDTHS.slice(0, 2) : WIDTHS;
  const url = pathToFileURL(path.join(outDir, s.file)).href;
  let rowHeight = 0;
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: w < 640 ? 800 : 900 });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      sw: document.documentElement.scrollWidth,
    }));
    if (m.sw > w) throw new Error(`${s.file} overflows at ${w}px: ${m.sw}px wide`);
    if (shots) await page.screenshot({ path: path.join(shots, `${s.file.replace(".dc.html", "")}-${w}.png`), fullPage: true });
    const y = nextY[s.page];
    artboards.push({
      file: s.file,
      title: `${s.route} — ${s.state} · ${w}`,
      page: s.page,
      x: COL_X[w],
      y,
      w,
      h: m.h,
    });
    rowHeight = Math.max(rowHeight, m.h);
  }
  annotations.push({
    id: `note-${s.file.replace(".dc.html", "").toLowerCase()}`,
    page: s.page,
    x: -380,
    y: nextY[s.page],
    w: 300,
    text: `${s.route.toUpperCase()} — ${s.state}\n\n${s.rule}\n\n${s.note}`,
  });
  nextY[s.page] += rowHeight + 160;
}
await browser.close();
if (errors.length) throw new Error(`Page errors:\n${errors.join("\n")}`);

const canvas = { pages: PAGES, artboards, annotations, launch: { view: "canvas", page: "picking" } };
fs.writeFileSync(path.join(outDir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
console.log(`Wrote ${SCREENS.length} mockups and ${artboards.length} artboards${shots ? `; shots in ${shots}` : ""}.`);
