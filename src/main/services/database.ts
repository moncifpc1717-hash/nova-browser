/**
 * Database — the single SQLite instance backing all of Nova's persistent state.
 *
 * We use sql.js (SQLite compiled to WebAssembly) rather than a native binding.
 * Rationale: it needs no per-platform native compilation, ships identically on
 * Windows/macOS/Linux, and is more than fast enough for browser metadata
 * (history, bookmarks, vault, memory). The tradeoff is that the DB lives in
 * memory and must be flushed to disk explicitly — we do that debounced after
 * writes and synchronously on quit.
 */
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import initSqlJs from 'sql.js'

/**
 * Derive the sql.js types from the init function's return value rather than
 * importing named exports. This is robust against the exact shape of
 * `@types/sql.js` (which has varied across versions) — we only depend on
 * `initSqlJs` being callable, which its public API guarantees.
 */
type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>
type SqlJsDatabase = InstanceType<SqlJsStatic['Database']>

const SCHEMA = `
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon TEXT,
  visited_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_visited ON history(visited_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  favicon TEXT,
  folder TEXT NOT NULL DEFAULT 'Bookmarks',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vault (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  username TEXT NOT NULL,
  secret TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memory (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

export class Database {
  private db!: SqlJsDatabase
  private dbPath: string
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    const dir = join(app.getPath('userData'), 'nova-data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.dbPath = join(dir, 'nova.sqlite')
  }

  /** Load the WASM engine, restore the file from disk, and ensure the schema. */
  async init(): Promise<void> {
    // Resolve the .wasm shipped alongside the sql.js package. `locateFile`
    // lets sql.js find its binary regardless of the app's cwd.
    const SQL = await initSqlJs({
      locateFile: (file: string) => {
        // sql.js ships its .wasm next to dist/sql-wasm.js; resolve relative to it.
        const base = require.resolve('sql.js/dist/sql-wasm.js')
        return join(base, '..', file)
      }
    })
    this.db = existsSync(this.dbPath)
      ? new SQL.Database(readFileSync(this.dbPath))
      : new SQL.Database()
    this.db.run(SCHEMA)
    this.flush()
  }

  /** Run a statement with positional params and no result set. */
  run(sql: string, params: unknown[] = []): void {
    this.db.run(sql, params as never)
    this.scheduleFlush()
  }

  /** Run a query and return rows as plain objects. */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql)
    stmt.bind(params as never)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    stmt.free()
    return rows
  }

  /** Convenience for reading a single scalar/row. */
  get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const rows = this.query<T>(sql, params)
    return rows[0] ?? null
  }

  /** Persist the in-memory DB to disk immediately. */
  flush(): void {
    const data = this.db.export()
    writeFileSync(this.dbPath, Buffer.from(data))
  }

  /** Debounced flush so a burst of writes results in a single disk hit. */
  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 400)
  }

  close(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flush()
    this.db.close()
  }
}
