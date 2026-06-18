import type { Format, Metadata } from '../shared/types'
import type { AudioTagger, TagResult } from './tagger'
import { hasEmbeddableTags, skippedFields } from './tagger'

/**
 * Embed `metadata` into `audio` for `format` (FR-018..021).
 *
 * The tagger is opened only when there is something to embed. Untaggable
 * containers (AAC/PCM), empty metadata, and sets whose only present fields are
 * unsupported by the format all return the input bytes unchanged (US2 scenario 4)
 * — so a no-metadata generation is never needlessly rewritten and can't fail with
 * a spurious tagging error. The `skipped` list is computed here from the format's
 * applicability so it is independent of the backend (a fake tagger yields the same
 * notices as the real one).
 */
export async function tagAudio(
  tagger: AudioTagger,
  format: Format,
  audio: Buffer,
  metadata: Metadata,
): Promise<TagResult> {
  const skipped = skippedFields(format, metadata)
  if (!hasEmbeddableTags(format, metadata)) {
    return { bytes: audio, skipped }
  }
  const { bytes } = await tagger.tag(format, audio, metadata)
  return { bytes, skipped }
}
