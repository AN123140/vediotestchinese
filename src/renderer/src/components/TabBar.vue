<template>
  <div class="tab-bar">
    <div class="tab-list">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-item"
        :class="{ active: activeTab === tab.id }"
        @click="$emit('update:activeTab', tab.id)"
        :title="tab.label"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>
    <div class="tab-bar-right">
      <ThemeToggle />
    </div>
  </div>
</template>

<script setup>
import { h } from 'vue'
import ThemeToggle from './ThemeToggle.vue'

defineProps({
  activeTab: { type: String, default: 'single' },
})
defineEmits(['update:activeTab'])

// SVG 图标组件
const VideoIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }),
      h('path', { d: 'M10 9l5 3-5 3V9z' }),
    ])
  }
}

const BatchIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('rect', { x: '3', y: '3', width: '7', height: '7', rx: '1' }),
      h('rect', { x: '14', y: '3', width: '7', height: '7', rx: '1' }),
      h('rect', { x: '3', y: '14', width: '7', height: '7', rx: '1' }),
      h('rect', { x: '14', y: '14', width: '7', height: '7', rx: '1' }),
    ])
  }
}

const TranslateIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M5 8l6 6' }),
      h('path', { d: 'M4 14l6-6 2-3' }),
      h('path', { d: 'M2 5h12' }),
      h('path', { d: 'M7 2h1' }),
      h('path', { d: 'M22 22l-5-10-5 10' }),
      h('path', { d: 'M14 18h6' }),
    ])
  }
}

const SettingsIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('circle', { cx: '12', cy: '12', r: '3' }),
      h('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' }),
    ])
  }
}

const AIIcon = {
  render() {
    return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      h('path', { d: 'M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z' }),
      h('circle', { cx: '9', cy: '10', r: '1', fill: 'currentColor', stroke: 'none' }),
      h('circle', { cx: '15', cy: '10', r: '1', fill: 'currentColor', stroke: 'none' }),
    ])
  }
}

const tabs = [
  { id: 'single',    label: '单视频处理', icon: VideoIcon },
  { id: 'batch',     label: '批量处理',   icon: BatchIcon },
  { id: 'translate', label: '字幕翻译',   icon: TranslateIcon },
  { id: 'ai',        label: 'AI 智能',    icon: AIIcon },
  { id: 'settings',  label: '设置',       icon: SettingsIcon },
]
</script>

<style scoped>
.tab-bar {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  gap: 8px;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  white-space: nowrap;
  height: 30px;
}

.tab-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-item.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.tab-icon {
  flex-shrink: 0;
}

.tab-label {
  line-height: 1;
}

.tab-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
