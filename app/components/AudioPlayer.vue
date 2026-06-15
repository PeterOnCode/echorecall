<script setup lang="ts">
defineProps<{ src: string }>()
</script>

<template>
  <audio controls :src="src" />
</template>
