// Loads real KUT modules from src/ for design-only rendering, the same way
// design/features/build-assets.mjs does: TypeScript is transpiled in memory and
// "@/..." imports resolve into src/. Nothing here is imported by the app.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
export const React = require("react");
export const { renderToStaticMarkup } = require("react-dom/server");

export const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "../../..");
const cache = new Map();

export function sourceModule(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const compiled = { exports: {} };
  cache.set(filename, compiled.exports);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const localRequire = (name) => {
    const local = name.startsWith("@/") || name.startsWith(".");
    if (!local) return require(name);
    const base = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2))
      : path.resolve(path.dirname(filename), name);
    const target = [".tsx", ".ts"].map((ext) => base + ext).find((f) => fs.existsSync(f));
    if (!target) throw new Error(`Missing design source ${name}`);
    return sourceModule(target);
  };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename })(
    localRequire,
    compiled,
    compiled.exports,
  );
  cache.set(filename, compiled.exports);
  return compiled.exports;
}

export const src = (rel) => sourceModule(path.join(root, "src", rel));
