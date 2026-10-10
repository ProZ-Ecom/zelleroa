// Test-only resolver: maps the "@/..." alias to src/ and resolves extensionless imports to .ts/.js.
import { existsSync, statSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(import.meta.url), "../../src");

function tryFile(base) {
  for (const ext of ["", ".ts", ".js", "/index.ts", "/index.js"]) {
    const f = base + ext;
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (base) {
    const file = tryFile(base);
    if (file) return next(pathToFileURL(file).href, context);
  }
  try {
    return await next(specifier, context);
  } catch (err) {
    // CJS-style subpath imports such as "next/server" need the explicit extension under ESM.
    if (err?.code === "ERR_MODULE_NOT_FOUND" && /^[a-z@][^:]*\/[^.]+$/.test(specifier)) return next(specifier + ".js", context);
    throw err;
  }
}
