<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

// Route-driven tab navigation across the two areas. Panels are disabled
// (`:content="false"`) — each tab simply navigates to its page. Settings is no longer
// a tab/route (005 · US7 / FR-017): it opens as a modal from the header gear.
const tabs = computed(() => [
  { label: t('common.tabs.generate'), icon: 'i-lucide-mic', value: '/' },
  { label: t('common.tabs.library'), icon: 'i-lucide-library', value: '/library' },
])

const active = computed({
  get: (): string => tabs.value.find((tab) => tab.value === route.path)?.value ?? '/',
  set: (value: string | number) => {
    const path = String(value)
    if (path !== route.path) navigateTo(path)
  },
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />
    <UMain>
      <UContainer class="max-w-none py-6">
        <UTabs v-model="active" :items="tabs" :content="false" class="mb-6" />
        <slot />
      </UContainer>
    </UMain>
  </div>
</template>
