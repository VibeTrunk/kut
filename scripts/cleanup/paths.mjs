import fs from "node:fs";
import path from "node:path";

export function canonical(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) throw Error("absolute_path_required");
  // Reject traversal, device paths, ADS, wildcards and ambiguous Windows aliases.
  if (
    process.platform === "win32" &&
    value
      .split(/[\\/]/)
      .some((part) => /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(part))
  )
    throw Error("unsafe_path");
  if (
    value.split(/[\\/]/).some((part) => part === "." || part === ".." || /[. ]$/.test(part)) ||
    /[\x00-\x1f*?]/.test(value) ||
    (process.platform === "win32" && (!/^[A-Za-z]:[\\/]/.test(value) || /:/.test(value.slice(2))))
  )
    throw Error("unsafe_path");
  return path.resolve(value);
}

export const key = (value) => (process.platform === "win32" ? value.toLowerCase() : value);
export const same = (a, b) => key(a) === key(b);
export function within(parent, child) {
  return same(parent, child) || key(child).startsWith(key(parent) + path.sep);
}

export function exists(value) {
  try {
    fs.lstatSync(value);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// Check every component with lstat, not realpath alone. Never traverse a junction.
// The explicit leaf-link option is used only for the named borrowed node_modules.
export function noLinks(value, { missing = false, leafLink = false } = {}) {
  value = canonical(value);
  const root = path.parse(value).root;
  let current = root;
  const parts = path.relative(root, value).split(path.sep).filter(Boolean);
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    if (!exists(current)) {
      if (missing) return value;
      throw Error("missing_path");
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() && !(leafLink && index === parts.length - 1))
      throw Error("linked_path");
    if (index < parts.length - 1 && !stat.isDirectory()) throw Error("non_directory_parent");
  }
  return value;
}
