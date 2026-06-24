/**
 * Shared open-state for the Settings modal (005 · US7 / FR-017). The modal lives in
 * the app header so it is reachable from every surface; the header gear and the
 * Generate toolbar's settings action both drive this single Nuxt-shared ref, so one
 * modal instance is shared across the Generate and Library pages. Keyed via useState
 * so it survives navigation and stays consistent wherever it is read.
 */
export function useSettingsModal() {
  const open = useState<boolean>('settings-modal-open', () => false)
  return { open }
}
