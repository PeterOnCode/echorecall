import { describe, it, expect } from 'vitest'
import { VOICES, isKnownVoice } from '../../src/core/tts/provider'

// GET /api/voices is a thin pass-through that returns `{ voices: VOICES }`
// (server/api/voices.get.ts). This integration test pins the catalog the route
// serves and the membership check that the generate route uses to reject an
// unknown voice (INVALID_VOICE).
describe('GET /api/voices', () => {
  it('serves a non-empty catalog of well-formed voices', () => {
    expect(VOICES.length).toBeGreaterThan(0)
    for (const voice of VOICES) {
      expect(typeof voice.id).toBe('string')
      expect(voice.id.length).toBeGreaterThan(0)
      expect(typeof voice.label).toBe('string')
      expect(voice.label.length).toBeGreaterThan(0)
    }
  })

  it('has unique voice ids', () => {
    const ids = VOICES.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('recognizes catalog voices and rejects unknown ones', () => {
    expect(isKnownVoice(VOICES[0]!.id)).toBe(true)
    expect(isKnownVoice('not-a-real-voice')).toBe(false)
  })
})
