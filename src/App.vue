<script setup lang="ts">
import ToastHost from '@/components/ui/ToastHost.vue'
</script>

<template>
  <div class="relative min-h-screen">
    <!-- 柔光渐变色斑：固定的背景层，不参与任何布局与点击 -->
    <div class="nv-blobs" aria-hidden="true">
      <span class="nv-blob nv-blob--lilac" />
      <span class="nv-blob nv-blob--sky" />
      <span class="nv-blob nv-blob--peach" />
      <span class="nv-blob nv-blob--mint" />
    </div>

    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>

    <ToastHost />
  </div>
</template>

<style>
/* 页面切换：退出快、进入慢，符合「离开加速、进入减速」的动效语言 */
.page-enter-active {
  transition: opacity var(--dur-short) var(--ease-out), transform var(--dur-short) var(--ease-out);
}
.page-leave-active {
  transition: opacity calc(var(--dur-short) * 0.75) var(--ease-in),
    transform calc(var(--dur-short) * 0.75) var(--ease-in);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.nv-blobs {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: clip;
  pointer-events: none;
  background-image: radial-gradient(
      120% 90% at 12% 4%,
      color-mix(in oklab, var(--color-accent-3) 34%, transparent) 0%,
      transparent 58%
    ),
    radial-gradient(
      100% 80% at 96% 10%,
      color-mix(in oklab, var(--color-macaron-sky-soft) 78%, transparent) 0%,
      transparent 62%
    ),
    radial-gradient(
      120% 100% at 50% 108%,
      color-mix(in oklab, var(--color-macaron-peach-soft) 72%, transparent) 0%,
      transparent 64%
    );
}

.nv-blob {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(64px);
  opacity: 0.5;
  animation: drift 18s var(--ease-in-out) infinite;
}

.nv-blob--lilac {
  width: 26rem;
  height: 26rem;
  top: -6rem;
  left: -4rem;
  background: var(--color-macaron-lilac);
}

.nv-blob--sky {
  width: 22rem;
  height: 22rem;
  top: 8%;
  right: -6rem;
  background: var(--color-macaron-sky);
  animation-delay: -4s;
}

.nv-blob--peach {
  width: 24rem;
  height: 24rem;
  bottom: -8rem;
  left: 18%;
  background: var(--color-macaron-peach);
  animation-delay: -9s;
}

.nv-blob--mint {
  width: 18rem;
  height: 18rem;
  bottom: 6%;
  right: 14%;
  background: var(--color-macaron-mint);
  animation-delay: -13s;
}

@media (max-width: 640px) {
  .nv-blob {
    filter: blur(48px);
    opacity: 0.42;
  }
}
</style>
