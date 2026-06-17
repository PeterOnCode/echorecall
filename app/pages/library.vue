<script setup lang="ts">
// Library area. Search / sort / filter / rename / retag / bulk-clean arrive in
// US5–US6; for now it lists the persisted library and supports replay + delete.
const { items, loading, error, load, remove } = useLibrary()

onMounted(load)
</script>

<template>
  <div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-else-if="loading && items.length === 0" class="text-muted">{{ $t('common.loading') }}</p>
    <LibraryList v-else :generations="items" @delete="remove" />
  </div>
</template>
