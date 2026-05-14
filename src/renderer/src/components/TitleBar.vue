<template>
  <div class="title-bar" :class="[mode, { 'is-electron': mode === 'electron' }]" @dblclick="handleDoubleClick">
    <!-- 左侧：Logo + 名称 + 版本 -->
    <div class="title-bar-left">
      <div class="app-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="14" rx="2" fill="none" stroke="#4f8ef7" stroke-width="1.5"/>
          <path d="M8 21h8M12 16v5" stroke="#4f8ef7" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M9 9l2 2 4-4" stroke="#4caf84" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="app-name">视频字幕生成器</span>
      <span class="version-tag">v3.2</span>
      <!-- 网页端环境标识 -->
      <span v-if="mode === 'browser'" class="env-badge">网页版</span>
    </div>

    <div class="title-drag-area"></div>

    <!-- 右侧：仅 Electron 模式显示窗口控制按钮 -->
    <div v-if="mode === 'electron'" class="title-bar-right">
      <button class="win-btn" :class="{ active: isOnTop }" @click.stop="toggleOnTop" :title="isOnTop ? '取消置顶' : '窗口置顶'">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>
        </svg>
      </button>
      <button class="win-btn" @click.stop="minimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button class="win-btn" @click.stop="maximize" title="最大化">
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
      </button>
      <button class="win-btn close-btn" @click.stop="close" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  /** 运行模式：'electron' | 'browser' */
  mode: {
    type: String,
    default: 'electron',
    validator: (v) => ['electron', 'browser'].includes(v),
  },
})

const isOnTop = ref(false)

function minimize() {
  window.electronAPI.windowMinimize()
}
function maximize() {
  window.electronAPI.windowMaximize()
}
function close() {
  window.electronAPI.windowClose()
}
function handleDoubleClick() {
  if (props.mode === 'electron') window.electronAPI.windowMaximize()
}
async function toggleOnTop() {
  isOnTop.value = !isOnTop.value
  await window.electronAPI.windowSetOnTop(isOnTop.value)
}
</script>

<style scoped>
.title-bar {
  height: 38px;
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

/* 仅 Electron 模式启用拖拽 */
.title-bar.is-electron {
  -webkit-app-region: drag;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
}

.title-bar.is-electron .title-bar-left {
  -webkit-app-region: no-drag;
}

.app-logo {
  display: flex;
  align-items: center;
}

.app-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.version-tag {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
}

.env-badge {
  font-size: 10px;
  color: #fff;
  background: #4f8ef7;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.title-drag-area {
  flex: 1;
  height: 100%;
}

.title-bar.is-electron .title-drag-area {
  -webkit-app-region: drag;
}

.title-bar-right {
  display: flex;
}

.title-bar.is-electron .title-bar-right {
  -webkit-app-region: no-drag;
}

.win-btn {
  width: 46px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:hover {
  background: var(--danger);
  color: #fff;
}

.win-btn.active {
  color: var(--accent);
  background: var(--accent-light);
}
</style>
