import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Shared with the deployment checker; reuse the installed official CLI only.
export function resolveVercelCli(root, env = process.env) {
  const packages = [path.join(root, "node_modules/vercel")];
  if (env.KUT_VERCEL_CLI_PATH)
    packages.unshift(path.resolve(path.dirname(env.KUT_VERCEL_CLI_PATH), ".."));
  if (env.APPDATA) packages.push(path.join(env.APPDATA, "npm/node_modules/vercel"));
  const cache =
    env.npm_config_cache ?? (env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, "npm-cache") : null);
  if (cache && existsSync(path.join(cache, "_npx"))) {
    for (const entry of readdirSync(path.join(cache, "_npx"), { withFileTypes: true })) {
      if (entry.isDirectory())
        packages.push(path.join(cache, "_npx", entry.name, "node_modules/vercel"));
    }
  }
  for (const directory of packages) {
    try {
      const metadata = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
      const cli = path.join(directory, "dist/vc.js");
      if (
        metadata.name === "vercel" &&
        metadata.version === "59.23.2" &&
        metadata.bin?.vercel === "./dist/vc.js" &&
        existsSync(cli)
      )
        return cli;
    } catch {
      /* A missing cache entry is not authentication evidence. */
    }
  }
  throw new Error("cli_unavailable");
}
