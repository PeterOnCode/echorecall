import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Format, Generation, Metadata, Model } from '../shared/types'
import type { GenerationRepository, NewGenerationRecord } from './repository'

interface ExtraTags {
  languages?: string[]
  customText?: { description: string; value: string }[]
  customUrl?: { description: string; url: string }[]
}

interface GenerationRow {
  id: string
  text: string
  voiceId: string
  model: string | null
  format: string | null
  speed: number | null
  createdAt: string
  path: string | null
  tag_title: string | null
  tag_artist: string | null
  tag_album: string | null
  tag_genre: string | null
  tag_comment: string | null
  tag_recorded_at: string | null
  tag_track: string | null
  tags_extra: string | null
}

// Columns added in 002 (guarded ALTER for DBs created by 001).
const NEW_COLUMNS: readonly { name: string; ddl: string }[] = [
  { name: 'path', ddl: 'path TEXT' },
  { name: 'model', ddl: 'model TEXT' },
  { name: 'format', ddl: 'format TEXT' },
  { name: 'speed', ddl: 'speed REAL' },
  { name: 'tag_title', ddl: 'tag_title TEXT' },
  { name: 'tag_artist', ddl: 'tag_artist TEXT' },
  { name: 'tag_album', ddl: 'tag_album TEXT' },
  { name: 'tag_genre', ddl: 'tag_genre TEXT' },
  { name: 'tag_comment', ddl: 'tag_comment TEXT' },
  { name: 'tag_recorded_at', ddl: 'tag_recorded_at TEXT' },
  { name: 'tag_track', ddl: 'tag_track TEXT' },
  { name: 'tags_extra', ddl: 'tags_extra TEXT' },
]

const SELECT = `
  SELECT id, text, voice_id AS voiceId, created_at AS createdAt, path, model, format, speed,
         tag_title, tag_artist, tag_album, tag_genre, tag_comment, tag_recorded_at, tag_track, tags_extra
  FROM generations`

/** SQLite-backed generation metadata store (better-sqlite3). */
export class SqliteGenerationRepository implements GenerationRepository {
  private readonly db: Database.Database

  constructor(dbPath: string) {
    // better-sqlite3 opens a file-backed DB but will not create missing parent
    // directories, so a fresh checkout (where gitignored `data/` does not yet
    // exist) would 500 on first write. ':memory:' and '' have nothing to create.
    if (dbPath !== ':memory:' && dbPath !== '') {
      mkdirSync(dirname(dbPath), { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id              TEXT PRIMARY KEY,
        text            TEXT NOT NULL,
        voice_id        TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        path            TEXT,
        model           TEXT,
        format          TEXT,
        speed           REAL,
        tag_title       TEXT,
        tag_artist      TEXT,
        tag_album       TEXT,
        tag_genre       TEXT,
        tag_comment     TEXT,
        tag_recorded_at TEXT,
        tag_track       TEXT,
        tags_extra      TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_generations_created_at
        ON generations (created_at DESC);
      CREATE TABLE IF NOT EXISTS app_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    this.migrate()
  }

  /**
   * In-place migration for DBs created by 001 (id/text/voice_id/created_at only).
   * Each ADD COLUMN runs only if missing (idempotent); legacy rows are then
   * backfilled with a flat path + mp3 format so they keep listing and playing.
   */
  private migrate(): void {
    const existing = new Set(
      (this.db.prepare('PRAGMA table_info(generations)').all() as { name: string }[]).map(
        (c) => c.name,
      ),
    )
    let migrated = false
    for (const col of NEW_COLUMNS) {
      if (!existing.has(col.name)) {
        this.db.exec(`ALTER TABLE generations ADD COLUMN ${col.ddl}`)
        migrated = true
      }
    }
    // Backfill legacy (001) rows only when columns were actually added — avoids a
    // full-table scan on every construction. 001 only produced MP3 at audio/<id>.mp3.
    if (migrated) {
      this.db.exec(
        `UPDATE generations SET path = 'audio/' || id || '.mp3' WHERE path IS NULL OR path = ''`,
      )
      this.db.exec(`UPDATE generations SET format = 'mp3' WHERE format IS NULL OR format = ''`)
    }
  }

  insert(record: NewGenerationRecord): void {
    this.db
      .prepare(
        `INSERT INTO generations
           (id, text, voice_id, created_at, path, model, format, speed,
            tag_title, tag_artist, tag_album, tag_genre, tag_comment, tag_recorded_at, tag_track, tags_extra)
         VALUES
           (@id, @text, @voiceId, @createdAt, @path, @model, @format, @speed,
            @title, @artist, @album, @genre, @comment, @recordedAt, @track, @extra)`,
      )
      .run({
        id: record.id,
        text: record.text,
        voiceId: record.voiceId,
        createdAt: record.createdAt,
        path: record.path,
        model: record.model ?? null,
        format: record.format,
        speed: record.speed ?? null,
        title: record.metadata.title ?? null,
        artist: record.metadata.artist ?? null,
        album: record.metadata.album ?? null,
        genre: record.metadata.genre ?? null,
        comment: record.metadata.comment ?? null,
        recordedAt: record.metadata.recordedAt ?? null,
        track: record.metadata.track ?? null,
        extra: serializeExtra(record.metadata),
      })
  }

  list(): Generation[] {
    return (
      this.db.prepare(`${SELECT} ORDER BY created_at DESC, id DESC`).all() as GenerationRow[]
    ).map(rowToGeneration)
  }

  get(id: string): Generation | undefined {
    const row = this.db.prepare(`${SELECT} WHERE id = ?`).get(id) as GenerationRow | undefined
    return row ? rowToGeneration(row) : undefined
  }

  update(id: string, patch: { path?: string; metadata?: Metadata }): boolean {
    const sets: string[] = []
    const params: Record<string, unknown> = { id }
    if (patch.path !== undefined) {
      sets.push('path = @path')
      params.path = patch.path
    }
    if (patch.metadata !== undefined) {
      // Replace the whole tag set: every tag column is rewritten so clearing a
      // field on the editor removes it from the row (FR-023/030).
      const m = patch.metadata
      sets.push(
        'tag_title = @title',
        'tag_artist = @artist',
        'tag_album = @album',
        'tag_genre = @genre',
        'tag_comment = @comment',
        'tag_recorded_at = @recordedAt',
        'tag_track = @track',
        'tags_extra = @extra',
      )
      params.title = m.title ?? null
      params.artist = m.artist ?? null
      params.album = m.album ?? null
      params.genre = m.genre ?? null
      params.comment = m.comment ?? null
      params.recordedAt = m.recordedAt ?? null
      params.track = m.track ?? null
      params.extra = serializeExtra(m)
    }
    // Nothing to change: report whether the row exists so callers can still map a
    // missing id to NOT_FOUND.
    if (sets.length === 0) {
      return this.db.prepare('SELECT 1 FROM generations WHERE id = ?').get(id) !== undefined
    }
    return (
      this.db.prepare(`UPDATE generations SET ${sets.join(', ')} WHERE id = @id`).run(params)
        .changes > 0
    )
  }

  delete(id: string): boolean {
    return this.db.prepare('DELETE FROM generations WHERE id = ?').run(id).changes > 0
  }

  close(): void {
    this.db.close()
  }
}

/** Pack multi-value/custom tags into the `tags_extra` JSON column (null when empty). */
function serializeExtra(metadata: Metadata): string | null {
  const extra: ExtraTags = {}
  if (metadata.languages?.length) extra.languages = metadata.languages
  if (metadata.customText?.length) extra.customText = metadata.customText
  if (metadata.customUrl?.length) extra.customUrl = metadata.customUrl
  return Object.keys(extra).length > 0 ? JSON.stringify(extra) : null
}

function rowToGeneration(row: GenerationRow): Generation {
  const metadata: Metadata = {}
  if (row.tag_title) metadata.title = row.tag_title
  if (row.tag_artist) metadata.artist = row.tag_artist
  if (row.tag_album) metadata.album = row.tag_album
  if (row.tag_genre) metadata.genre = row.tag_genre
  if (row.tag_comment) metadata.comment = row.tag_comment
  if (row.tag_recorded_at) metadata.recordedAt = row.tag_recorded_at
  if (row.tag_track) metadata.track = row.tag_track
  if (row.tags_extra) {
    try {
      const extra = JSON.parse(row.tags_extra) as ExtraTags
      if (extra.languages?.length) metadata.languages = extra.languages
      if (extra.customText?.length) metadata.customText = extra.customText
      if (extra.customUrl?.length) metadata.customUrl = extra.customUrl
    } catch (err) {
      // Degrade gracefully: a corrupt tags_extra payload must not break listing.
      console.error(`[sqlite-repository] malformed tags_extra for row ${row.id}`, err)
    }
  }
  return {
    id: row.id,
    text: row.text,
    voiceId: row.voiceId,
    model: (row.model as Model | null) ?? null,
    // After migration, format is always set; default defensively.
    format: (row.format as Format | null) ?? 'mp3',
    speed: row.speed ?? null,
    createdAt: row.createdAt,
    path: row.path ?? '',
    metadata,
  }
}
