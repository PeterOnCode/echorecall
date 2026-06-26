import type { AudioProperties } from '../shared/types'

// 006 · R-AUDIOPROPS — read-only audio properties (codec/bitrate/sampleRate/
// duration) computed on read from the stored file via taglib's `audioProperties()`.
// Nothing is persisted (no migration). The taglib opener is an injected PORT so the
// mapping + error handling are unit-testable without the WASM module (the real
// round-trip is exercised by the gated adapter suite). A single unreadable/missing
// file must yield an empty object — never throw — so it can't break listing.

/** The subset of taglib's `AudioProperties` this reader consumes. */
export interface RawAudioProperties {
  duration?: number
  bitrate?: number
  sampleRate?: number
  codec?: string
  containerFormat?: string
  channels?: number
}

/** An opened taglib file (only the bits this reader needs). */
export interface AudioFileLike {
  audioProperties(): RawAudioProperties | undefined | null
  dispose(): void
}

/** Port: opens audio bytes into an {@link AudioFileLike} (taglib `open`). */
export interface TagLibLike {
  open(bytes: Uint8Array): Promise<AudioFileLike>
}

/** Injected into {@link import('./library-service').LibraryService} to read props on demand. */
export type AudioPropertiesReader = (bytes: Buffer) => Promise<AudioProperties>

/**
 * Read the audio properties from `bytes` using the injected taglib opener. Returns
 * only the values that are present and meaningful (zeros — taglib's "unknown" — and
 * an `unknown` codec are dropped). Any failure (unreadable/missing file) resolves to
 * an empty object.
 */
export async function readAudioProperties(
  taglib: TagLibLike,
  bytes: Buffer | Uint8Array,
): Promise<AudioProperties> {
  let file: AudioFileLike | undefined
  try {
    file = await taglib.open(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    const raw = file.audioProperties()
    if (!raw) return {}
    const props: AudioProperties = {}
    if (typeof raw.codec === 'string' && raw.codec && raw.codec !== 'unknown') props.codec = raw.codec
    if (typeof raw.bitrate === 'number' && raw.bitrate > 0) props.bitrate = raw.bitrate
    if (typeof raw.sampleRate === 'number' && raw.sampleRate > 0) props.sampleRate = raw.sampleRate
    if (typeof raw.duration === 'number' && raw.duration > 0) props.duration = raw.duration
    return props
  } catch {
    return {}
  } finally {
    file?.dispose()
  }
}
