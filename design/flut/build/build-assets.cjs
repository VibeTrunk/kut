// Builds every FLUT asset in design/flut/assets from its source:
//  - favicon.ico (16 hinted master + 32 + 48 from icon.svg, PNG-in-ICO)
//  - apple-icon.png (180 x 180, from src/apple-icon.html)
//  - both Midweek share images, drawn by the app's own share-draw.ts before
//    (KUT) and after (FLUT, with HANDOFF §5's two edits applied), plus the
//    256-coin worst case for the coins line.
// usage (from the repo root): node design/flut/build/build-assets.cjs
// Needs network for Google Fonts (Archivo, Instrument Serif), as the mockups do.
const fs = require("fs");
const path = require("path");
const repo = path.resolve(__dirname, "../../..");
const out = path.resolve(__dirname, "../assets");
const ts = require(path.join(repo, "node_modules/typescript"));
const { chromium } = require(path.join(repo, "node_modules/playwright"));

const src = fs.readFileSync(path.join(repo, "src/lib/midweek/share-draw.ts"), "utf8");
const BEFORE_TOP = 'text(ctx, "KUT", M + 46, 106, { color: C.ink });';
const AFTER_TOP = 'text(ctx, "FLUT", M + 46, 106, { color: C.ink, track: -0.02, size: 44 });';
const BEFORE_COINS = 'text(ctx, "KUT Coins", M + coinsWidth + 16, 405, { color: C.inkDim });';
const AFTER_COINS = 'text(ctx, "FLUT Coins", M + coinsWidth + 16, 405, { color: C.inkDim });';
if (!src.includes(BEFORE_TOP) || !src.includes(BEFORE_COINS)) throw new Error("share-draw.ts changed; update the edits");
const flut = src.replace(BEFORE_TOP, AFTER_TOP).replace(BEFORE_COINS, AFTER_COINS);
const js = (code) =>
  ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

const card = (name, ovr, tier, arch, shirtName, rating) => ({
  name, ovr, tier, meta: `${arch} · ${tier[0].toUpperCase()}${tier.slice(1)}`.toUpperCase(), plate: name, shirtName,
  stats: ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"].map((l) => [l, ovr]), photoUrl: null, rating,
});
const poster = {
  kind: "poster", top: "Midweek Madness · Wed 7 Oct 2026", champion: "Joris",
  line: "Beat Sophie on penalties in the final, 1–1 and 5–4 from the spot.",
  fiveLabel: "Joris’s five · rated out of 10 for the night",
  cards: [card("Olaf G.", 62, "gold", "Speedster", "OLAF G.", 8.4), card("Bram K.", 60, "gold", "All-rounder", "BRAM K.", 7.3), card("Noor E.", 54, "silver", "All-rounder", "NOOR E.", 8.6), card("Yara Q.", 54, "silver", "Goalkeeper", "YARA Q.", 6.9), card("Jesse T.", 49, "bronze", "All-rounder", "JESSE T.", 7.3)],
  tiles: [{ round: "Round 1", text: "Bye", out: false }, { round: "Round 2", text: "7–0 Emma", out: false }, { round: "Quarters", text: "4–0 Wessel", out: false }, { round: "Semis", text: "1–0 Julia", out: false }, { round: "Final", text: "1–1, 5–4 pens Sophie", out: false }],
  foot: "22 entrants · 64 goals", fileName: "x.png",
};
const night = {
  kind: "night", top: "Midweek Madness · Wed 7 Oct 2026", title: "Sanne’s night", finish: "Quarter-finals", coins: 54,
  tiles: [{ round: "Round 1", text: "Bye", out: false }, { round: "Round 2", text: "Beat Eline 1–0", out: false }, { round: "Quarters", text: "Lost to Sophie on pens, 6–7", out: true }],
  fiveLabel: "Sanne’s five · rated out of 10 for the night",
  cards: [card("Dirk S.", 40, "bronze", "All-rounder", "DIRK S.", 6.9), card("Mo A.", 40, "bronze", "All-rounder", "MO A.", 6.8), card("Gijs H.", 39, "common", "All-rounder", "GIJS H.", 6.2), card("Iris W.", 39, "common", "All-rounder", "IRIS W.", 6.7), card("Bas V.", 35, "common", "All-rounder", "BAS V.", 7.5)],
  best: 4, bestLine: "Bas V. scored and created. Hard to ask more of one card.", foot: "Called 2 of 3 · Joris won it", fileName: "x.png",
};
// Worst case for the coins line: the champion's 250 plus three right calls.
const nightMax = { ...night, title: "Joris’s night", finish: "Champion", coins: 256 };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;800;900&family=Instrument+Serif&display=block"></head><body style="font-family:Archivo">x<span style="font-family:'Instrument Serif'">x</span></body></html>`);
  await page.evaluate(async () => {
    await Promise.all([...[500, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px Archivo`)), document.fonts.load(`400 40px "Instrument Serif"`)]);
  });
  const jobs = [
    ["before-poster", src, poster], ["before-night", src, night],
    ["flut-poster", flut, poster], ["flut-night", flut, night], ["flut-night-256", flut, nightMax],
  ];
  // Icons. Each PNG is a transparent screenshot of its SVG at exact size.
  const iconPng = async (svgFile, size) => {
    const svg = fs.readFileSync(svgFile, "utf8").replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
    const p = await browser.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
    const png = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
    return png;
  };
  const pngs = [
    [16, await iconPng(path.join(out, "src/favicon-16.svg"), 16)],
    [32, await iconPng(path.join(out, "icon.svg"), 32)],
    [48, await iconPng(path.join(out, "icon.svg"), 48)],
  ];
  // ICO container: 6-byte header, one 16-byte entry per image, PNG payloads.
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(([size, png], i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size, e);
    header.writeUInt8(size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  fs.writeFileSync(path.join(out, "favicon.ico"), Buffer.concat([header, ...pngs.map(([, png]) => png)]));
  pngs.forEach(([size, png]) => fs.writeFileSync(path.join(out, `src/favicon-${size}.png`), png));
  console.log("wrote favicon.ico");
  const apple = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await apple.goto("file:///" + path.join(out, "src/apple-icon.html").replace(/\\/g, "/"));
  await apple.evaluate(() => document.fonts.load("900 30px Archivo"));
  await apple.evaluate(() => document.fonts.ready);
  await apple.screenshot({ path: path.join(out, "apple-icon.png"), clip: { x: 0, y: 0, width: 180, height: 180 } });
  await apple.close();
  console.log("wrote apple-icon.png");

  for (const [name, code, data] of jobs) {
    const b64 = await page.evaluate(({ code, data }) => {
      const exports = {};
      new Function("exports", code)(exports);
      const canvas = document.createElement("canvas");
      canvas.width = exports.SHARE_WIDTH; canvas.height = exports.SHARE_HEIGHT;
      const ctx = canvas.getContext("2d");
      const assets = { fonts: { sans: "Archivo", serif: "'Instrument Serif'" }, photos: new Map() };
      if (data.kind === "poster") exports.drawPoster(ctx, data, assets); else exports.drawMyNight(ctx, data, assets);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { code: js(code), data });
    fs.writeFileSync(path.join(out, `share-${name}.png`), Buffer.from(b64, "base64"));
    console.log("wrote", name);
  }
  // Exact metrics for the handoff, measured the way share-draw.ts measures.
  const metrics = await page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    const m = (f, t, ls = "0px") => { ctx.font = f; ctx.letterSpacing = ls; const r = ctx.measureText(t); return { t, f, ls, advance: +r.width.toFixed(1), inkRight: +r.actualBoundingBoxRight.toFixed(1), capTop: +r.actualBoundingBoxAscent.toFixed(1) }; };
    return [
      m("900 44px Archivo", "KUT"), m("900 44px Archivo", "FLUT", "-0.9px"), m("900 44px Archivo", "FLUT"),
      m("800 34px Archivo", "KUT Coins"), m("800 34px Archivo", "FLUT Coins"),
      m("900 72px Archivo", "+54"), m("900 72px Archivo", "+256"),
      m("800 26px Archivo", "MIDWEEK MADNESS · WED 30 SEP 2026", "5.2px"),
    ];
  });
  metrics.forEach((x) => console.log(JSON.stringify(x)));
  await browser.close();
})();
