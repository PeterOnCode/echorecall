import { describe, it, expect } from 'vitest'
import { attachmentDisposition, isDownloadRequested } from '../../server/utils/audio-response'

// Coverage for the download affordance on GET /api/generations/:id/audio
// (FR-014): with `?download=1` the response tells the browser to SAVE the clip
// (Content-Disposition: attachment; filename="<id>.mp3") instead of streaming it
// inline. The route's header plumbing is a thin h3 concern; the decision (is this
// a download?) and the attachment filename are the real logic and are unit-tested
// here, mirroring how the rest of this suite tests behaviour in plain Node.

describe('audio download disposition', () => {
  it('treats ?download=1 as a download request', () => {
    expect(isDownloadRequested('1')).toBe(true)
  })

  it('builds an attachment Content-Disposition with the <id>.mp3 filename', () => {
    expect(attachmentDisposition('abc-123')).toBe('attachment; filename="abc-123.mp3"')
  })

  it('streams inline (no download) when the flag is absent or falsy', () => {
    // Covers the string forms a query yields ('', '0', 'false') plus the
    // non-string falsy values the `unknown`-typed helper should also reject.
    for (const value of [undefined, null, '', '0', 'false', 0, false]) {
      expect(isDownloadRequested(value)).toBe(false)
    }
  })
})
