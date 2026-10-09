import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * A minimal reader for `supabase/migrations`: every `create function` body
 * and the string literals inside it. It understands what our migrations use
 * (dollar-quoted bodies, `--` and block comments, `''` escapes, nested dollar
 * quotes), not all of PostgreSQL. Used by the FLUT copy guard (ADR-137).
 */

export type SqlFunction = {
  /** Qualified name and normalised argument list, e.g. `kut.open_pack(p_pack_id uuid)`. */
  key: string;
  file: string;
  body: string;
};

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");

/** Every function definition, oldest migration first, in file order. */
export function migrationFunctions(): SqlFunction[] {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const found: SqlFunction[] = [];
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    const head = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(/gi;
    for (let match = head.exec(sql); match; match = head.exec(sql)) {
      const open = match.index + match[0].length - 1;
      const close = matchingParen(sql, open);
      const args = sql
        .slice(open + 1, close)
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const as = /\bas\s+(\$[A-Za-z_]*\$)/gi;
      as.lastIndex = close;
      const tag = as.exec(sql);
      if (!tag) continue;
      const start = tag.index + tag[0].length;
      const end = sql.indexOf(tag[1], start);
      found.push({
        key: `${match[1].toLowerCase().replace(/"/g, "")}(${args})`,
        file,
        body: sql.slice(start, end),
      });
      head.lastIndex = end;
    }
  }
  return found;
}

/** The newest definition of each function: the last one in migration order. */
export function latestFunctions(): SqlFunction[] {
  const latest = new Map<string, SqlFunction>();
  for (const definition of migrationFunctions()) latest.set(definition.key, definition);
  return [...latest.values()];
}

/** The string literals in a function body, unescaped; comments are skipped. */
export function stringLiterals(body: string): string[] {
  const literals: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body.startsWith("--", i)) {
      const end = body.indexOf("\n", i);
      i = end === -1 ? body.length : end;
    } else if (body.startsWith("/*", i)) {
      const end = body.indexOf("*/", i + 2);
      i = end === -1 ? body.length : end + 2;
    } else if (body[i] === "'") {
      let value = "";
      i += 1;
      while (i < body.length) {
        if (body[i] === "'" && body[i + 1] === "'") {
          value += "'";
          i += 2;
        } else if (body[i] === "'") {
          i += 1;
          break;
        } else {
          value += body[i];
          i += 1;
        }
      }
      literals.push(value);
    } else if (body[i] === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(body.slice(i));
      if (tag) {
        const start = i + tag[0].length;
        const end = body.indexOf(tag[0], start);
        literals.push(body.slice(start, end === -1 ? body.length : end));
        i = end === -1 ? body.length : end + tag[0].length;
      } else {
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return literals;
}

function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}
