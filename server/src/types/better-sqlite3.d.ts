/**
 * Type declarations for `better-sqlite3`.
 *
 * The package ships no bundled typings and `@types/better-sqlite3` is not
 * installed in this workspace (no native builds / no network installs). These
 * declarations are narrow to the surface area the L1 backend actually uses so
 * the `tsc` build (`module: 'commonjs'`, `strict`) type-checks cleanly without
 * resorting to `any` or `// @ts-ignore`.
 */
declare module 'better-sqlite3' {
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | number[] | null;
  }

  export interface Statement {
    bind(...params: unknown[]): Statement;
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): Iterator<unknown>;
  }

  export default class Database {
    constructor(path: string | Buffer | number, options?: Record<string, unknown>);
    prepare(sql: string): Statement;
    exec(sql: string): Database;
    pragma(sql: string, ...params: unknown[]): Database;
    transaction<A extends unknown[], R>(
      fn: (...args: A) => R,
    ): (...args: A) => R;
    close(): Database;
  }
}
