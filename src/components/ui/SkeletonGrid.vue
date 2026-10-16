<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<template>
  <div class="flex flex-col gap-xl" aria-hidden="true">
    <div v-for="index in count" :key="index" class="animate-shimmer flex flex-col gap-sm">
      <div class="flex items-center gap-sm">
        <div class="h-5 w-1.5 rounded-pill bg-accent-3" />
        <div class="h-5 w-32 rounded-sm bg-surface-3" />
      </div>

      <div class="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="row in 4"
          :key="row"
          class="flex items-center gap-sm rounded-lg bg-surface p-sm ring-1 ring-inset ring-rule"
        >
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
