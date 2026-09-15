export function parseDotenv(source) {
  const values = {};
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (const [zeroIndex, original] of text.split("\n").entries()) {
    const lineNumber = zeroIndex + 1;
    let line = original.trimStart();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trimStart();

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match) throw new Error(`Malformed dotenv assignment on line ${lineNumber}.`);
    const key = match[1];
    let remainder = line.slice(match[0].length).trimStart();
    let value;

    if (remainder.startsWith('"') || remainder.startsWith("'")) {
      const quote = remainder[0];
      let result = "";
      let closedAt = -1;
      for (let index = 1; index < remainder.length; index++) {
        const character = remainder[index];
        if (character === quote && remainder[index - 1] !== "\\") {
          closedAt = index;
          break;
        }
        if (quote === '"' && character === "\\" && index + 1 < remainder.length) {
          const escaped = remainder[++index];
          result += escaped === "n" ? "\n" : escaped === "r" ? "\r" : escaped;
        } else {
          result += character;
        }
      }
      if (closedAt === -1) throw new Error(`Unclosed quoted value on line ${lineNumber}.`);
      const trailing = remainder.slice(closedAt + 1).trim();
      if (trailing && !trailing.startsWith("#")) {
        throw new Error(`Unexpected text after quoted value on line ${lineNumber}.`);
      }
      value = result;
    } else {
      const commentIndex = remainder.indexOf("#");
      if (commentIndex !== -1) remainder = remainder.slice(0, commentIndex);
      value = remainder.trimEnd();
    }
    values[key] = value;
  }
  return values;
}

// Each locator names the canonical `.env.local` key first. Later entries are
// accepted spellings that predate `.env.example`: operator files already
// carried `KUT_SUPABASE_DB_PASSWORD` before the bootstrap existed, and making
// someone hand-edit a secrets file to satisfy a rename is a worse failure mode
// than accepting both.
const BOOTSTRAP_MAPPINGS = [
  { locator: "backup-encryption-v1", keys: ["KUT_BACKUP_PASSPHRASE"] },
  { locator: "hosted-db-v1", keys: ["KUT_HOSTED_DB_PASSWORD", "KUT_SUPABASE_DB_PASSWORD"] },
];

export function validateBootstrapValues(values) {
  const resolved = [];
  const missing = [];

  for (const { locator, keys } of BOOTSTRAP_MAPPINGS) {
    const present = keys.filter((key) => values[key]);
    if (present.length === 0) {
      missing.push(keys.length === 1 ? keys[0] : `${keys[0]} (or ${keys.slice(1).join(", ")})`);
      continue;
    }
    // Two spellings holding different secrets is unresolvable: picking either
    // could store the wrong password under a locator nothing would re-check.
    const distinct = new Set(present.map((key) => values[key]));
    if (distinct.size > 1) {
      throw new Error(
        `Conflicting bootstrap values: ${present.join(" and ")} are both set to different values. ` +
          `Remove all but ${keys[0]}.`,
      );
    }
    resolved.push({ key: present[0], locator, value: values[present[0]] });
  }

  if (missing.length)
    throw new Error(`Missing or empty bootstrap value(s): ${missing.join(", ")}.`);
  return resolved;
}
