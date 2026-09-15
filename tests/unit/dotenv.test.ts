import { describe, expect, it } from "vitest";
import { parseDotenv, validateBootstrapValues } from "../../scripts/lib/dotenv.mjs";

describe("dotenv bootstrap parser", () => {
  it("handles BOM, CRLF/LF, comments, Unicode, spaces, equals, and empty values", () => {
    expect(
      parseDotenv(
        '\uFEFFPLAIN=value\r\nSPACED = unquoted value  \nEQUALS=a=b=c\nHASH=value # comment\nINLINE_HASH=value#comment\nUNICODE="voetbal ⚽"\nEMPTY=\n',
      ),
    ).toEqual({
      PLAIN: "value",
      SPACED: "unquoted value",
      EQUALS: "a=b=c",
      HASH: "value",
      INLINE_HASH: "value",
      UNICODE: "voetbal ⚽",
      EMPTY: "",
    });
  });

  it("preserves quoted whitespace, hash, equals, escaped and literal quotes", () => {
    expect(parseDotenv(`A="  x#=y  "\nB='single # = value'\nC=he"llo\nD="say \\"hi\\""`)).toEqual({
      A: "  x#=y  ",
      B: "single # = value",
      C: 'he"llo',
      D: 'say "hi"',
    });
  });

  it("uses the last duplicate value", () => {
    expect(parseDotenv("A=first\nA=second\n")).toEqual({ A: "second" });
  });

  it.each(["NO_EQUALS", "1BAD=value", 'A="never closed', 'A="ok" junk'])(
    "rejects malformed input %s",
    (source) => expect(() => parseDotenv(source)).toThrow(),
  );

  it("keeps parsing separate from required-value validation", () => {
    expect(parseDotenv("OPTIONAL=\n")).toEqual({ OPTIONAL: "" });
    expect(() => validateBootstrapValues({ KUT_BACKUP_PASSPHRASE: "only-one" })).toThrow(
      /KUT_HOSTED_DB_PASSWORD/,
    );
  });

  it("maps required values to stable nonsecret locators", () => {
    expect(
      validateBootstrapValues({
        KUT_BACKUP_PASSPHRASE: "passphrase",
        KUT_HOSTED_DB_PASSWORD: "database-password",
      }).map(({ key, locator }) => ({ key, locator })),
    ).toEqual([
      { key: "KUT_BACKUP_PASSPHRASE", locator: "backup-encryption-v1" },
      { key: "KUT_HOSTED_DB_PASSWORD", locator: "hosted-db-v1" },
    ]);
  });
});
