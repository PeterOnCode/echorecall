import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Generation } from '../shared/types'
import type { GenerationRepository, NewGenerationRecord } from './repository'

/** SQLite-backed generation metadata store (better-sqlite3). */
export class SqliteGenerationRepository implements GenerationRepository {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    // better-sqlite3 opens a file-backed DB but will not create missing parent
    // directories, so a fresh checkout (where gitignored `data/` does not yet
    // exist) would 500 on first write. Create the parent up front. ':memory:'
    // and '' are special non-file paths with nothing to create.
    if (dbPath !== ':memory:' && dbPath !== '') {
      mkdirSync(dirname(dbPath), { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id         TEXT PRIMARY KEY,
        text       TEXT NOT NULL,
        voice_id   TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_generations_created_at
        ON generations (created_at DESC);
    `)
  }

  insert(record: NewGenerationRecord): void {
    this.db
      .prepare('INSERT INTO generations (id, text, voice_id, created_at) VALUES (?, ?, ?, ?)')
      .run(record.id, record.text, record.voiceId, record.createdAt)
  }

  list(): Generation[] {
    return this.db
      .prepare(
        'SELECT id, text, voice_id AS voiceId, created_at AS createdAt FROM generations ORDER BY created_at DESC, id DESC',
      )
      .all() as Generation[]
  }

  get(id: string): Generation | undefined {
    return this.db
      .prepare(
        'SELECT id, text, voice_id AS voiceId, created_at AS createdAt FROM generations WHERE id = ?',
      )
      .get(id) as Generation | undefined
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM generations WHERE id = ?').run(id).changes > 0
  }

  close(): void {
    this.db.close()
  }
}
