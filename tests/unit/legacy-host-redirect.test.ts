import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { BRAND } from "@/lib/brand";

// ADR-137 slice 3: kut.vibetrunk.com sends members on to flut.vibetrunk.com.
describe("legacy host redirect", () => {
  async function legacyRule() {
    const rules = (await nextConfig.redirects?.()) ?? [];
    const matching = rules.filter((rule) => rule.has?.some((item) => item.type === "host"));
    expect(matching).toHaveLength(1);
    // First, so a legacy request leaves the old host before any other rule.
    expect(rules[0]).toBe(matching[0]);
    return matching[0];
  }

  it("forwards every path on the legacy host to the public URL, temporarily for now", async () => {
    const rule = await legacyRule();
    expect(rule.source).toBe("/:path*");
    expect(rule.destination).toBe(`${BRAND.publicUrl}/:path*`);
    // 307 until the owner accepts the new domain (slice 5 makes it 308).
    expect(rule.permanent).toBe(false);
  });

  it("matches only the exact legacy host, as Next anchors it", async () => {
    const host = (await legacyRule()).has?.find((item) => item.type === "host");
    const matcher = new RegExp(`^${host?.value}$`);
    expect(matcher.test("kut.vibetrunk.com")).toBe(true);
    for (const other of [
      "flut.vibetrunk.com",
      "kutxvibetrunk.com",
      "kut.vibetrunk.com.attacker.example",
      "preview.kut.vibetrunk.com",
      "kut-git-feat-vibetrunk.vercel.app",
      "127.0.0.1",
      "localhost",
    ]) {
      expect(matcher.test(other), other).toBe(false);
    }
  });
});
