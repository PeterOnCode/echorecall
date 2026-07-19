<script setup lang="ts">
// The Generate surface lives at `/generate` (app/pages/generate.vue). The root `/`
// redirects there so the app's home resolves to Generate — vue-router handles the
// redirect before this component would render (SSR + client).
definePageMeta({ redirect: '/generate' })
</script>

<template>
  <div />
</template>
