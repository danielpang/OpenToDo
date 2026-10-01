import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const shimPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "src/shims/node-sqlite-shim.cjs"
);

/**
 * Vite resolver shim for `node:sqlite`.
 *
 * `node:sqlite` (the `DatabaseSync` constructor used by better-auth and this
 * server's bootstrap DB) is a genuine Node 22 built-in at runtime
 * (`module.isBuiltin('node:sqlite') === true`; `require('node:sqlite')` works
 * under `/opt/node22/bin/node`), but Node 22.x does NOT list it in
 * `require('module').builtinModules`, so Vite 5.4's `isBuiltin` heuristic (which
 * keys off that list) fails to recognize it. Vite additionally normalizes the
 * `node:` prefix away to a bare `sqlite` specifier:
 *
 *   Error: Failed to load url sqlite (resolved id: sqlite). Does the file exist?
 *
 * This breaks static imports, dynamic `import('node:sqlite')`, and stripped
 * `sqlite` specifiers alike. We alias both `node:sqlite` and the normalized
 * `sqlite` to a CJS shim that `require("node:sqlite")`s at runtime, which Vite's
 * CJS loader leaves intact.
 */
export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "node:sqlite": shimPath,
      sqlite: shimPath,
    },
  },
});
