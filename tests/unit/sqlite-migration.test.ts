import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { SqliteGenerationRepository } from '../../src/core/library/sqlite-repository'
import type { NewGenerationRecord } from '../../src/core/library/repository'

let dir: string
let dbPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'echorecall-mig-'))
  dbPath = join(dir, 'echorecall.db')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** Recreate a pre-002 (001) database: only the four original columns + a row. */
function seedLegacyDb(): void {
  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE generations (
      id         TEXT PRIMARY KEY,
      text       TEXT NOT NULL,
      voice_id   TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  db.prepare('INSERT INTO generations (id, text, voice_id, created_at) VALUES (?, ?, ?, ?)').run(
    'legacy-1',
    'old clip',
    'alloy',
    '2026-06-15T10:00:00.000Z',
  )
  db.close()
}

const fullRecord: NewGenerationRecord = {
  id: 'new-1',
  text: 'fresh clip',
  voiceId: 'nova',
  model: 'gpt-4o-mini-tts',
  format: 'flac',
  speed: 1.25,
  createdAt: '2026-06-17T12:00:00.000Z',
  path: 'audio/2026/06/17/fresh-clip.flac',
  metadata: {
    title: 'Fresh Clip',
    artist: 'EchoRecall',
    languages: ['eng', 'hun'],
    customText: [{ description: 'mood', value: 'calm' }],
    customUrl: [{ description: 'source', url: 'https://example.com' }],
  },
}

describe('SqliteGenerationRepository migration', () => {
  it('adds the 002 columns in place and backfills legacy rows', () => {
    seedLegacyDb()
    const repo = new SqliteGenerationRepository(dbPath)
    try {
      const legacy = repo.get('legacy-1')
      expect(legacy).toBeDefined()
      // Backfilled so old clips keep listing/playing.
      expect(legacy!.path).toBe('audio/legacy-1.mp3')
      expect(legacy!.format).toBe('mp3')
      expect(legacy!.model).toBeNull()
      expect(legacy!.speed).toBeNull()
      expect(legacy!.metadata).toEqual({})
    } finally {
      repo.close()
    }
  })

  it('is idempotent: opening an already-migrated DB twice does not fail', () => {
    seedLegacyDb()
    new SqliteGenerationRepository(dbPath).close()
    // Second open must not error (ADD COLUMN guarded by PRAGMA table_info).
    const repo = new SqliteGenerationRepository(dbPath)
    try {
      expect(repo.get('legacy-1')?.id).toBe('legacy-1')
    } finally {
      repo.close()
    }
  })

  it('round-trips a full record including tags_extra (languages + custom entries)', () => {
    const repo = new SqliteGenerationRepository(dbPath)
    try {
      repo.insert(fullRecord)
      const got = repo.get('new-1')
      expect(got).toEqual({
        id: 'new-1',
        text: 'fresh clip',
        voiceId: 'nova',
        model: 'gpt-4o-mini-tts',
        format: 'flac',
        speed: 1.25,
        createdAt: '2026-06-17T12:00:00.000Z',
        path: 'audio/2026/06/17/fresh-clip.flac',
        metadata: fullRecord.metadata,
      })
    } finally {
      repo.close()
    }
  })

  it('creates the app_config table', () => {
    const repo = new SqliteGenerationRepository(dbPath)
    try {
      const db = new Database(dbPath)
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_config'")
        .get() as { name: string } | undefined
      db.close()
      expect(row?.name).toBe('app_config')
    } finally {
      repo.close()
    }
  })
})
