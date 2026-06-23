import { vi } from 'vitest'

// Shared happy-dom mock for `wavesurfer.js` (005 redesign / US6). The real library
// renders to a <canvas> and drives WebAudio — neither exists in the vitest happy-dom
// env — so component tests mock the module (mirroring the `useColorMode` mock
// pattern) and assert our *wiring* (loads the right src, zoom calls `zoom`, adding a
// region marks a loop, a load error surfaces the unavailable state), never
// wavesurfer's internals.
//
// Usage in a spec (the factory must reference this module via dynamic import so it
// survives vi.mock hoisting):
//
//   vi.mock('wavesurfer.js', async () => ({
//     default: (await import('./wavesurfer-mock')).WaveSurferMock,
//   }))
//   vi.mock('wavesurfer.js/plugins/regions', async () => ({
//     default: (await import('./wavesurfer-mock')).RegionsPluginMock,
//   }))
//
// then read `wavesurferState.instance` / `.regions` and fire events with
// `instance.emit('ready', 1)` / `instance.emit('error', new Error('x'))`.

type Handler = (...args: unknown[]) => void

/** A registered-region stub: loop playback is exercised via `play`. */
export interface RegionStub {
  start: number
  end: number
  color?: string
  play: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

export interface RegionsStub {
  addRegion: ReturnType<typeof vi.fn>
  clearRegions: ReturnType<typeof vi.fn>
  getRegions: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  /** Test helper: invoke every handler registered for `event`. */
  emit: (event: string, ...args: unknown[]) => void
}

export interface WaveSurferStub {
  load: ReturnType<typeof vi.fn>
  zoom: ReturnType<typeof vi.fn>
  playPause: ReturnType<typeof vi.fn>
  registerPlugin: ReturnType<typeof vi.fn>
  getDuration: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  un: ReturnType<typeof vi.fn>
  /** Test helper: invoke every handler registered for `event`. */
  emit: (event: string, ...args: unknown[]) => void
}

/** Handles to the most recently created stubs, for assertions and event firing. */
export const wavesurferState: {
  instance: WaveSurferStub | null
  regions: RegionsStub | null
  lastRegion: RegionStub | null
} = { instance: null, regions: null, lastRegion: null }

function makeEmitter() {
  const handlers = new Map<string, Handler[]>()
  const on = vi.fn((event: string, cb: Handler) => {
    const list = handlers.get(event) ?? []
    list.push(cb)
    handlers.set(event, list)
  })
  const un = vi.fn((event: string, cb: Handler) => {
    handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== cb))
  })
  const emit = (event: string, ...args: unknown[]) => {
    for (const cb of handlers.get(event) ?? []) cb(...args)
  }
  return { on, un, emit }
}

function makeRegions(): RegionsStub {
  const { on, emit } = makeEmitter()
  const created: RegionStub[] = []
  const addRegion = vi.fn((params: { start: number; end?: number; color?: string }) => {
    const region: RegionStub = {
      start: params.start,
      end: params.end ?? params.start,
      color: params.color,
      play: vi.fn(),
      remove: vi.fn(),
    }
    created.push(region)
    wavesurferState.lastRegion = region
    return region
  })
  return {
    addRegion,
    clearRegions: vi.fn(() => {
      created.length = 0
    }),
    getRegions: vi.fn(() => [...created]),
    on,
    emit,
  }
}

function makeInstance(): WaveSurferStub {
  const { on, un, emit } = makeEmitter()
  return {
    load: vi.fn(() => Promise.resolve()),
    zoom: vi.fn(),
    playPause: vi.fn(() => Promise.resolve()),
    registerPlugin: vi.fn(<T>(plugin: T): T => plugin),
    getDuration: vi.fn(() => 10),
    destroy: vi.fn(),
    on,
    un,
    emit,
  }
}

/** Stands in for `WaveSurfer` (the default export): `WaveSurfer.create(opts)`. */
export const WaveSurferMock = {
  create: vi.fn(() => {
    const instance = makeInstance()
    wavesurferState.instance = instance
    return instance
  }),
}

/** Stands in for the Regions plugin default export: `RegionsPlugin.create()`. */
export const RegionsPluginMock = {
  create: vi.fn(() => {
    const regions = makeRegions()
    wavesurferState.regions = regions
    return regions
  }),
}

/** Reset call counts and captured handles between tests. */
export function resetWavesurferMock(): void {
  WaveSurferMock.create.mockClear()
  RegionsPluginMock.create.mockClear()
  wavesurferState.instance = null
  wavesurferState.regions = null
  wavesurferState.lastRegion = null
}
