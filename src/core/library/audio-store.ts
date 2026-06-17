import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Filesystem store for generated audio, addressed by a path **relative to the
 * data dir** (e.g. `audio/2026/06/17/<slug>.mp3`, or the legacy `audio/<id>.mp3`).
 */
export class FileAudioStore {
  constructor(private readonly baseDir: string) {}

  private abs(relPath: string): string {
    return join(this.baseDir, relPath)
  }

  async saveAt(relPath: string, bytes: Buffer): Promise<void> {
    const target = this.abs(relPath)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
  }

  async readAt(relPath: string): Promise<Buffer> {
    return readFile(this.abs(relPath))
  }

  async existsAt(relPath: string): Promise<boolean> {
    return existsSync(this.abs(relPath))
  }

  /**
   * Synchronous existence check, used for collision-safe filename allocation
   * (`allocateFilename` takes a sync predicate so it can probe candidates without
   * interleaving awaits during a single save).
   */
  existsAtSync(relPath: string): boolean {
    return existsSync(this.abs(relPath))
  }

  /** Move/rename an artifact; creates the destination directory if needed. */
  async rename(fromRel: string, toRel: string): Promise<void> {
    const to = this.abs(toRel)
    await mkdir(dirname(to), { recursive: true })
    await rename(this.abs(fromRel), to)
  }

  /** Delete the artifact if present; tolerate a missing file. */
  async deleteAt(relPath: string): Promise<void> {
    try {
      await unlink(this.abs(relPath))
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }
}
