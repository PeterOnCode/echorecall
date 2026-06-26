import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LibraryStatusBar from '~/components/library/LibraryStatusBar.vue'

// 006 · US6 (FR-023, R-AUDIOPROPS / data-model §4) — the read-only Library status bar.
// A pure projection of data already in hand: the global save state (any unsaved draft)
// + dirty count, the filtered files-loaded count, the active selection's filename, the
// constant UTF-8 tag charset, and the active recording's real audio properties (codec /
// bitrate / sample rate from R-AUDIOPROPS — blank where unreadable). It owns no network
// and emits nothing; it reacts to its props (dirty flips on edit, clears after Save).

function mountBar(props: Record<string, unknown> = {}) {
  return mountSuspended(LibraryStatusBar, {
    props: {
      saveState: 'saved',
      dirtyCount: 0,
      filesLoaded: 0,
      selection: null,
      charset: 'UTF-8',
      ...props,
    },
  })
}

describe('LibraryStatusBar (US6)', () => {
  it('exposes a live status region to assistive tech (FR-023)', async () => {
    const w = await mountBar()
    const bar = w.find('[data-test="status-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('role')).toBe('status')
  })

  it('reports the filtered files-loaded count', async () => {
    const w = await mountBar({ filesLoaded: 10 })
    expect(w.find('[data-test="status-files"]').text()).toContain('10')
  })

  it('reports the active selection filename, or none when unselected', async () => {
    const w = await mountBar({ selection: 'song.mp3' })
    expect(w.find('[data-test="status-selection"]').text()).toContain('song.mp3')

    await w.setProps({ selection: null })
    expect(w.find('[data-test="status-selection"]').text()).not.toContain('song.mp3')
    expect(w.find('[data-test="status-selection"]').text().length).toBeGreaterThan(0)
  })

  it('shows the constant UTF-8 tag charset', async () => {
    const w = await mountBar()
    expect(w.find('[data-test="status-charset"]').text()).toContain('UTF-8')
  })

  it('reflects the save state and reacts to dirty edits / Save (R-DRAFTS)', async () => {
    const w = await mountBar({ saveState: 'saved', dirtyCount: 0 })
    const savedText = w.find('[data-test="status-save"]').text()
    expect(savedText.length).toBeGreaterThan(0)

    // An edit makes drafts dirty → the bar surfaces the unsaved count.
    await w.setProps({ saveState: 'unsaved', dirtyCount: 2 })
    const unsavedText = w.find('[data-test="status-save"]').text()
    expect(unsavedText).not.toBe(savedText)
    expect(unsavedText).toContain('2')

    // Saving clears the buffer → back to the saved state, no count.
    await w.setProps({ saveState: 'saved', dirtyCount: 0 })
    expect(w.find('[data-test="status-save"]').text()).toBe(savedText)
  })

  it('renders the real audio properties (codec / bitrate / sample rate)', async () => {
    const w = await mountBar({
      audio: { codec: 'MP3', bitrate: 320, sampleRate: 44100 },
    })
    const audio = w.find('[data-test="status-audio"]').text()
    expect(audio).toContain('MP3')
    expect(audio).toContain('320')
    expect(audio).toContain('44100')
  })

  it('leaves the audio readout blank when properties are unreadable (R-AUDIOPROPS)', async () => {
    const w = await mountBar({ audio: undefined })
    expect(w.find('[data-test="status-audio"]').text()).toBe('')
  })
})
