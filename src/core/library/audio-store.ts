import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Filesystem store for generated MP3 audio artifacts. */
export class FileAudioStore {
  constructor(private readonly audioDir: string) {}

  private path(id: string): string {
    return join(this.audioDir, `${id}.mp3`)
  }

  async save(id: string, mp3: Buffer): Promise<void> {
    await mkdir(this.audioDir, { recursive: true })
    await writeFile(this.path(id), mp3)
  }

  async read(id: string): Promise<Buffer> {
    return readFile(this.path(id))
  }

  async exists(id: string): Promise<boolean> {
    return existsSync(this.path(id))
  }

  /** Delete the artifact if present; tolerate a missing file. */
  async delete(id: string): Promise<void> {
    try {
      await unlink(this.path(id))
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }
}
