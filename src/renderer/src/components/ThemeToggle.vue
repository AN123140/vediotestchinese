<template>
  <button class="theme-toggle" @click="toggleTheme" :title="store.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'">
    <!-- 太阳图标（浅色模式时显示） -->
    <svg v-if="store.theme === 'light'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
    <!-- 月亮图标（深色模式时显示） -->
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  </button>
</template>

<script setup>
import store from '../composables/useAppStore.js'

function toggleTheme() {
  store.theme = store.theme === 'dark' ? 'light' : 'dark'
}
</script>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.theme-toggle:hover {
  background: var(--bg-active);
  color: var(--warning);
}
</style>
