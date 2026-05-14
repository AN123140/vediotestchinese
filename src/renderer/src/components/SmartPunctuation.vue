<template>
  <div class="smart-punct">
    <div class="section-title">标点类型开关</div>
    <div class="punct-toggles">
      <label v-for="pt in punctTypes" :key="pt.key" class="toggle-item">
        <input type="checkbox" v-model="enabledTypes[pt.key]" />
        <span class="toggle-label">{{ pt.icon }} {{ pt.name }}</span>
      </label>
    </div>

    <div class="section-title" style="margin-top:4px">处理范围</div>
    <div class="range-row">
      <label class="radio-item">
        <input type="radio" v-model="mode" value="all" />
        <span>全部字幕</span>
      </label>
      <label class="radio-item">
        <input type="radio" v-model="mode" value="selected" />
        <span>仅选中字幕（共 {{ selectedCount }} 条）</span>
      </label>
    </div>

    <div class="action-row">
      <button class="btn-primary" :disabled="isProcessing || !hasSubtitles" @click="runPunct">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '处理中...' : '一键添加标点' }}
      </button>
      <button v-if="canUndo" class="btn-ghost" @click="undoPunct">↩ 撤销</button>
    </div>

    <div v-if="!hasSubtitles" class="empty-hint">请先完成语音识别，获取字幕后再使用此功能。</div>

    <!-- 修正结果列表 -->
    <div v-if="resultItems.length" class="result-section">
      <div class="section-title">修正详情（{{ resultItems.length }} 处）</div>
      <div class="result-list">
        <div v-for="(item, i) in resultItems" :key="i" class="result-row">
          <span class="result-index">#{{ item.index + 1 }}</span>
          <span class="result-before">{{ item.before }}</span>
          <span class="result-arrow">→</span>
          <span class="result-after">{{ item.after }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import store, { useAppStore } from '../composables/useAppStore.js'

const { notify } = useAppStore()

const punctTypes = [
  { key: 'period',      icon: '。', name: '句号' },
  { key: 'comma',       icon: '，', name: '逗号' },
  { key: 'question',    icon: '？', name: '问号' },
  { key: 'exclamation', icon: '！', name: '感叹号' },
  { key: 'pause',       icon: '、', name: '顿号' },
  { key: 'colon',       icon: '：', name: '冒号' },
]

const enabledTypes = reactive({
  period: true, comma: true, question: true,
  exclamation: true, pause: true, colon: false,
})

const mode = ref('all')
const isProcessing = ref(false)
const resultItems = ref([])
const backupSubtitles = ref(null)
const canUndo = ref(false)

const hasSubtitles = computed(() => store.subtitles.length > 0)
const selectedCount = computed(() => 0) // 后续接入选中逻辑

async function runPunct() {
  if (!hasSubtitles.value) return
  isProcessing.value = true
  try {
    const resp = await fetch('http://127.0.0.1:8081/api/ai/punctuation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subtitles: store.subtitles,
        enabled_types: enabledTypes,
        mode: mode.value,
      }),
    })
    if (!resp.ok) throw new Error('服务端错误')
    const result = await resp.json()

    backupSubtitles.value = JSON.parse(JSON.stringify(store.subtitles))
    canUndo.value = true
    store.subtitles = result.subtitles
    resultItems.value = result.changes || []
    notify('success', `智能标点完成，共修正 ${result.changes?.length || 0} 处`)
  } catch (e) {
    notify('error', '智能标点失败：' + e.message)
  } finally {
    isProcessing.value = false
  }
}

function undoPunct() {
  if (!backupSubtitles.value) return
  store.subtitles = backupSubtitles.value
  backupSubtitles.value = null
  canUndo.value = false
  resultItems.value = []
  notify('success', '已撤销智能标点')
}
</script>

<style scoped>
.smart-punct {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: -6px;
}

.punct-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.15s;
}

.toggle-item:has(input:checked) {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
}

.toggle-item input {
  display: none;
}

.toggle-label {
  user-select: none;
}

.range-row {
  display: flex;
  gap: 20px;
  align-items: center;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
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

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.85; }

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

.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-hint {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}

.result-section { display: flex; flex-direction: column; gap: 10px; }

.result-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  font-size: 13px;
}

.result-index { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; min-width: 30px; }
.result-before { color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-arrow { color: var(--accent); flex-shrink: 0; }
.result-after { color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
