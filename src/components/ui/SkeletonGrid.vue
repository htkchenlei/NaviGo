<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<template>
  <div class="grid grid-cols-1 gap-lg sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    <div
      v-for="index in count"
      :key="index"
      class="animate-shimmer overflow-hidden rounded-xl bg-surface shadow-card nv-hairline"
    >
      <div class="h-1.5 w-full bg-accent-3" />
      <div class="flex flex-col gap-md p-lg">
        <div class="h-5 w-1/3 rounded-sm bg-surface-3" />
        <div v-for="row in 4" :key="row" class="flex items-center gap-sm">
          <div class="h-10 w-10 shrink-0 rounded-pill bg-surface-3" />
          <div class="flex flex-1 flex-col gap-2xs">
            <div class="h-3.5 w-1/2 rounded-sm bg-surface-3" />
            <div class="h-3 w-2/3 rounded-sm bg-surface-3" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
