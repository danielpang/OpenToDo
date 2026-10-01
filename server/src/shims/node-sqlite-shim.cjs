/* eslint-disable */
/**
 * CJS shim for `node:sqlite` (`DatabaseSync`).
 *
 * WHY THIS EXISTS: Node v22.x exposes `node:sqlite` (and therefore
 * `DatabaseSync`) as a *real* built-in at runtime — `module.isBuiltin('node:sqlite')`
 * is `true` and `require('node:sqlite').DatabaseSync` works under
 * `/opt/node22/bin/node`. However Node v22.x does NOT list `sqlite`/`node:sqlite`
 * in `require('module').builtinModules`, so Vite 5.4's `isBuiltin` heuristic
 * (which keys off that list) fails to recognize it. Vite additionally
 * normalizes the `node:` prefix away to a bare `sqlite` specifier, after which it
 * cannot resolve the module and throws:
 *
 *   Error: Failed to load url sqlite (resolved id: sqlite). Does the file exist?
 *
 * This happens for BOTH static imports and `await import(...)` arguments, so it
 * would break `better-auth/test`'s `await import("node:sqlite")` as well.
 *
 * FIX: `resolve.alias` in `vitest.config.ts` (and the Vite config if present)
 * maps both `node:sqlite` and the normalized `sqlite` to this file. Vite's CJS
 * loader transpiles `.cjs` for SSR but does NOT statically resolve/rewrite
 * `require(...)` calls, so `require("node:sqlite")` is left intact and resolved
 * by Node at runtime, where it works.
 */
const { DatabaseSync } = require("node:sqlite");

module.exports = { DatabaseSync };
