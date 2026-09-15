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

export function validateBootstrapValues(values) {
  const mappings = [
    ["KUT_BACKUP_PASSPHRASE", "backup-encryption-v1"],
    ["KUT_HOSTED_DB_PASSWORD", "hosted-db-v1"],
  ];
  const missing = mappings.filter(([key]) => !values[key]).map(([key]) => key);
  if (missing.length)
    throw new Error(`Missing or empty bootstrap value(s): ${missing.join(", ")}.`);
  return mappings.map(([key, locator]) => ({ key, locator, value: values[key] }));
}
