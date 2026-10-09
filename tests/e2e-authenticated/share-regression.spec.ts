import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertLocalTarget } from "../support/local-target";
import {
  advanceFixtureEvening,
  COMPLETED_WEEK,
  endFixtureEvening,
  FIXTURE_PHOTO,
  startFixtureEvening,
} from "./midweek-fixture";

async function database(work: (client: Client) => Promise<void>) {
  const url = process.env.DB_URL;
  if (!url) throw new Error("DB_URL required");
  assertLocalTarget(url, "DB_URL");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await work(client);
  } finally {
    await client.end();
  }
}

async function signIn(page: Page, username = "release_member") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("fictional-release-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
}

async function previews(page: Page, count = 2) {
  const images = page.locator("#share img");
  await expect(images).toHaveCount(count, { timeout: 20_000 });
  for (const img of await images.all()) {
    await expect
      .poll(() => img.evaluate((node: HTMLImageElement) => [node.naturalWidth, node.naturalHeight]))
      .toEqual([1080, 1350]);
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
}

async function tileGeometry(page: Page) {
  await expect(page.locator("#share ul > li").first()).toBeVisible();
  const boxes = await page.locator("#share ul > li").evaluateAll((items) =>
    items.map((item) =>
      [...item.children].map((row) => {
        const box = row.getBoundingClientRect();
        return { top: box.top, width: box.width, height: box.height };
      }),
    ),
  );
  for (const rows of boxes) expect(rows[0].width / rows[0].height).toBeCloseTo(4 / 5, 2);
  if (page.viewportSize()!.width >= 640 && boxes.length === 2) {
    expect(Math.abs(boxes[0][0].width - boxes[1][0].width)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[0][0].height - boxes[1][0].height)).toBeLessThanOrEqual(1);
    for (let row = 0; row < 5; row++)
      expect(Math.abs(boxes[0][row].top - boxes[1][row].top)).toBeLessThanOrEqual(1);
  }
  await noOverflow(page);
}

test.afterEach(async () => {
  await database(endFixtureEvening);
});

for (const version of ["older", "newer"] as const) {
  test(`${version} completed week exports with photos, rejected fonts and no roundRect`, async ({
    page,
  }) => {
    let week = COMPLETED_WEEK;
    if (version === "newer")
      await database(async (client) => {
        week = (await startFixtureEvening(client)).weekStart;
        await advanceFixtureEvening(client, 180, { runWorker: true });
      });
    await page.addInitScript(() => {
      Object.defineProperty(CanvasRenderingContext2D.prototype, "roundRect", { value: undefined });
      Object.defineProperty(Object.getPrototypeOf(document.fonts), "load", {
        configurable: true,
        value: () =>
          Promise.reject(new TypeError("private name and signed URL must never be logged")),
      });
      const records: unknown[] = [];
      Object.assign(window, { __shareDiagnostics: records });
      window.addEventListener("kut:share-diagnostic", (event) =>
        records.push((event as CustomEvent).detail),
      );
    });
    // Real CORS-fetched photo from the suite's local Storage fixture.
    await database(async (client) => {
      await client.query(
        "update kut.players set photo_path = $1 where id = '00000097-0000-4000-8000-000000010005'",
        [FIXTURE_PHOTO],
      );
    });
    try {
      await signIn(page);
      await page.goto(`/midweek/${week}`);
      await previews(page);
      const diagnostics = await page.evaluate(
        () => (window as unknown as { __shareDiagnostics: unknown[] }).__shareDiagnostics,
      );
      expect(diagnostics).toEqual(
        expect.arrayContaining([
          { stage: "fonts", kind: "poster", errorName: "TypeError", recovery: "fallback" },
          { stage: "fonts", kind: "night", errorName: "TypeError", recovery: "fallback" },
        ]),
      );
      expect(JSON.stringify(diagnostics)).not.toContain("private");
      await noOverflow(page);
    } finally {
      await database(async (client) => {
        await client.query(
          "update kut.players set photo_path = null where id = '00000097-0000-4000-8000-000000010005'",
        );
      });
    }
  });
}

test("hung fonts and failed photos still export using fallbacks", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(document.fonts), "load", {
      configurable: true,
      value: () => new Promise(() => {}),
    });
  });
  await page.route("**/storage/v1/**", (route) => route.abort());
  await database(async (client) => {
    await client.query(
      "update kut.players set photo_path = 'players/missing/profile.webp' where id = '00000097-0000-4000-8000-000000010005'",
    );
  });
  try {
    await signIn(page);
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await previews(page);
  } finally {
    await database(async (client) => {
      await client.query(
        "update kut.players set photo_path = null where id = '00000097-0000-4000-8000-000000010005'",
      );
    });
  }
});

for (const stage of ["canvas-context", "draw", "png-export", "png-timeout"] as const) {
  test(`${stage} failure is sanitized, isolated and retryable`, async ({ page }) => {
    test.fixme(
      process.platform === "linux",
      "KB-041 (#215): without Arial the font load fails too, adding a `fonts` diagnostic",
    );
    await page.addInitScript((stage) => {
      let fail = true;
      const records: unknown[] = [];
      Object.assign(window, {
        __shareDiagnostics: records,
        __recoverShare: () => {
          fail = false;
        },
      });
      window.addEventListener("kut:share-diagnostic", (event) =>
        records.push((event as CustomEvent).detail),
      );
      if (stage === "canvas-context") {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          ...args: Parameters<typeof original>
        ) {
          if (fail && this.width === 1080) {
            fail = false;
            return null;
          }
          return original.apply(this, args);
        } as typeof original;
      } else if (stage === "draw") {
        const original = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (...args) {
          if (fail && args[0] === "CHAMPION") throw new TypeError("sensitive detail");
          original.apply(this, args);
        };
      } else {
        const original = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function (...args) {
          if (fail && this.width === 1080) {
            fail = false;
            if (stage !== "png-timeout") args[0](null);
            return;
          }
          original.apply(this, args);
        };
      }
    }, stage);
    await signIn(page);
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    const failed = page
      .locator("#share li")
      .filter({ has: page.getByRole("button", { name: "Retry", exact: true }) });
    await expect(failed).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator("#share img")).toHaveCount(1);
    await expect(
      page
        .locator("#share li")
        .filter({ has: page.locator("img") })
        .getByRole("button", { name: "Save image" }),
    ).toBeEnabled();
    const diagnostic = await page.evaluate(
      () => (window as unknown as { __shareDiagnostics: unknown[] }).__shareDiagnostics,
    );
    expect(diagnostic).toEqual([
      {
        stage: stage === "png-timeout" ? "png-export" : stage,
        kind: expect.stringMatching(/^(poster|night)$/),
        errorName:
          stage === "draw" ? "TypeError" : stage === "png-timeout" ? "TimeoutError" : "Error",
        recovery: "failed",
      },
    ]);
    await tileGeometry(page);
    await page.evaluate(() =>
      (window as unknown as { __recoverShare: () => void }).__recoverShare(),
    );
    await failed.getByRole("button", { name: "Retry", exact: true }).click();
    await previews(page);
    await expect(page.getByText("Couldn’t make the image. Try again.")).toHaveCount(0);
  });
}

test("file sharing, cancellation, action errors and download fallback", async ({ page }) => {
  await page.addInitScript(() => {
    let mode = "abort";
    Object.assign(window, {
      __shareMode: (value: string) => {
        mode = value;
      },
      __sharedPng: null,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => mode !== "download",
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ files }: { files: File[] }) => {
        if (mode === "abort") throw new DOMException("", "AbortError");
        if (mode === "error") throw new DOMException("private", "NotAllowedError");
        Object.assign(window, {
          __sharedPng: { name: files[0].name, type: files[0].type, bytes: files[0].size },
        });
      },
    });
  });
  await signIn(page);
  await page.goto(`/midweek/${COMPLETED_WEEK}`);
  await previews(page);
  const tile = page.locator("#share li").first();
  const share = tile.getByRole("button", { name: "Share", exact: true });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(tile.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { __shareMode: (value: string) => void }).__shareMode("error"),
  );
  await share.click();
  await expect(tile.getByRole("alert")).toHaveText(
    "Couldn’t send the image. Try again or save it.",
  );
  await expect(tile.getByRole("img")).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __shareMode: (value: string) => void }).__shareMode("success"),
  );
  await share.click();
  await expect(tile.getByText("Shared.", { exact: true })).toBeVisible();
  const shared = await page.evaluate(
    () =>
      (window as unknown as { __sharedPng: { name: string; type: string; bytes: number } })
        .__sharedPng,
  );
  expect(shared).toEqual({
    name: "flut-midweek-17-jan-champion.png",
    type: "image/png",
    bytes: expect.any(Number),
  });
  expect(shared.bytes).toBeGreaterThan(0);
  await page.evaluate(() =>
    (window as unknown as { __shareMode: (value: string) => void }).__shareMode("download"),
  );
  const download = page.waitForEvent("download");
  await share.click();
  expect((await download).suggestedFilename()).toBe("flut-midweek-17-jan-champion.png");
  await tileGeometry(page);
});

// Each case owns its page and completed evening. Keep the same assertions and
// preview deadline; splitting the navigation budget does not repair Topic A.
for (const long of [false, true])
  for (const surface of ["week", "index"] as const)
    for (const width of [320, 412, 640, 1280]) {
      test(`share rows and rating links align: ${surface}, ${width}px, ${long ? "long" : "short"} names`, async ({
        page,
      }) => {
        test.setTimeout(90_000);
        let week = "";
        await database(async (client) => {
          week = (await startFixtureEvening(client)).weekStart;
          await advanceFixtureEvening(client, 180, { runWorker: true });
        });
        const originals: { id: string; display_name: string }[] = [];
        try {
          await database(async (client) => {
            originals.push(
              ...(
                await client.query(
                  "select p.id, p.display_name from kut.profiles p join kut.midweek_entries e on e.user_id=p.id join kut.midweek_tournaments t on t.id=e.tournament_id where t.week_start=$1",
                  [week],
                )
              ).rows,
            );
            for (const row of originals)
              await client.query("update kut.profiles set display_name = $2 where id = $1", [
                row.id,
                long ? "An exceptionally long fictional opponent name without truncation" : "A",
              ]);
          });
          await signIn(page);
          const route = surface === "week" ? `/midweek/${week}` : "/midweek";
          await page.setViewportSize({ width, height: 900 });
          await page.goto(route);
          await previews(page);
          await tileGeometry(page);
          const download = page.waitForEvent("download");
          await page
            .locator("#share li")
            .first()
            .getByRole("button", { name: "Save image" })
            .click();
          await download;
          await tileGeometry(page);
          const block = page.locator("#ratings");
          const toggle = block.getByRole("button", { name: /^(Show|Hide) each match$/ });
          if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "true");
          const lists = await block.locator("ul:visible").evaluateAll((nodes) =>
            nodes.map((list) =>
              [...list.querySelectorAll("a")].map((link) => {
                const box = link.getBoundingClientRect();
                const disc = link.children[1].getBoundingClientRect();
                const arrow = link.children[2].getBoundingClientRect();
                return {
                  width: box.width,
                  height: box.height,
                  disc: disc.right,
                  arrow: arrow.right,
                  top: box.top,
                  href: link.getAttribute("href"),
                  label: link.textContent,
                };
              }),
            ),
          );
          expect(lists).toHaveLength(5);
          for (const rows of lists)
            for (const row of rows) {
              expect(Math.abs(row.width - rows[0].width)).toBeLessThanOrEqual(1);
              expect(Math.abs(row.disc - rows[0].disc)).toBeLessThanOrEqual(1);
              expect(Math.abs(row.arrow - rows[0].arrow)).toBeLessThanOrEqual(1);
              expect(row.height).toBeGreaterThanOrEqual(44);
              expect(row.href).toMatch(new RegExp(`^/midweek/${week}/match/[0-9a-f-]{36}$`));
              if (long)
                expect(row.label).toContain(
                  "An exceptionally long fictional opponent name without truncation",
                );
            }
          if (width >= 1024)
            expect(
              Math.max(...lists.map((rows) => rows[0].top)) -
                Math.min(...lists.map((rows) => rows[0].top)),
            ).toBeLessThanOrEqual(1);
          await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await expect(block.locator("ul:visible")).toHaveCount(0);
          await noOverflow(page);
        } finally {
          await database(async (client) => {
            for (const row of originals)
              await client.query("update kut.profiles set display_name = $2 where id = $1", [
                row.id,
                row.display_name,
              ]);
          });
        }
      });
    }

test("poster-only layout and loading rows stay aligned", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(document.fonts), "load", {
      configurable: true,
      value: () => new Promise(() => {}),
    });
  });
  await signIn(page, "release_admin");
  for (const width of [320, 412, 640, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/midweek/${COMPLETED_WEEK}`);
    await expect(page.locator("#share li")).toHaveCount(1);
    await tileGeometry(page);
    await previews(page, 1);
    await tileGeometry(page);
  }
});

test("desktop rows align through loading, isolated failure, retry and feedback", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    let waiting = true;
    let fail = true;
    const pending: (() => void)[] = [];
    Object.defineProperty(Object.getPrototypeOf(document.fonts), "load", {
      configurable: true,
      value: () =>
        waiting ? new Promise<void>((resolve) => pending.push(resolve)) : Promise.resolve(),
    });
    Object.assign(window, {
      __releaseFonts: () => {
        waiting = false;
        pending.splice(0).forEach((finish) => finish());
      },
    });
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      if (fail && this.width === 1080) {
        fail = false;
        args[0](null);
        return;
      }
      original.apply(this, args);
    };
  });
  let week = "";
  const originals: { id: string; display_name: string }[] = [];
  await database(async (client) => {
    week = (await startFixtureEvening(client)).weekStart;
    await advanceFixtureEvening(client, 180, { runWorker: true });
    originals.push(
      ...(
        await client.query(
          "select p.id, p.display_name from kut.profiles p join kut.midweek_entries e on e.user_id=p.id join kut.midweek_tournaments t on t.id=e.tournament_id where t.week_start=$1",
          [week],
        )
      ).rows,
    );
  });
  await signIn(page);
  try {
    for (const long of [false, true]) {
      await database(async (client) => {
        for (const row of originals)
          await client.query("update kut.profiles set display_name=$2 where id=$1", [
            row.id,
            long ? "An exceptionally long fictional champion name wrapping across lines" : "A",
          ]);
      });
      for (const width of [640, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/midweek/${week}`);
        await expect(page.locator("#share li")).toHaveCount(2);
        await expect(page.getByText("Drawing…", { exact: true })).toHaveCount(2);
        await tileGeometry(page);
        await page.evaluate(() =>
          (window as unknown as { __releaseFonts: () => void }).__releaseFonts(),
        );
        const retry = page.getByRole("button", { name: "Retry", exact: true });
        await expect(retry).toBeVisible();
        await expect(page.locator("#share img")).toHaveCount(1);
        await tileGeometry(page);
        await retry.click();
        await previews(page);
        await tileGeometry(page);
        const download = page.waitForEvent("download");
        await page.locator("#share li").first().getByRole("button", { name: "Save image" }).click();
        await download;
        await tileGeometry(page);
        if (long && width === 1280)
          await page.screenshot({
            path: `test-results/share-desktop-${test.info().project.name}.png`,
            fullPage: true,
          });
      }
    }
  } finally {
    await database(async (client) => {
      for (const row of originals)
        await client.query("update kut.profiles set display_name=$2 where id=$1", [
          row.id,
          row.display_name,
        ]);
    });
  }
});

for (const delayed of [false, true]) {
  test(`bitmap, canvas and URL cleanup${delayed ? " after cancellation during decode" : " after rendering and navigation"}`, async ({
    page,
  }) => {
    await page.addInitScript((delayed) => {
      const stats = {
        opened: 0,
        closed: 0,
        activeUrls: 0,
        canvases: [] as HTMLCanvasElement[],
        pending: [] as (() => void)[],
      };
      Object.assign(window, {
        __shareResources: stats,
        __finishBitmaps: () => stats.pending.splice(0).forEach((finish) => finish()),
      });
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      const urls = new Set<string>();
      URL.createObjectURL = (blob) => {
        const url = create(blob);
        urls.add(url);
        stats.activeUrls = urls.size;
        return url;
      };
      URL.revokeObjectURL = (url) => {
        urls.delete(url);
        stats.activeUrls = urls.size;
        revoke(url);
      };
      const bitmap = window.createImageBitmap.bind(window);
      window.createImageBitmap = (async (...args: Parameters<typeof bitmap>) => {
        const result = await bitmap(...args);
        stats.opened++;
        const close = result.close.bind(result);
        result.close = () => {
          stats.closed++;
          close();
        };
        if (delayed) await new Promise<void>((resolve) => stats.pending.push(resolve));
        return result;
      }) as typeof bitmap;
      const context = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        ...args: Parameters<typeof context>
      ) {
        if (this.width === 1080) stats.canvases.push(this);
        return context.apply(this, args);
      } as typeof context;
    }, delayed);
    await database(async (client) => {
      await client.query(
        "update kut.players set photo_path=$1 where id='00000097-0000-4000-8000-000000010005'",
        [FIXTURE_PHOTO],
      );
    });
    try {
      await signIn(page);
      await page.goto(`/midweek/${COMPLETED_WEEK}`);
      if (!delayed) await previews(page);
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { __shareResources: { opened: number } }).__shareResources
                .opened,
          ),
        )
        .toBe(2);
      await page.getByRole("link", { name: "How ratings work →" }).click();
      await expect(page).toHaveURL(/how-it-works/);
      if (delayed)
        await page.evaluate(() =>
          (window as unknown as { __finishBitmaps: () => void }).__finishBitmaps(),
        );
      await expect
        .poll(() =>
          page.evaluate(() => {
            const stats = (
              window as unknown as {
                __shareResources: {
                  opened: number;
                  closed: number;
                  activeUrls: number;
                  canvases: HTMLCanvasElement[];
                };
              }
            ).__shareResources;
            return {
              opened: stats.opened,
              closed: stats.closed,
              activeUrls: stats.activeUrls,
              releasedCanvases: stats.canvases.every(
                (canvas) => canvas.width === 0 && canvas.height === 0,
              ),
            };
          }),
        )
        .toEqual({ opened: 2, closed: 2, activeUrls: 0, releasedCanvases: true });
    } finally {
      await database(async (client) => {
        await client.query(
          "update kut.players set photo_path=null where id='00000097-0000-4000-8000-000000010005'",
        );
      });
    }
  });
}
