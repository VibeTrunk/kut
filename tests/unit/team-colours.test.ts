import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The team-colour tokens (design/mm2-dr3/HANDOFF.md §5, ADR-119): every check
// DR3's contrast table makes, read from globals.css so a later tweak can't
// silently drop a side's names below AA.

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string): string {
  const match = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!match) throw new Error(`no --color-${name} in globals.css`);
  return match[1];
}

type Rgb = readonly [number, number, number];

const rgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;

/** `top` at `alpha` over `bottom`, as `bg-team-*-bg/55` paints a lane. */
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  top.map((c, i) => c * alpha + bottom[i] * (1 - alpha)) as unknown as Rgb;

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const board = rgb(token("board"));
const panel = rgb(token("panel"));
const panel2 = rgb(token("panel-2"));

describe("team colours (DR3-10, violet and teal)", () => {
  it("carries DR3's drop-in values", () => {
    expect([
      token("team-0"),
      token("team-0-fill"),
      token("team-0-bg"),
      token("team-0-line"),
    ]).toEqual(["#9e80d1", "#6f4fa1", "#181322", "#423658"]);
    expect([
      token("team-1"),
      token("team-1-fill"),
      token("team-1-bg"),
      token("team-1-line"),
    ]).toEqual(["#4fb3a0", "#1f7a6c", "#0e1f1c", "#23514a"]);
  });

  it.each([0, 1])(
    "side %i's text tone is AA (4.5:1) on board, panel, panel-2 and its lane",
    (side) => {
      const text = rgb(token(`team-${side}`));
      const lane = over(rgb(token(`team-${side}-bg`)), 0.55, board);
      for (const ground of [board, panel, panel2, lane]) {
        expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each([0, 1])("side %i's fill carries its light ink at AA, for the scored kicks", (side) => {
    expect(
      contrast(rgb(token(`ink-on-team-${side}`)), rgb(token(`team-${side}-fill`))),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the fills at the graphics contrast DR3 accepted: teal 3:1, violet within the 2.9 stretch", () => {
    const lane0 = over(rgb(token("team-0-bg")), 0.55, board);
    const lane1 = over(rgb(token("team-1-bg")), 0.55, board);
    for (const ground of [board, lane1])
      expect(contrast(rgb(token("team-1-fill")), ground)).toBeGreaterThanOrEqual(3);
    for (const ground of [board, lane0])
      expect(contrast(rgb(token("team-0-fill")), ground)).toBeGreaterThanOrEqual(2.85);
  });

  it("gives Live its own tokens, so it no longer shares a side's colour (DR3-3)", () => {
    expect(token("live")).toBe("#ff8091");
    expect([token("live-bg"), token("live-line")]).toEqual(["#331419", "#7a2d3b"]);
    for (const side of [0, 1]) {
      expect(token(`team-${side}`)).not.toBe(token("live"));
      expect(token(`team-${side}-bg`)).not.toBe(token("live-bg"));
    }
  });

  it("leaves no use of the old blue and red token names in src", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && /team-(blue|red)/.test(readFileSync(path, "utf8")))
          hits.push(path);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});
