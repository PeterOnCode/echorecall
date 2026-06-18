import { describe, it, expect } from 'vitest'
import { attachmentDisposition, isDownloadRequested } from '../../server/utils/audio-response'

// Coverage for the download affordance on GET /api/generations/:id/audio
// (FR-014 + US4): with `?download=1` the response tells the browser to SAVE the
// clip under its REAL human-readable filename (Content-Disposition: attachment;
// filename="<real filename>") instead of streaming it inline. The route derives
// that filename from the stored path's basename and hands it to
// `attachmentDisposition`. The route's header plumbing is a thin h3 concern; the
// decision (is this a download?) and the attachment value are the real logic and
// are unit-tested here, mirroring how the rest of this suite tests behaviour in
// plain Node.

describe('audio download disposition', () => {
  it('treats ?download=1 as a download request', () => {
    expect(isDownloadRequested('1')).toBe(true)
  })

  it('builds an attachment Content-Disposition from the real (basename) filename', () => {
    // Dated, title-slug files download under their slug name (US4)…
    expect(attachmentDisposition('my-great-clip.flac')).toBe(
      'attachment; filename="my-great-clip.flac"',
    )
    // …and legacy flat-path 001 rows download under their stored <id>.mp3 name.
    expect(attachmentDisposition('legacy-uuid.mp3')).toBe(
      'attachment; filename="legacy-uuid.mp3"',
    )
  })

  it('strips characters that could break out of / inject the header', () => {
    // Quotes and CR/LF are removed so the value stays a single safe quoted token.
    expect(attachmentDisposition('evil".mp3')).toBe('attachment; filename="evil.mp3"')
    expect(attachmentDisposition('a\r\nb.mp3')).toBe('attachment; filename="ab.mp3"')
  })

  it('streams inline (no download) when the flag is absent or falsy', () => {
    // Covers the string forms a query yields ('', '0', 'false') plus the
    // non-string falsy values the `unknown`-typed helper should also reject.
    for (const value of [undefined, null, '', '0', 'false', 0, false]) {
      expect(isDownloadRequested(value)).toBe(false)
    }
  })
})
