<script setup lang="ts">
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'
import type { Region } from 'wavesurfer.js/plugins/regions'

// The Library waveform review player (005 redesign / US6 · FR-016). Wraps
// `wavesurfer.js` (the one new dependency, constitution v2.5.0 — web UI / `app/`
// only) for the selected recording: a rendered waveform with play/pause, a zoom
// control, and a single loop *region*. Regions here are a playback aid only — they
// loop a segment, they never trim or modify the audio (Q2/FR-016). The wavesurfer
// instance owns a <canvas> + WebAudio, so it is created on mount, torn down on
// unmount, and rebuilt when `src` changes; a load failure surfaces an unavailable
// state instead of crashing the panel. `wavesurfer.js` is mocked in component tests
// (happy-dom renders neither canvas nor WebAudio).
const props = defineProps<{ src: string; label?: string }>()
const emit = defineEmits<{ error: [error: Error] }>()

const { t } = useI18n()

const waveformEl = ref<HTMLElement | null>(null)
const ready = ref(false)
const playing = ref(false)
const unavailable = ref(false)
// Loop the active region when playback leaves it; on by default so a freshly added
// region immediately loops. Toggleable without removing the region.
const loop = ref(true)
const zoomLevel = ref(0)

let ws: WaveSurfer | null = null
let regions: RegionsPlugin | null = null
// The single active loop region (if any); only this region loops on `region-out`.
let loopRegion: Region | null = null

function teardown() {
  // `destroy()` also fires wavesurfer's own teardown; null the handles so a stale
  // instance is never reused after a src change or unmount.
  ws?.destroy()
  ws = null
  regions = null
  loopRegion = null
}

function build(src: string) {
  // Idempotent guard: rebuilds defer the actual build to `nextTick` (so the
  // `v-if`'d canvas can re-render first), which decouples teardown from build. If
  // `src` changes several times in quick succession, more than one deferred build
  // can run — destroy any live instance here so `ws` is never overwritten while an
  // earlier WaveSurfer (DOM + WebAudio) is still alive.
  if (ws) teardown()
  const container = waveformEl.value
  if (!container) return

  const instance = WaveSurfer.create({
    container,
    height: 96,
    waveColor: 'rgb(212 212 216)',
    progressColor: 'rgb(99 102 241)',
    cursorColor: 'rgb(99 102 241)',
  })
  const regionsPlugin = instance.registerPlugin(RegionsPlugin.create())

  instance.on('ready', () => {
    ready.value = true
  })
  instance.on('play', () => {
    playing.value = true
  })
  instance.on('pause', () => {
    playing.value = false
  })
  instance.on('finish', () => {
    playing.value = false
  })
  instance.on('error', (error: Error) => {
    // Ignore errors from a torn-down/superseded instance. wavesurfer's `load()`
    // emits `error` for the AbortError raised when `destroy()` aborts an in-flight
    // load during a rebuild, and `destroy()` does not detach our handler — so a
    // stale abort would otherwise stick the live player in the unavailable state
    // and hide the valid new waveform. Only the current instance may flip it.
    if (instance !== ws) return
    // A missing/undecodable file leaves the panel usable: show the unavailable
    // notice and let the consumer react, rather than throwing (FR-016 edge case).
    unavailable.value = true
    emit('error', error)
  })

  // Loop-only behaviour: when playback leaves the active loop region, replay it
  // from the region start. This is wavesurfer's canonical loop pattern — `play()`
  // with NO stop-at-end boundary. Do NOT pass `play(true)`: that arms the core's
  // `stopAtPosition = region.end`, and because `region-out` fires inside the same
  // `timeupdate` whose `t` is already past the end, the core would immediately
  // pause and seek back to the end right after we restart — glitching the loop.
  regionsPlugin.on('region-out', (region: Region) => {
    if (loop.value && region === loopRegion) region.play()
  })

  // Load failures arrive via the `error` event above; swallow the rejected promise
  // (e.g. the AbortError raised when a load is interrupted by teardown).
  instance.load(src).catch(() => {})

  ws = instance
  regions = regionsPlugin
}

function rebuild(src: string) {
  teardown()
  ready.value = false
  playing.value = false
  unavailable.value = false
  loopRegion = null
  zoomLevel.value = 0
  // Wait for the canvas container to (re-)render before mounting wavesurfer into it
  // — it is `v-if`'d out while unavailable.
  void nextTick(() => build(src))
}

function togglePlay() {
  void ws?.playPause()
}

function onZoom(event: Event) {
  const px = Number((event.target as HTMLInputElement).value)
  zoomLevel.value = px
  ws?.zoom(px)
}

/** Add a single loop region spanning the middle of the clip; replace any prior one. */
function addRegion() {
  if (!ws || !regions || !ready.value) return
  loopRegion?.remove()
  const duration = ws.getDuration() || 0
  const start = duration * 0.25
  const end = duration * 0.75 || duration
  loopRegion = regions.addRegion({
    start,
    end,
    color: 'rgba(99, 102, 241, 0.18)',
  })
}

function toggleLoop() {
  loop.value = !loop.value
}

onMounted(() => build(props.src))
watch(() => props.src, (src) => rebuild(src))
onBeforeUnmount(teardown)
</script>

<template>
  <section
    data-test="waveform-player"
    :aria-label="label || t('library.waveform.region')"
    class="flex flex-col gap-2 rounded-lg border border-default p-3"
  >
    <div
      v-if="!unavailable"
      ref="waveformEl"
      data-test="waveform-canvas"
      class="min-h-[96px] w-full"
    />
    <p v-else data-test="waveform-unavailable" role="alert" class="text-sm text-muted">
      {{ t('library.waveform.unavailable') }}
    </p>

    <div v-if="!unavailable" class="flex flex-wrap items-center gap-3">
      <UButton
        data-test="waveform-play"
        color="neutral"
        variant="outline"
        size="sm"
        :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :disabled="!ready"
        :aria-label="playing ? t('library.waveform.pause') : t('library.waveform.play')"
        @click="togglePlay"
      >
        {{ playing ? t('library.waveform.pause') : t('library.waveform.play') }}
      </UButton>

      <UButton
        data-test="waveform-add-region"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-repeat"
        :disabled="!ready"
        :aria-label="t('library.waveform.addRegion')"
        @click="addRegion"
      >
        {{ t('library.waveform.addRegion') }}
      </UButton>

      <UButton
        data-test="waveform-loop-toggle"
        :color="loop ? 'primary' : 'neutral'"
        :variant="loop ? 'soft' : 'outline'"
        size="sm"
        icon="i-lucide-rotate-cw"
        :aria-pressed="loop"
        :aria-label="t('library.waveform.loop')"
        @click="toggleLoop"
      >
        {{ t('library.waveform.loop') }}
      </UButton>

      <label class="flex items-center gap-2 text-sm text-muted">
        {{ t('library.waveform.zoom') }}
        <input
          type="range"
          data-test="waveform-zoom"
          min="0"
          max="1000"
          step="10"
          :value="zoomLevel"
          :disabled="!ready"
          :aria-label="t('library.waveform.zoom')"
          @input="onZoom"
        >
      </label>
    </div>
  </section>
</template>
