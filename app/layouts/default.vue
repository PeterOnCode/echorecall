<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

// Route-driven tab navigation across the three areas (FR-049). Panels are
// disabled (`:content="false"`) — each tab simply navigates to its page.
const tabs = computed(() => [
  { label: t('common.tabs.generate'), icon: 'i-lucide-mic', value: '/' },
  { label: t('common.tabs.library'), icon: 'i-lucide-library', value: '/library' },
  { label: t('common.tabs.settings'), icon: 'i-lucide-settings', value: '/settings' },
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
      <UContainer class="py-6">
        <UTabs v-model="active" :items="tabs" :content="false" class="mb-6" />
        <slot />
      </UContainer>
    </UMain>
  </div>
</template>
