<template>
  <div class="batch-panel">
    <!-- 统一设置栏 -->
    <div class="batch-settings-bar">
      <div class="setting-item">
        <label>识别语言</label>
        <select v-model="store.batchLanguage" class="setting-select">
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="">自动检测</option>
        </select>
      </div>
      <div class="setting-item">
        <label>模型</label>
        <select v-model="store.batchModel" class="setting-select">
          <option value="large-v3">large-v3（高精度）</option>
          <option value="medium">medium（均衡）</option>
          <option value="small">small（快速）</option>
          <option value="base">base（极速）</option>
        </select>
      </div>
      <div class="setting-item">
        <label>输出到</label>
        <select v-model="batchOutputPath" class="setting-select">
          <option value="original">原文件夹</option>
          <option value="custom">自定义路径</option>
        </select>
      </div>

      <div class="batch-actions-top">
        <button class="btn btn-primary btn-sm" @click="handleAddFiles">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          添加文件
        </button>
        <button class="btn btn-danger btn-sm" @click="clearAll" :disabled="isProcessing || store.batchTasks.length === 0">
          清空全部
        </button>
      </div>
    </div>

    <!-- 拖拽区域（空状态） -->
    <div v-if="store.batchTasks.length === 0"
         class="drop-zone"
         :class="{ 'drop-active': isDragOver }"
         @dragover.prevent="isDragOver = true"
         @dragleave="isDragOver = false"
         @drop.prevent="handleDrop"
         @click="handleAddFiles">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="drop-icon">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M10 9l5 3-5 3V9z"/>
      </svg>
      <p class="drop-text">拖拽视频文件到此处，或点击"添加文件"按钮</p>
      <p class="drop-hint">支持 MP4、AVI、MOV、MKV、FLV、WMV、WebM 格式</p>
    </div>

    <!-- 任务列表 -->
    <div v-else class="batch-content">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px">序号</th>
            <th>文件名</th>
            <th style="width: 70px">时长</th>
            <th style="width: 80px">大小</th>
            <th style="width: 100px">状态</th>
            <th style="width: 60px">进度</th>
            <th style="width: 120px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(task, index) in store.batchTasks" :key="task.id" :class="{ 'row-processing': task.status === 'processing' }">
            <td>{{ index + 1 }}</td>
            <td class="task-name" :title="task.name">{{ task.name }}</td>
            <td>{{ formatDuration(task.duration) }}</td>
            <td>{{ formatSize(task.size) }}</td>
            <td>
              <span class="tag" :class="statusClass(task.status)">{{ statusText(task.status) }}</span>
            </td>
            <td>
              <div v-if="task.status === 'processing' || task.status === 'completed'" class="mini-progress">
                <div class="mini-progress-bar" :style="{ width: task.progress + '%' }"></div>
              </div>
              <span v-else class="text-muted">-</span>
            </td>
            <td>
              <div class="task-actions">
                <button class="btn-icon" title="上移" @click="moveUp(task.id)" :disabled="index === 0 || isProcessing">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button class="btn-icon" title="下移" @click="moveDown(task.id)" :disabled="index === store.batchTasks.length - 1 || isProcessing">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button class="btn-icon" title="删除" @click="removeTask(task.id)" :disabled="task.status === 'processing'">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 进度区 -->
      <div v-if="stats.total > 0" class="batch-progress-section">
        <div class="batch-progress-info">
          <div class="batch-stats">
            <span>总进度: {{ stats.completed }}/{{ stats.total }} 完成</span>
            <span v-if="stats.failed > 0" class="text-danger">{{ stats.failed }} 个失败</span>
          </div>
          <span class="batch-pct">{{ totalProgress }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-bar" :style="{ width: totalProgress + '%' }">
            <div class="progress-glow"></div>
          </div>
        </div>
        <div v-if="isProcessing" class="batch-current">
          <span class="spin-icon">⟳</span>
          <span>正在处理: {{ currentTaskName }}...</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="batch-bottom-actions">
        <div class="batch-btn-group">
          <button v-if="!isProcessing && !isPaused" class="btn btn-primary" @click="startBatch"
                  :disabled="stats.pending === 0 && stats.failed === 0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            开始批量处理
          </button>
          <button v-else-if="isProcessing" class="btn btn-warning" @click="pauseBatch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            暂停
          </button>
          <button v-else-if="isPaused" class="btn btn-primary" @click="resumeBatch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            继续
          </button>
          <button class="btn btn-danger" @click="cancelBatch" :disabled="!isProcessing && !isPaused">
            全部取消
          </button>
        </div>
        <div class="batch-btn-group">
          <button class="btn btn-success btn-sm" @click="exportAll" :disabled="stats.completed === 0">
            批量导出字幕
          </button>
          <button class="btn btn-secondary btn-sm" @click="exportReport" :disabled="stats.total === 0">
            导出报告
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import store from '../composables/useAppStore.js'
import { useBatchProcessor } from '../composables/useBatchProcessor.js'
import { formatDuration, formatSize } from '../utils/formatTime.js'
import { generateSRT } from '../utils/exportFormats.js'

const {
  addFiles, removeTask, clearAll, moveUp, moveDown,
  startBatch, pauseBatch, resumeBatch, cancelBatch, generateReport,
  stats, totalProgress, isProcessing, isPaused,
} = useBatchProcessor()

const isDragOver = ref(false)

const currentTaskName = computed(() => {
  const t = store.batchTasks.find(t => t.status === 'processing')
  return t ? t.name : ''
})

function handleDrop(e) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length) addFiles(files)
}

function handleAddFiles() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.accept = '.mp4,.avi,.mov,.mkv,.flv,.wmv,.webm,video/*'
  input.onchange = () => {
    if (input.files?.length) addFiles(input.files)
  }
  input.click()
}

function statusText(status) {
  const map = { pending: '待处理', waiting: '等待中', processing: '处理中', completed: '已完成', failed: '失败' }
  return map[status] || status
}

function statusClass(status) {
  const map = { pending: 'tag-info', waiting: 'tag-info', processing: 'tag-warning', completed: 'tag-success', failed: 'tag-danger' }
  return map[status] || ''
}

function exportAll() {
  const completed = store.batchTasks.filter(t => t.status === 'completed' && t.subtitles.length > 0)
  completed.forEach(task => {
    const content = generateSRT(task.subtitles)
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = task.name.replace(/\.\w+$/, '.srt')
    a.click()
    URL.revokeObjectURL(url)
  })
  store.notify('success', `已导出 ${completed.length} 个字幕文件`)
}

function exportReport() {
  const content = generateReport()
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `批量处理报告_${new Date().toISOString().slice(0, 10)}.txt`
  a.click()
  URL.revokeObjectURL(url)
  store.notify('success', '报告已导出')
}
</script>

<style scoped>
.batch-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 统一设置栏 */
.batch-settings-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.setting-item label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.setting-select {
  height: 30px;
  padding: 0 24px 0 8px;
  font-size: 12px;
  min-width: 120px;
}

.batch-actions-top {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

/* 拖拽区域 */
.drop-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 32px;
  padding: 48px;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  transition: all 0.2s;
  cursor: pointer;
}

.drop-zone:hover,
.drop-active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.drop-icon {
  color: var(--text-muted);
}

.drop-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.drop-hint {
  font-size: 12px;
  color: var(--text-muted);
}

/* 任务列表 */
.batch-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-table {
  flex: 1;
  overflow-y: auto;
}

.task-name {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-processing td {
  background: var(--accent-light);
}

.task-actions {
  display: flex;
  gap: 2px;
}

.mini-progress {
  width: 50px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.text-muted { color: var(--text-muted); font-size: 12px; }
.text-danger { color: var(--danger); font-size: 12px; }

/* 进度区 */
.batch-progress-section {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.batch-progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.batch-stats {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  gap: 12px;
}

.batch-pct {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.progress-track {
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: 3px;
  transition: width 0.4s;
  position: relative;
}

.progress-glow {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
}

.batch-current {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.spin-icon {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 底部操作 */
.batch-bottom-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.batch-btn-group {
  display: flex;
  gap: 8px;
}
</style>
