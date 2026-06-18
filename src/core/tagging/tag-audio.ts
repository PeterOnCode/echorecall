import type { Format, Metadata } from '../shared/types'
import { formatInfo } from '../tts/provider'
import type { AudioTagger, TagResult } from './tagger'
import { skippedFields } from './tagger'

/**
 * Embed `metadata` into `audio` for `format` (FR-018..021).
 *
 * Untaggable containers (AAC/PCM) are never opened: the input bytes are returned
 * unchanged with `skipped=['*']`, so generation still completes (US2 scenario 4).
 * For taggable formats the concrete tagger embeds the mappable fields; the
 * `skipped` list is computed here from the format's applicability so it is
 * independent of the backend (a fake tagger yields the same notices as the real
 * one).
 */
export async function tagAudio(
  tagger: AudioTagger,
  format: Format,
  audio: Buffer,
  metadata: Metadata,
): Promise<TagResult> {
  const skipped = skippedFields(format, metadata)
  if (formatInfo(format)?.taggable === 'none') {
    return { bytes: audio, skipped }
  }
  const { bytes } = await tagger.tag(format, audio, metadata)
  return { bytes, skipped }
}
