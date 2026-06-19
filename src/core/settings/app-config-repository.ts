import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

/**
 * Server-side key/value configuration store (US8). Currently holds only the
 * encrypted in-app OpenAI key. Kept as a narrow port so the key-resolution rules
 * in {@link ./api-key} stay framework-agnostic and unit-testable with a fake.
 */
export interface AppConfigRepository {
  get(key: string): string | undefined
  set(key: string, value: string): void
  /** @returns true if a row was removed. */
  delete(key: string): boolean
}

/** SQLite-backed AppConfigRepository over the shared `app_config(key,value)` table. */
export class SqliteAppConfigRepository implements AppConfigRepository {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    // better-sqlite3 won't create missing parent directories; mirror the
    // generations repository so a fresh checkout doesn't 500 on first write.
    if (dbPath !== ':memory:' && dbPath !== '') {
      mkdirSync(dirname(dbPath), { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    // Idempotent: the generations repository also ensures this table, but creating
    // it here keeps the store self-contained (and safe if constructed first).
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
  }

  get(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM app_config WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO app_config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value)
  }

  delete(key: string): boolean {
    return this.db.prepare('DELETE FROM app_config WHERE key = ?').run(key).changes > 0
  }
}
