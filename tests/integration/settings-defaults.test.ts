import { describe, it, expect } from 'vitest'
import { readDefaultTags } from '../../src/core/settings/default-tags'

// Integration coverage for US10 default tag values (FR-048): the server reads
// NUXT_DEFAULT_TAG_* into a Metadata object used to pre-fill the generation form.
// Title is never defaulted, blank/whitespace values are omitted, LANGUAGES splits
// on commas, and malformed/missing config degrades to an empty object so the route
// returns 200 (never 500). The thin h3 route envelope is out of scope here (matching
// the other integration suites); this drives the real reader the route delegates to.

describe('readDefaultTags — env-provided default tags (US10)', () => {
  it('maps NUXT_DEFAULT_TAG_* to Metadata, splitting languages on commas', () => {
    const tags = readDefaultTags({
      NUXT_DEFAULT_TAG_ARTIST: 'EchoRecall',
      NUXT_DEFAULT_TAG_ALBUM: 'Daily Briefing',
      NUXT_DEFAULT_TAG_GENRE: 'Speech',
      NUXT_DEFAULT_TAG_COMMENT: 'Auto-generated',
      NUXT_DEFAULT_TAG_LANGUAGES: 'eng, hun',
    })
    expect(tags).toEqual({
      artist: 'EchoRecall',
      album: 'Daily Briefing',
      genre: 'Speech',
      comment: 'Auto-generated',
      languages: ['eng', 'hun'],
    })
  })

  it('never defaults Title, even when NUXT_DEFAULT_TAG_TITLE is set', () => {
    const tags = readDefaultTags({
      NUXT_DEFAULT_TAG_TITLE: 'Should be ignored',
      NUXT_DEFAULT_TAG_ARTIST: 'EchoRecall',
    })
    expect(tags.title).toBeUndefined()
    expect(tags).toEqual({ artist: 'EchoRecall' })
  })

  it('trims values and omits blank/whitespace-only ones', () => {
    const tags = readDefaultTags({
      NUXT_DEFAULT_TAG_ARTIST: '   ',
      NUXT_DEFAULT_TAG_ALBUM: '',
      NUXT_DEFAULT_TAG_GENRE: '  Speech  ',
    })
    expect(tags).toEqual({ genre: 'Speech' })
  })

  it('drops blank language entries and omits languages entirely when none remain', () => {
    expect(readDefaultTags({ NUXT_DEFAULT_TAG_LANGUAGES: 'eng, , ,hun, ' })).toEqual({
      languages: ['eng', 'hun'],
    })
    expect(readDefaultTags({ NUXT_DEFAULT_TAG_LANGUAGES: ' , , ' })).toEqual({})
  })

  it('returns an empty object (never throws) for missing config', () => {
    expect(readDefaultTags({})).toEqual({})
  })
})
