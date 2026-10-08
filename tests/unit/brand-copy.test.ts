import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";

/**
 * The old name stays out of the app (ADR-137). Comments are skipped: they may
 * still describe history ("KUT does not know…"). Everything else in `src/**`,
 * strings, JSX text and identifiers alike, must not say "KUT Coins",
 * "Kelderklasse", the old share filename or a standalone "KUT". Internal `kut`
 * names (the schema, `KUT_RELEASE_*`) are lower case or longer words and never
 * match.
 */
const SRC = path.resolve(import.meta.dirname, "../../src");

const OLD_NAMES = [/KUT Coins?/, /Kelderklasse/, /\bkut-midweek/, /\bKUT\b/];

/**
 * The one file that must spell the old server wording: the adapter's template
 * registry matches what the database stores. Only its string literals may.
 */
const REGISTRY = "lib/notification-copy.ts";

/** Exact snippets allowed to keep "KUT", each with the reason. */
const ALLOWED: { file: string; snippet: string; why: string }[] = [
  {
    file: "app/error.tsx",
    snippet: 'console.error("KUT route error"',
    why: "diagnostic prefix searched for in Vercel logs; never shown to members",
  },
  {
    file: "lib/midweek/share-draw.ts",
    snippet: 'console.warn("KUT share image"',
    why: "diagnostic prefix of the share-image fallback warning; never shown to members",
  },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

/** The file with every comment blanked out, positions kept. */
function withoutComments(file: string, text: string): string {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ranges: ts.CommentRange[] = [];
  const visit = (node: ts.Node) => {
    ranges.push(...(ts.getLeadingCommentRanges(text, node.pos) ?? []));
    ranges.push(...(ts.getTrailingCommentRanges(text, node.end) ?? []));
    node.getChildren(source).forEach(visit);
  };
  visit(source);
  const chars = text.split(""); // UTF-16 units, as the parser counts
  for (const { pos, end } of ranges) for (let i = pos; i < end; i += 1) chars[i] = " ";
  return chars.join("");
}

describe("the FLUT name in src (ADR-137)", () => {
  const files = sourceFiles(SRC).map((full) => ({
    file: path.relative(SRC, full).replaceAll("\\", "/"),
    code: withoutComments(full, readFileSync(full, "utf8")),
  }));

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("keeps the old name out of everything members can read", () => {
    const hits = files.flatMap(({ file, code }) =>
      code.split("\n").flatMap((line, index) => {
        if (file === REGISTRY) return [];
        if (!OLD_NAMES.some((name) => name.test(line))) return [];
        if (ALLOWED.some((allowed) => allowed.file === file && line.includes(allowed.snippet))) {
          return [];
        }
        return [`src/${file}:${index + 1}: ${line.trim()}`];
      }),
    );
    expect(hits).toEqual([]);
  });

  it("keeps the registry's old wording inside its template strings", () => {
    const registry = files.find(({ file }) => file === REGISTRY)?.code ?? "";
    expect(registry).toContain("KUT Coins");
    const outsideStrings = registry.replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
    expect(OLD_NAMES.filter((name) => name.test(outsideStrings))).toEqual([]);
  });

  it("keeps every allowlist entry live", () => {
    for (const { file, snippet } of ALLOWED) {
      expect(files.find((source) => source.file === file)?.code).toContain(snippet);
    }
  });

  it("spells the brand as design/flut/HANDOFF.md does", () => {
    expect(BRAND).toEqual({
      shortName: "FLUT",
      fullName: "Football League Ultimate Team",
      currency: "FLUT Coins",
      unit: "FLUT",
      publicUrl: "https://flut.vibetrunk.com",
    });
  });
});
