import type { MyNightData, PosterData, ShareCard, ShareImage, ShareTile } from "./share";

/**
 * Draws the share images (DR3 HANDOFF §3, ADR-120) on a 1080 × 1350 canvas,
 * in the browser, from data the page already has: nothing is uploaded. Every
 * position is a canvas px value from the approved mockups (`Share-Poster`,
 * `Share-MyNight`). The canvas can't render React, so the LiveCard face is
 * drawn here from its own shapes: the shirt back's SVG path through `Path2D`
 * with the surname on the same arc, or the Player's photo, fetched with CORS
 * so the canvas is never tainted.
 */

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

const M = 64;
const INNER = SHARE_WIDTH - 2 * M;

const C = {
  board: "#15130f",
  boardDeep: "#0b0a07",
  panel2: "#2a2318",
  line: "#4a4030",
  ink: "#f4efe3",
  inkDim: "#b3a891",
  inkFaint: "#8a8072",
  brass: "#e0ac4a",
};

type Tier = ShareCard["tier"];

/** LiveCard's material ladder (globals.css), as flat colours a canvas can paint. */
const TIERS: Record<
  Tier,
  {
    stock: string;
    ci: string;
    plate: string | string[];
    plateInk: string;
    shirt?: string;
    shirtInk?: string;
  }
> = {
  common: { stock: "#e9e5d9", ci: "#3f3b33", plate: "#3b3830", plateInk: "#f7f4ec" },
  bronze: { stock: "#ecd8b1", ci: "#57390f", plate: "#8a5326", plateInk: "#fdf3e2" },
  silver: {
    stock: "#e3e8eb",
    ci: "#313b45",
    plate: ["#5e6b77", "#414b55", "#59646f"],
    plateInk: "#f5f8fa",
  },
  gold: {
    stock: "#f7e7b2",
    ci: "#543609",
    plate: ["#6b4a0d", "#b98f33", "#f2dd9a", "#c79b3d", "#7a560f"],
    plateInk: "#fff6df",
  },
  holo: { stock: "#ece7f4", ci: "#3a2a52", plate: "#574481", plateInk: "#ffffff" },
  elite: {
    stock: "#131009",
    ci: "#f2e6cb",
    plate: ["#b98f33", "#f2dd9a", "#c79b3d"],
    plateInk: "#191204",
    shirt: "#7c5f19",
    shirtInk: "#f8ecc6",
  },
};

/** LiveCard's shirt back (ADR-043), in its 200 × 200 view box. */
const SHIRT =
  "M64,28 L84,32 Q100,48 116,32 L136,28 L164,44 L180,92 L150,108 L144,94 L144,200 L56,200 L56,94 L50,108 L20,92 L36,44 Z";
const SEAMS = "M56,94 L56,200 M144,94 L144,200";
const BUST_HEAD = { cx: 100, cy: 72, r: 32 };
const BUST_BODY = "M40,178 C40,140 66,120 100,120 C134,120 160,140 160,178";
/** Past this LiveCard sets a bust instead of the surname; past `ARC_TIGHT` the arc drops two points. */
const ARC_LIMIT = 14;
const ARC_TIGHT = 10;

export type ShareAssets = {
  fonts: { sans: string; serif: string };
  photos: ReadonlyMap<string, ImageBitmap>;
};

type ShareStage = "fonts" | "canvas-context" | "draw" | "png-export" | "share" | "download";

/** Never include error messages, URLs, names, user agents or the page payload. */
export function reportShareFailure(
  stage: ShareStage,
  kind: ShareImage["kind"],
  error: unknown,
  recovery: "fallback" | "failed" = "failed",
) {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "Error";
  const errorName =
    /^(Error|TypeError|SyntaxError|RangeError|SecurityError|NotSupportedError|InvalidStateError|NotAllowedError|AbortError|TimeoutError|NetworkError|EncodingError)$/.test(
      name,
    )
      ? name
      : "Error";
  const detail = { stage, kind, errorName, recovery };
  console.warn("KUT share image", detail);
  window.dispatchEvent(new CustomEvent("kut:share-diagnostic", { detail }));
}

/** Bounds optional assets and export; late bitmaps are closed even after cancellation. */
function bounded<T>(
  work: Promise<T>,
  ms: number,
  signal?: AbortSignal,
  late?: (value: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: unknown, value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value as T);
    };
    const abort = () => finish(new DOMException("", "AbortError"));
    const timer = setTimeout(() => finish(new DOMException("", "TimeoutError")), ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    work.then(
      (value) => (finished ? late?.(value) : finish(undefined, value)),
      (error) => finish(error),
    );
  });
}

export function releaseShareAssets(assets: ShareAssets) {
  assets.photos.forEach((photo) => photo.close());
}

/** The app's own fonts (next/font's families), loaded before anything is drawn. */
export async function loadShareAssets(
  images: readonly ShareImage[],
  signal?: AbortSignal,
): Promise<ShareAssets> {
  const style = getComputedStyle(document.body);
  let sans =
    style.getPropertyValue("--font-archivo").trim() || "Archivo, Helvetica, Arial, sans-serif";
  let serif = style.getPropertyValue("--font-instrument").trim() || "Georgia, serif";
  try {
    await bounded(
      Promise.resolve().then(() =>
        Promise.all([
          ...["700", "800", "900"].map((weight) => document.fonts.load(`${weight} 40px ${sans}`)),
          document.fonts.load(`400 40px ${serif}`),
        ]),
      ),
      3_000,
      signal,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    images.forEach((image) => reportShareFailure("fonts", image.kind, error, "fallback"));
    sans = "Helvetica, Arial, sans-serif";
    serif = "Georgia, serif";
  }
  const urls = [
    ...new Set(images.flatMap((image) => image.cards.map((card) => card.photoUrl))),
  ].filter((url): url is string => Boolean(url));
  const photos = new Map<string, ImageBitmap>();
  await Promise.all(
    urls.map(async (url) => {
      // `fetch` with CORS, then a bitmap: drawing it never taints the canvas,
      // so `toBlob` works. A photo that can't be read falls back to the shirt.
      try {
        const request = new AbortController();
        const abort = () => request.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) request.abort();
        try {
          const bitmap = await bounded(
            (async () => {
              const response = await fetch(url, {
                mode: "cors",
                credentials: "omit",
                signal: request.signal,
              });
              if (!response.ok) return null;
              return createImageBitmap(await response.blob());
            })(),
            5_000,
            signal,
            (photo) => photo?.close(),
          );
          if (bitmap) {
            if (signal?.aborted) bitmap.close();
            else photos.set(url, bitmap);
          }
        } finally {
          request.abort();
          signal?.removeEventListener("abort", abort);
        }
      } catch {
        // The shirt back stands in.
      }
    }),
  );
  if (signal?.aborted) {
    photos.forEach((photo) => photo.close());
    throw new DOMException("", "AbortError");
  }
  return { fonts: { sans, serif }, photos };
}

type Ctx = CanvasRenderingContext2D;

function font(ctx: Ctx, assets: ShareAssets, weight: number, size: number, serif = false) {
  ctx.font = `${weight} ${size}px ${serif ? assets.fonts.serif : assets.fonts.sans}`;
}

/** Letter spacing where the browser supports it (Chrome 99+, Safari 17+); plain text elsewhere. */
function spacing(ctx: Ctx, em: number, size: number) {
  const target = ctx as Ctx & { letterSpacing?: string };
  if ("letterSpacing" in target) target.letterSpacing = `${Math.round(em * size * 10) / 10}px`;
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  options: { color: string; align?: CanvasTextAlign; track?: number; size?: number },
) {
  ctx.save();
  ctx.fillStyle = options.color;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = "alphabetic";
  if (options.track && options.size) spacing(ctx, options.track, options.size);
  ctx.fillText(value, x, y);
  ctx.restore();
}

/** Cuts a line to `max` px with an ellipsis, as LiveCard's nameplate does. */
function fit(ctx: Ctx, value: string, max: number): string {
  if (ctx.measureText(value).width <= max) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** Wraps `value` over at most `lines` lines of `max` px; returns the last baseline. */
function wrap(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  max: number,
  lineHeight: number,
  color: string,
  lines = 3,
): number {
  const words = value.split(/\s+/);
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > max && current) {
      out.push(current);
      current = word;
    } else current = next;
  }
  if (current) out.push(current);
  const shown = out.slice(0, lines);
  if (out.length > lines)
    shown[lines - 1] = fit(ctx, `${shown[lines - 1]} ${out.slice(lines).join(" ")}`, max);
  shown.forEach((line, index) => text(ctx, line, x, y + index * lineHeight, { color }));
  return y + (shown.length - 1) * lineHeight;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/** FLUT's shield: `polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)`. */
function shield(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y);
  ctx.lineTo(x + w, y + h * 0.38);
  ctx.lineTo(x + w * 0.82, y + h);
  ctx.lineTo(x + w * 0.18, y + h);
  ctx.lineTo(x, y + h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function plateFill(
  ctx: Ctx,
  plate: string | string[],
  x: number,
  w: number,
): string | CanvasGradient {
  if (typeof plate === "string") return plate;
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  plate.forEach((stop, index) => gradient.addColorStop(index / (plate.length - 1), stop));
  return gradient;
}

/** Sets `value` along LiveCard's shoulder arc `M42,74 Q100,54 158,74`, centred. */
function arcText(ctx: Ctx, value: string) {
  const point = (t: number) => ({
    x: (1 - t) ** 2 * 42 + 2 * (1 - t) * t * 100 + t ** 2 * 158,
    y: (1 - t) ** 2 * 74 + 2 * (1 - t) * t * 54 + t ** 2 * 74,
  });
  const samples: { t: number; s: number }[] = [{ t: 0, s: 0 }];
  let length = 0;
  let previous = point(0);
  for (let i = 1; i <= 200; i += 1) {
    const t = i / 200;
    const p = point(t);
    length += Math.hypot(p.x - previous.x, p.y - previous.y);
    samples.push({ t, s: length });
    previous = p;
  }
  const at = (s: number) => samples.find((sample) => sample.s >= s)?.t ?? 1;
  const chars = [...value];
  const widths = chars.map((char) => ctx.measureText(char).width);
  const track = parseFloat((ctx as Ctx & { letterSpacing?: string }).letterSpacing ?? "0") || 0;
  const total = widths.reduce((sum, w) => sum + w, 0);
  let s = length / 2 - total / 2;
  chars.forEach((char, index) => {
    const mid = s + (widths[index] - track) / 2;
    const t = at(mid);
    const p = point(t);
    const tangent = { x: 2 * (1 - t) * 58 + 2 * t * 58, y: 2 * (1 - t) * -20 + 2 * t * 20 };
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(tangent.y, tangent.x));
    ctx.fillText(char, 0, 0);
    ctx.restore();
    s += widths[index];
  });
}

/** A LiveCard face at width `w` (5:7), from its own measures: everything scales with `4cqi`. */
function drawCard(ctx: Ctx, assets: ShareAssets, card: ShareCard, x: number, y: number, w: number) {
  const tier = TIERS[card.tier];
  const h = w * 1.4;
  const em = w * 0.04;
  const plateH = 4.64 * em;
  const statsH = 6.61 * em;
  const artH = h - plateH - statsH;
  const radius = w * 0.07;

  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / 55%)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = tier.stock;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  if (card.tier === "elite") {
    const glow = ctx.createRadialGradient(x + w / 2, y - h * 0.06, 0, x + w / 2, y, h * 1.1);
    glow.addColorStop(0, "#2c2314");
    glow.addColorStop(0.52, "#141109");
    glow.addColorStop(1, "#090806");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
  }

  // The art: the photo where the Player has one, else the shirt back.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, artH);
  ctx.clip();
  const photo = card.photoUrl ? assets.photos.get(card.photoUrl) : undefined;
  if (photo) {
    const scale = Math.max(w / photo.width, artH / photo.height);
    const dw = photo.width * scale;
    const dh = photo.height * scale;
    ctx.drawImage(photo, x + (w - dw) / 2, y + (artH - dh) / 2, dw, dh);
  } else {
    const scale = Math.max(w / 200, artH / 200);
    ctx.translate(x + (w - 200 * scale) / 2, y + (artH - 200 * scale) / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = mix(tier.ci, tier.stock, 0.16);
    ctx.fillRect(0, 0, 200, 200);
    const shirt = tier.shirt ?? (typeof tier.plate === "string" ? tier.plate : tier.plate[1]);
    const shirtInk = tier.shirtInk ?? tier.plateInk;
    if (card.shirtName.length > ARC_LIMIT) {
      ctx.strokeStyle = mix(tier.ci, tier.stock, 0.72);
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(BUST_HEAD.cx, BUST_HEAD.cy, BUST_HEAD.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.stroke(new Path2D(BUST_BODY));
    } else {
      ctx.fillStyle = shirt;
      ctx.fill(new Path2D(SHIRT));
      ctx.strokeStyle = withAlpha(shirtInk, 0.16);
      ctx.lineWidth = 2;
      ctx.stroke(new Path2D(SEAMS));
      ctx.fillStyle = shirtInk;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const nameSize = card.shirtName.length > ARC_TIGHT ? 11 : 13;
      font(ctx, assets, 800, nameSize);
      spacing(ctx, 0.16, nameSize);
      arcText(ctx, card.shirtName);
      spacing(ctx, 0, nameSize);
      font(ctx, assets, 900, 62);
      ctx.textBaseline = "middle";
      ctx.fillText(String(card.ovr), 100, 126);
    }
  }
  ctx.restore();

  // The scrims: a ground under the rating, and the hand-off to the plate.
  const top = ctx.createRadialGradient(x, y, 0, x, y, w * 0.8);
  top.addColorStop(0, withAlpha(tier.stock, 0.88));
  top.addColorStop(0.38, withAlpha(tier.stock, 0.32));
  top.addColorStop(0.7, withAlpha(tier.stock, 0));
  ctx.fillStyle = top;
  ctx.fillRect(x, y, w * 0.66, artH * 0.46);
  const bottom = ctx.createLinearGradient(0, y + artH * 0.54, 0, y + artH);
  bottom.addColorStop(0, withAlpha(tier.stock, 0));
  bottom.addColorStop(1, withAlpha(tier.stock, 0.82));
  ctx.fillStyle = bottom;
  ctx.fillRect(x, y + artH * 0.54, w, artH * 0.46);

  // OVR, top left.
  font(ctx, assets, 900, 3.5 * em);
  text(ctx, String(card.ovr), x + 1.05 * em, y + 0.85 * em + 2.75 * em, { color: tier.ci });
  font(ctx, assets, 800, 0.82 * em);
  ctx.save();
  ctx.globalAlpha = 0.62;
  text(ctx, "OVR", x + 1.1 * em, y + 0.85 * em + 3.75 * em, {
    color: tier.ci,
    track: 0.24,
    size: 0.82 * em,
  });
  ctx.restore();

  // The pennant, top right.
  const pw = 2.5 * em;
  const ph = 3.1 * em;
  const px = x + w - 1.15 * em - pw;
  ctx.fillStyle = plateFill(ctx, tier.plate, px, pw);
  ctx.beginPath();
  ctx.moveTo(px, y);
  ctx.lineTo(px + pw, y);
  ctx.lineTo(px + pw, y + ph * 0.84);
  ctx.lineTo(px + pw / 2, y + ph);
  ctx.lineTo(px, y + ph * 0.84);
  ctx.closePath();
  ctx.fill();

  // The nameplate.
  const plateY = y + artH;
  ctx.fillStyle = plateFill(ctx, tier.plate, x, w);
  ctx.fillRect(x, plateY, w, plateH);
  font(ctx, assets, 800, 1.62 * em);
  text(ctx, fit(ctx, card.plate, w - 2.3 * em), x + 1.15 * em, plateY + 0.78 * em + 1.35 * em, {
    color: tier.plateInk,
  });
  font(ctx, assets, 700, 0.82 * em);
  ctx.save();
  ctx.globalAlpha = 0.74;
  spacing(ctx, 0.15, 0.82 * em);
  text(
    ctx,
    fit(ctx, card.meta, w - 2.3 * em),
    x + 1.15 * em,
    plateY + 0.78 * em + 1.685 * em + 0.35 * em + 0.82 * em,
    {
      color: tier.plateInk,
    },
  );
  ctx.restore();

  // The ruled stat table, three by two.
  const statsY = plateY + plateH;
  const colW = (w - 2.2 * em - 1.4 * em) / 3;
  card.stats.forEach(([label, value], index) => {
    const cx = x + 1.1 * em + (index % 3) * (colW + 0.7 * em);
    const rowTop = statsY + 0.95 * em + Math.floor(index / 3) * (1.98 * em + 0.55 * em);
    font(ctx, assets, 800, 0.8 * em);
    ctx.save();
    ctx.globalAlpha = 0.55;
    text(ctx, label, cx, rowTop + 1.15 * em, { color: tier.ci, track: 0.09, size: 0.8 * em });
    ctx.restore();
    font(ctx, assets, 900, 1.3 * em);
    text(ctx, String(value), cx + 2.77 * em, rowTop + 1.24 * em, { color: tier.ci });
    ctx.fillStyle = withAlpha(tier.ci, 0.2);
    ctx.fillRect(cx, rowTop + 1.88 * em, colW, Math.max(1, 0.1 * em));
  });
  ctx.restore();

  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
  ctx.strokeStyle = card.tier === "elite" ? "rgb(233 196 106 / 42%)" : "rgb(255 255 255 / 50%)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** `MidweekRatingDisc` at image size: 84 px, 34 px figures; the best one ringed brighter. */
function drawDisc(
  ctx: Ctx,
  assets: ShareAssets,
  cx: number,
  cy: number,
  rating: number,
  bright = false,
) {
  ctx.save();
  if (bright) {
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(244 239 227 / 14%)";
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.fillStyle = C.panel2;
  ctx.fill();
  ctx.lineWidth = bright ? 5 : 3;
  ctx.strokeStyle = bright ? C.ink : C.inkDim;
  ctx.stroke();
  font(ctx, assets, 900, 34);
  ctx.fillStyle = C.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(rating.toFixed(1), cx, cy + 2);
  ctx.restore();
}

function drawTop(ctx: Ctx, assets: ShareAssets, top: string) {
  shield(ctx, M, 72, 34, 34, C.brass);
  font(ctx, assets, 900, 44);
  text(ctx, "FLUT", M + 46, 106, { color: C.ink, track: -0.02, size: 44 });
  font(ctx, assets, 800, 26);
  text(ctx, top.toUpperCase(), SHARE_WIDTH - M, 100, {
    color: C.brass,
    align: "right",
    track: 0.2,
    size: 26,
  });
}

function drawKicker(
  ctx: Ctx,
  assets: ShareAssets,
  value: string,
  y: number,
  color: string,
  size = 30,
) {
  font(ctx, assets, 800, size);
  text(ctx, value.toUpperCase(), M, y, { color, track: size >= 30 ? 0.26 : 0.2, size });
}

/** The five cards in a row, each with its night rating and name under it. */
function drawFive(
  ctx: Ctx,
  assets: ShareAssets,
  cards: readonly ShareCard[],
  y: number,
  best: number | null,
) {
  const w = 178;
  const gap = (INNER - 5 * w) / 4;
  cards.slice(0, 5).forEach((card, index) => {
    const x = M + index * (w + gap);
    drawCard(ctx, assets, card, x, y, w);
    drawDisc(ctx, assets, x + w / 2, y + w * 1.4 + 52, card.rating, index === best);
    // A long name shrinks to 20 px before it is cut.
    let size = 26;
    font(ctx, assets, 800, size);
    while (ctx.measureText(card.name).width > w + gap - 4 && size > 20) {
      size -= 1;
      font(ctx, assets, 800, size);
    }
    text(ctx, fit(ctx, card.name, w + gap - 4), x + w / 2, y + w * 1.4 + 120, {
      color: C.ink,
      align: "center",
    });
  });
}

/** A path in tiles: round over result; the tile where the member went out is dashed. */
function drawTiles(
  ctx: Ctx,
  assets: ShareAssets,
  tiles: readonly ShareTile[],
  y: number,
  h: number,
  size: number,
) {
  const n = Math.max(1, tiles.length);
  const gap = 16;
  const w = (INNER - gap * (n - 1)) / n;
  tiles.forEach((tile, index) => {
    const x = M + index * (w + gap);
    ctx.save();
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 16);
    if (!tile.out) {
      ctx.fillStyle = "rgb(11 10 7 / 45%)";
      ctx.fill();
    } else ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.line;
    ctx.stroke();
    ctx.restore();
    font(ctx, assets, 800, 20);
    text(ctx, fit(ctx, tile.round.toUpperCase(), w - 36), x + 18, y + 44, {
      color: C.inkFaint,
      track: 0.14,
      size: 20,
    });
    font(ctx, assets, 800, size);
    wrap(
      ctx,
      tile.text,
      x + 18,
      y + 44 + size + 16,
      w - 36,
      size + 6,
      tile.out ? C.inkDim : C.ink,
      3,
    );
  });
}

function drawFoot(ctx: Ctx, assets: ShareAssets, foot: string) {
  ctx.fillStyle = C.line;
  ctx.fillRect(M, 1238, INNER, 2);
  font(ctx, assets, 700, 26);
  text(ctx, fit(ctx, foot, INNER), M, 1290, { color: C.inkFaint });
}

/** The serif headline, shrunk until it fits the width. */
function headline(
  ctx: Ctx,
  assets: ShareAssets,
  value: string,
  x: number,
  y: number,
  size: number,
  max: number,
) {
  let current = size;
  font(ctx, assets, 400, current, true);
  while (ctx.measureText(value).width > max && current > 72) {
    current -= 4;
    font(ctx, assets, 400, current, true);
  }
  text(ctx, value, x, y, { color: C.ink });
}

export function drawPoster(ctx: Ctx, data: PosterData, assets: ShareAssets) {
  const ground = ctx.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
  ground.addColorStop(0, "#211a10");
  ground.addColorStop(1, C.board);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  const glow = ctx.createRadialGradient(SHARE_WIDTH, 0, 0, SHARE_WIDTH, 0, 900);
  glow.addColorStop(0, "rgb(224 172 74 / 28%)");
  glow.addColorStop(1, "rgb(224 172 74 / 0%)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  drawTop(ctx, assets, data.top);
  drawKicker(ctx, assets, "Champion", 187, C.brass);
  shield(ctx, M, 255, 76, 86, C.brass);
  headline(ctx, assets, data.champion, M + 100, 360, 184, INNER - 100);
  font(ctx, assets, 500, 36);
  wrap(ctx, data.line, M, 432, INNER, 48, C.inkDim, 2);
  drawKicker(ctx, assets, data.fiveLabel, 548, C.inkFaint, 22);
  drawFive(ctx, assets, data.cards, 573, null);
  drawTiles(ctx, assets, data.tiles, 980, 170, 28);
  drawFoot(ctx, assets, data.foot);
}

export function drawMyNight(ctx: Ctx, data: MyNightData, assets: ShareAssets) {
  const ground = ctx.createLinearGradient(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ground.addColorStop(0, "#26221b");
  ground.addColorStop(0.45, C.board);
  ground.addColorStop(1, C.boardDeep);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  drawTop(ctx, assets, data.top);
  drawKicker(ctx, assets, data.title, 187, C.brass);
  headline(ctx, assets, data.finish, M, 305, 130, INNER);
  font(ctx, assets, 900, 72);
  const coins = `+${data.coins}`;
  text(ctx, coins, M, 405, { color: C.brass });
  const coinsWidth = ctx.measureText(coins).width;
  font(ctx, assets, 800, 34);
  text(ctx, "FLUT Coins", M + coinsWidth + 16, 405, { color: C.inkDim });
  drawTiles(ctx, assets, data.tiles, 467, 138, 28);
  drawKicker(ctx, assets, data.fiveLabel, 664, C.inkFaint, 22);
  drawFive(ctx, assets, data.cards, 689, data.best);
  const best = data.cards[data.best];
  if (best) {
    font(ctx, assets, 800, 22);
    text(ctx, `★ ${best.name} ${best.rating.toFixed(1)}`.toUpperCase(), M, 1118, {
      color: C.inkDim,
      track: 0.2,
      size: 22,
    });
    font(ctx, assets, 400, 40, true);
    wrap(ctx, data.bestLine, M, 1170, INNER, 46, C.ink, 2);
  }
  drawFoot(ctx, assets, data.foot);
}

/** Draws one image and returns it as a PNG. */
export async function renderShareImage(
  data: ShareImage,
  assets: ShareAssets,
  signal?: AbortSignal,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  let stage: ShareStage = "canvas-context";
  try {
    if (signal?.aborted) throw new DOMException("", "AbortError");
    canvas.width = SHARE_WIDTH;
    canvas.height = SHARE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D canvas.");
    stage = "draw";
    if (data.kind === "poster") drawPoster(ctx, data, assets);
    else drawMyNight(ctx, data, assets);
    stage = "png-export";
    return await bounded(
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob && blob.size ? resolve(blob) : reject(new Error("No image."))),
          "image/png",
        ),
      ),
      10_000,
      signal,
    );
  } catch (error) {
    if (!signal?.aborted) reportShareFailure(stage, data.kind, error);
    throw error;
  } finally {
    // Release the backing store, including failed/cancelled exports.
    canvas.width = 0;
    canvas.height = 0;
  }
}

// ---- colour helpers ---------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 100)}%)`;
}

/** `color-mix(in srgb, a share, b)`. */
function mix(a: string, b: string, share: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const at = (x: number, y: number) => Math.round(x * share + y * (1 - share));
  return `rgb(${at(r1, r2)} ${at(g1, g2)} ${at(b1, b2)})`;
}
