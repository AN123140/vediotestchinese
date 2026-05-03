<template>
  <div class="one-click-optimize">
    <div class="oco-header">
      <div class="oco-icon">⚡</div>
      <div>
        <div class="oco-title">一键全优化</div>
        <div class="oco-subtitle">依次执行所有 AI 优化功能，一步到位</div>
      </div>
    </div>

    <!-- 步骤列表 -->
    <div class="steps-list">
      <div
        v-for="step in steps"
        :key="step.id"
        class="step-item"
        :class="{ active: currentStep === step.id, done: doneSteps.includes(step.id), optional: step.optional }"
      >
        <div class="step-icon">
          <span v-if="doneSteps.includes(step.id)">✓</span>
          <span v-else-if="currentStep === step.id" class="spinner-sm"></span>
          <span v-else>{{ step.num }}</span>
        </div>
        <div class="step-body">
          <div class="step-name">{{ step.name }} <span v-if="step.optional" class="optional-tag">可选</span></div>
          <div class="step-desc">{{ step.desc }}</div>
        </div>
        <label v-if="step.optional" class="step-toggle" @click.stop>
          <input type="checkbox" v-model="step.enabled" />
          <span>{{ step.enabled ? '开' : '关' }}</span>
        </label>
        <div v-else-if="doneSteps.includes(step.id)" class="step-result">
          {{ stepResults[step.id] }}
        </div>
      </div>
    </div>

    <!-- 整体进度 -->
    <div v-if="isRunning || isDone" class="progress-section">
      <div class="progress-bar-wrap">
        <div class="progress-bar" :style="{ width: overallProgress + '%' }"></div>
      </div>
      <div class="progress-text">{{ progressText }}</div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-row">
      <button
        class="btn-big-primary"
        :disabled="isRunning || !hasSubtitles"
        @click="runAll"
      >
        <span v-if="isRunning" class="spinner"></span>
        {{ isRunning ? '优化中...' : isDone ? '重新优化' : '开始全优化' }}
      </button>
      <button v-if="isDone && canUndo" class="btn-ghost" @click="undoAll">↩ 撤销全部</button>
    </div>

    <div v-if="!hasSubtitles" class="empty-hint">请先完成语音识别，获取字幕后再使用此功能。</div>

    <!-- 优化汇总 -->
    <div v-if="isDone && summary" class="summary-section">
      <div class="summary-title">✅ 优化完成</div>
      <div class="summary-grid">
        <div class="summary-item" v-for="s in summaryItems" :key="s.label">
          <div class="summary-num">{{ s.value }}</div>
          <div class="summary-label">{{ s.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import store, { useAppStore } from '../composables/useAppStore.js'

const emit = defineEmits(['done'])
const { notify } = useAppStore()

const steps = reactive([
  { id: 'segment',     num: '1', name: '智能分段', desc: '合并/拆分过短或过长字幕', optional: false, enabled: true },
  { id: 'punctuation', num: '2', name: '智能标点', desc: '自动添加标点符号', optional: false, enabled: true },
  { id: 'correction',  num: '3', name: '上下文纠错', desc: '修正专有名词和同音字', optional: false, enabled: true },
  { id: 'emotion',     num: '4', name: '情感识别', desc: '识别情绪并适配字幕样式', optional: true, enabled: false },
])

const isRunning = ref(false)
const isDone = ref(false)
const canUndo = ref(false)
const currentStep = ref(null)
const doneSteps = ref([])
const stepResults = reactive({})
const overallProgress = ref(0)
const progressText = ref('')
const summary = ref(null)
const backupSubtitles = ref(null)

const hasSubtitles = computed(() => store.subtitles.length > 0)

const summaryItems = computed(() => {
  if (!summary.value) return []
  return [
    { label: '分段优化', value: summary.value.segment ?? '-' },
    { label: '标点添加', value: summary.value.punctuation ?? '-' },
    { label: '纠错修正', value: summary.value.correction ?? '-' },
  ]
})

const BACKEND = 'http://127.0.0.1:8765'
const enabledSteps = computed(() => steps.filter(s => s.enabled))
const stepWeight = computed(() => {
  const n = enabledSteps.value.length
  return n > 0 ? 100 / n : 100
})

async function runAll() {
  if (!hasSubtitles.value) return
  isRunning.value = true
  isDone.value = false
  doneSteps.value = []
  overallProgress.value = 0
  summary.value = null

  backupSubtitles.value = JSON.parse(JSON.stringify(store.subtitles))
  canUndo.value = true

  const sumData = {}

  try {
    for (const step of enabledSteps.value) {
      currentStep.value = step.id
      progressText.value = `正在执行：${step.name}...`

      try {
        const result = await callStep(step.id)
        if (result) {
          store.subtitles = result.subtitles
          sumData[step.id] = result.changes_count ?? result.changes?.length ?? 0
          stepResults[step.id] = `${sumData[step.id]} 处`
        }
      } catch (e) {
        stepResults[step.id] = '跳过（失败）'
        sumData[step.id] = '-'
      }

      doneSteps.value.push(step.id)
      overallProgress.value = Math.round((doneSteps.value.length / enabledSteps.value.length) * 100)
    }

    currentStep.value = null
    progressText.value = '全部优化完成！'
    summary.value = sumData
    isDone.value = true
    notify('success', '一键全优化完成！')
    emit('done')
  } finally {
    isRunning.value = false
  }
}

async function callStep(stepId) {
  const body = { subtitles: store.subtitles }
  const endpoints = {
    segment: '/api/ai/segment',
    punctuation: '/api/ai/punctuation',
    correction: '/api/ai/correction',
    emotion: '/api/ai/emotion',
  }
  const ep = endpoints[stepId]
  if (!ep) return null

  const resp = await fetch(BACKEND + ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) throw new Error(`${stepId} 接口失败`)
  return await resp.json()
}

function undoAll() {
  if (!backupSubtitles.value) return
  store.subtitles = backupSubtitles.value
  backupSubtitles.value = null
  canUndo.value = false
  doneSteps.value = []
  isDone.value = false
  summary.value = null
  overallProgress.value = 0
  progressText.value = ''
  notify('success', '已撤销全部 AI 优化')
}
</script>

<style scoped>
.one-click-optimize {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.oco-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: var(--accent-light);
  border: 1px solid var(--accent);
  border-radius: 10px;
}

.oco-icon { font-size: 28px; }

.oco-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.oco-subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

/* ===== 步骤列表 ===== */
.steps-list { display: flex; flex-direction: column; gap: 8px; }

.step-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  transition: all 0.2s;
}

.step-item.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.step-item.done {
  border-color: #22c55e44;
}

.step-icon {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-light);
  border-radius: 50%;
  font-size: 12px; font-weight: 700; color: var(--text-secondary);
  flex-shrink: 0;
}

.step-item.active .step-icon {
  border-color: var(--accent); color: var(--accent);
}

.step-item.done .step-icon {
  background: #22c55e; border-color: #22c55e; color: #fff;
}

.spinner-sm {
  width: 12px; height: 12px;
  border: 2px solid var(--accent); border-top-color: transparent;
  border-radius: 50%; animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.step-body { flex: 1; min-width: 0; }
.step-name { font-size: 13px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px; }
.step-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.optional-tag {
  font-size: 10px; padding: 1px 6px;
  background: rgba(245,158,11,0.12); color: #f59e0b;
  border-radius: 10px; font-weight: 500;
}

.step-toggle {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-secondary); cursor: pointer;
}

.step-result {
  font-size: 12px; color: #22c55e; font-weight: 600; white-space: nowrap;
}

/* ===== 进度 ===== */
.progress-section { display: flex; flex-direction: column; gap: 8px; }

.progress-bar-wrap {
  height: 6px; background: var(--border-light); border-radius: 3px; overflow: hidden;
}

.progress-bar {
  height: 100%; background: var(--accent);
  border-radius: 3px; transition: width 0.4s ease;
}

.progress-text { font-size: 12px; color: var(--text-secondary); }

/* ===== 操作 ===== */
.action-row {
  display: flex; align-items: center; gap: 14px;
}

.btn-big-primary {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 28px;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-big-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-big-primary:not(:disabled):hover { opacity: 0.85; }

.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
}

.btn-ghost {
  padding: 9px 18px; background: transparent;
  border: 1px solid var(--border-light); border-radius: 8px;
  color: var(--text-secondary); font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.empty-hint {
  padding: 16px; background: var(--bg-secondary);
  border: 1px dashed var(--border-light); border-radius: 8px;
  font-size: 13px; color: var(--text-secondary); text-align: center;
}

/* ===== 汇总 ===== */
.summary-section {
  padding: 20px; background: rgba(34,197,94,0.06);
  border: 1px solid #22c55e44; border-radius: 10px;
}

.summary-title { font-size: 14px; font-weight: 700; color: #22c55e; margin-bottom: 14px; }

.summary-grid {
  display: flex; gap: 20px;
}

.summary-item {
  text-align: center; min-width: 80px;
}

.summary-num { font-size: 24px; font-weight: 800; color: var(--accent); }
.summary-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
</style>
