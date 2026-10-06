import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

describe("production dependency security patches", () => {
  it("loads native image processing and rasterizes SVG with patched librsvg", async () => {
    const rsvg = sharp.versions.rsvg;
    assert.ok(rsvg, "Native image build must include librsvg");
    const [major, minor, patch] = rsvg.split(".").map(Number);
    expect(major > 2 || (major === 2 && (minor > 63 || (minor === 63 && patch >= 2)))).toBe(true);
    const png = await sharp({
      create: { width: 8, height: 8, channels: 4, background: "#336699" },
    })
      .png()
      .toBuffer();
    const { info } = await sharp(png).resize(4, 4).webp().toBuffer({ resolveWithObject: true });
    expect(info).toMatchObject({ width: 4, height: 4, format: "webp" });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="red"/></svg>',
    );
    const raster = await sharp(svg).png().toBuffer();
    expect(await sharp(raster).metadata()).toMatchObject({ width: 4, height: 4, format: "png" });
  });

  it("handles valid maps and bounds hostile indexed offsets in a deadline-limited child", () => {
    // Isolate the blocking regression: an old library must not hang Vitest.
    // This child sees only fictional inputs, never fixture rows or credentials.
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `
          const assert = require('node:assert/strict');
          const { SourceMapGenerator, SourceMapConsumer, SourceNode } = require('source-map-js');
          const map = new SourceMapGenerator({ file: 'fixture.js' });
          map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: 'fictional.js' });
          map.setSourceContent('fictional.js', 'fixture');
          const plain = JSON.parse(map.toString());
          assert.equal(new SourceMapConsumer(plain).originalPositionFor({ line: 1, column: 0 }).source, 'fictional.js');
          const indexed = line => new SourceMapConsumer({ version: 3, sections: [{ offset: { line, column: 0 }, map: plain }] });
          assert.throws(() => indexed(1000000000), /Section offset line must not exceed/);
          assert.equal(SourceNode.fromStringWithSourceMap('fixture', indexed(10000000)).toString(), 'fixture');
        `,
      ],
      { cwd: path.resolve(root), timeout: 5000, stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(
      child.error,
      undefined,
      "Indexed source-map child failed or exceeded its deadline",
    );
    assert.equal(child.signal, null, "Indexed source-map child was terminated");
    assert.equal(child.status, 0, "Valid mapping or hostile offset regression failed");
  }, 10000);
});
