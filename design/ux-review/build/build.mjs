// Builds the UX review mockups: one .dc.html per screen and state, plus
// design/ux-review/canvas.json. Every artboard is measured in Chromium at its
// real width, and the build fails if any page scrolls sideways.
//
//   node design/ux-review/build/build.mjs [--shots <dir>]
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

for (const s of SCREENS) {
  fs.writeFileSync(path.join(outDir, s.file), dcFile({ title: `${s.route} — ${s.state}`, body: s.body() }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 412, height: 800 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const artboards = [];
const annotations = [];
const nextY = Object.fromEntries(PAGES.map((p) => [p.id, 0]));

for (const s of SCREENS) {
  const url = pathToFileURL(path.join(outDir, s.file)).href;
  let rowHeight = 0;
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 640 ? 800 : 900 });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth }));
    if (m.sw > w) throw new Error(`${s.file} overflows at ${w}px: ${m.sw}px wide`);
    if (shots && (!only || s.file.startsWith(only))) await page.screenshot({ path: path.join(shots, `${s.file.replace(".dc.html", "")}-${w}.png`), fullPage: true });
    artboards.push({ file: s.file, title: `${s.route} — ${s.state} · ${w}`, page: s.page, x: COL_X[w], y: nextY[s.page], w, h: m.h });
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

const canvas = { pages: PAGES, artboards, annotations, launch: { view: "canvas", page: "evening" } };
fs.writeFileSync(path.join(outDir, "canvas.json"), `${JSON.stringify(canvas, null, 2)}\n`);
console.log(`Wrote ${SCREENS.length} mockups and ${artboards.length} artboards${shots ? `; shots in ${shots}` : ""}.`);
