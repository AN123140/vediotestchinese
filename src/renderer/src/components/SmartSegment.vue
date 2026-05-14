<template>
  <div class="smart-segment">
    <div class="section-title">优化设置</div>
    <div class="settings-row">
      <div class="setting-item">
        <label>最小时长</label>
        <div class="input-group">
          <input type="number" v-model.number="config.minDuration" min="0.5" max="3" step="0.5" />
          <span class="unit">秒</span>
        </div>
      </div>
      <div class="setting-item">
        <label>最大时长</label>
        <div class="input-group">
          <input type="number" v-model.number="config.maxDuration" min="3" max="15" step="0.5" />
          <span class="unit">秒</span>
        </div>
      </div>
      <div class="setting-item">
        <label>最少字数</label>
        <div class="input-group">
          <input type="number" v-model.number="config.minChars" min="2" max="10" />
          <span class="unit">字</span>
        </div>
      </div>
      <div class="setting-item">
        <label>最多字数</label>
        <div class="input-group">
          <input type="number" v-model.number="config.maxChars" min="10" max="50" />
          <span class="unit">字</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-row">
      <button class="btn-primary" :disabled="isProcessing || !hasSubtitles" @click="runSegment">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '优化中...' : '开始智能优化' }}
      </button>
      <span v-if="previewResult" class="estimate-hint">
        预计优化 <strong>{{ previewResult.changes }}</strong> 处
      </span>
      <button v-if="canUndo" class="btn-ghost" @click="undoSegment">↩ 撤销</button>
    </div>

    <!-- 无字幕提示 -->
    <div v-if="!hasSubtitles" class="empty-hint">请先完成语音识别，获取字幕后再使用此功能。</div>

    <!-- 对比预览 -->
    <div v-if="previewResult" class="preview-area">
      <div class="preview-col">
        <div class="preview-label">优化前 ({{ previewResult.before.length }} 条)</div>
        <div class="preview-list">
          <div
            v-for="(item, i) in previewResult.before"
            :key="i"
            class="preview-item"
            :class="{ changed: item.changed }"
          >
            <span class="preview-text">{{ item.text }}</span>
            <span class="preview-time">{{ formatDuration(item.start, item.end) }}</span>
          </div>
        </div>
      </div>
      <div class="preview-arrow">→</div>
      <div class="preview-col">
        <div class="preview-label">优化后 ({{ previewResult.after.length }} 条)</div>
        <div class="preview-list">
          <div
            v-for="(item, i) in previewResult.after"
            :key="i"
            class="preview-item"
            :class="{ changed: item.changed }"
          >
            <span class="preview-text">{{ item.text }}</span>
            <span class="preview-time">{{ formatDuration(item.start, item.end) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import store, { useAppStore } from '../composables/useAppStore.js'

const { notify } = useAppStore()

const config = ref({
  minDuration: 1.0,
  maxDuration: 8.0,
  minChars: 4,
  maxChars: 20,
})

const isProcessing = ref(false)
const previewResult = ref(null)
const backupSubtitles = ref(null)
const canUndo = ref(false)

const hasSubtitles = computed(() => store.subtitles.length > 0)

function formatDuration(start, end) {
  const d = end - start
  return `${d.toFixed(1)}秒`
}

async function runSegment() {
  if (!hasSubtitles.value) return
  isProcessing.value = true
  try {
    const resp = await fetch('http://127.0.0.1:8081/api/ai/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtitles: store.subtitles,
        config: config.value,
      }),
    })
    if (!resp.ok) throw new Error('服务端错误')
    const result = await resp.json()

    // 保存备份
    backupSubtitles.value = JSON.parse(JSON.stringify(store.subtitles))
    canUndo.value = true

    // 构造预览（取前10条变化作展示）
    previewResult.value = {
      changes: result.changes_count || 0,
      before: result.before_preview || [],
      after: result.after_preview || [],
    }

    // 应用结果
    store.subtitles = result.subtitles
    notify('success', `智能分段完成，共优化 ${result.changes_count} 处`)
  } catch (e) {
    notify('error', '智能分段失败：' + e.message)
  } finally {
    isProcessing.value = false
  }
}

function undoSegment() {
  if (!backupSubtitles.value) return
  store.subtitles = backupSubtitles.value
  backupSubtitles.value = null
  canUndo.value = false
  previewResult.value = null
  notify('success', '已撤销智能分段')
}
</script>

<style scoped>
.smart-segment {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: -8px;
}

.settings-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-item label {
  font-size: 12px;
  color: var(--text-secondary);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  padding: 5px 10px;
}

.input-group input {
  width: 60px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  text-align: center;
  outline: none;
}

.unit {
  font-size: 12px;
  color: var(--text-secondary);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary:not(:disabled):hover {
  opacity: 0.85;
}

.btn-ghost {
  padding: 7px 14px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 7px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.estimate-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.estimate-hint strong {
  color: var(--accent);
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-hint {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

/* ===== 对比预览 ===== */
.preview-area {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.preview-col {
  flex: 1;
  min-width: 0;
}

.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 13px;
  gap: 8px;
}

.preview-item.changed {
  border-color: var(--accent);
  background: var(--accent-light);
}

.preview-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.preview-time {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.preview-arrow {
  font-size: 20px;
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 28px;
}
</style>
