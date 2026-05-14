<template>
  <div class="translate-panel">
    <!-- 设置栏 -->
    <div class="translate-settings-bar">
      <div class="setting-item">
        <label>翻译引擎</label>
        <select v-model="engine" class="setting-select">
          <option value="local">本地模型</option>
          <option value="baidu">百度翻译</option>
          <option value="youdao">有道翻译</option>
          <option value="deepl">DeepL</option>
        </select>
      </div>
      <div class="setting-item">
        <label>目标语言</label>
        <select v-model="targetLang" class="setting-select">
          <option value="en">英文</option>
          <option value="zh">中文</option>
          <option value="ja">日文</option>
          <option value="ko">韩文</option>
        </select>
      </div>
      <div class="setting-item">
        <label>翻译模式</label>
        <select v-model="mode" class="setting-select">
          <option value="dual">双语对照</option>
          <option value="single">单语替换</option>
        </select>
      </div>

      <div class="translate-actions-top">
        <button class="btn btn-primary btn-sm" @click="startTranslate"
                :disabled="store.subtitles.length === 0 || isTranslating">
          <svg v-if="!isTranslating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          <svg v-else class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
          </svg>
          {{ isTranslating ? `翻译中 ${progress}%` : '开始翻译' }}
        </button>
        <button class="btn btn-success btn-sm" @click="applyTranslation"
                :disabled="translationResults.length === 0" v-if="mode === 'single'">
          应用翻译
        </button>
        <button class="btn btn-success btn-sm" @click="exportDualSrt"
                :disabled="translationResults.length === 0" v-else>
          导出双语字幕
        </button>
      </div>
    </div>

    <!-- 无字幕提示 -->
    <div v-if="store.subtitles.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/>
        <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
      </svg>
      <p>请先在"单视频处理"中导入视频并完成语音识别</p>
    </div>

    <!-- 翻译对照区 -->
    <div v-else class="translate-content">
      <div class="translate-columns">
        <!-- 原文字幕 -->
        <div class="translate-column">
          <div class="column-header">
            <span>原文字幕 ({{ store.subtitles.length }}条)</span>
          </div>
          <div class="column-body">
            <div v-for="(sub, i) in store.subtitles" :key="i"
                 class="subtitle-row"
                 :class="{ active: currentTranslatingIndex === i }">
              <div class="sub-index">{{ i + 1 }}</div>
              <div class="sub-body">
                <div class="sub-time">{{ formatTime(sub.start) }} → {{ formatTime(sub.end) }}</div>
                <div class="sub-text">{{ sub.text }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 翻译结果 -->
        <div class="translate-column">
          <div class="column-header">
            <span>翻译结果 ({{ translationResults.length }}/{{ store.subtitles.length }})</span>
            <span v-if="stats.total > 0" class="confidence-badge">
              平均置信度: {{ stats.avgConfidence }}%
            </span>
          </div>
          <div class="column-body">
            <div v-for="(result, i) in translationResults" :key="i" class="subtitle-row">
              <div class="sub-index">{{ i + 1 }}</div>
              <div class="sub-body">
                <div class="sub-meta">
                  <span class="confidence" :class="{ low: result.confidence < 0.85 }">
                    {{ Math.round(result.confidence * 100) }}%
                  </span>
                  <button class="btn-icon retranslate-btn" title="重新翻译" @click="handleRetranslate(i)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                    </svg>
                  </button>
                </div>
                <textarea class="sub-text-edit" v-model="result.translated"
                          @blur="updateTranslation(i, result.translated)"></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 术语库 -->
    <div class="translate-footer">
      <span class="glossary-info">术语库: 已加载 {{ store.glossary.length }} 条专业术语</span>
      <button class="btn btn-secondary btn-sm" @click="showGlossary = true">管理术语库</button>
    </div>

    <!-- 术语库弹窗 -->
    <div v-if="showGlossary" class="modal-overlay" @click.self="showGlossary = false">
      <div class="modal" style="min-width: 500px">
        <div class="modal-header">
          <span class="modal-title">术语库管理</span>
          <button class="modal-close" @click="showGlossary = false">&times;</button>
        </div>
        <div class="glossary-content">
          <!-- 添加术语 -->
          <div class="glossary-add">
            <input type="text" v-model="newTerm.source" placeholder="源语言术语" />
            <span class="arrow">→</span>
            <input type="text" v-model="newTerm.target" placeholder="目标语言术语" />
            <button class="btn btn-primary btn-sm" @click="addTerm">添加</button>
          </div>
          <!-- 术语列表 -->
          <div class="glossary-list">
            <div v-for="(term, i) in store.glossary" :key="i" class="glossary-item">
              <span class="term-source">{{ term.source }}</span>
              <span class="term-arrow">→</span>
              <span class="term-target">{{ term.target }}</span>
              <button class="btn-icon" @click="removeTerm(i)" title="删除">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div v-if="store.glossary.length === 0" class="glossary-empty">
              暂无术语，请在上方添加
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="exportGlossary">导出术语库</button>
          <button class="btn btn-secondary" @click="importGlossary">导入术语库</button>
          <button class="btn btn-primary" @click="showGlossary = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import store from '../composables/useAppStore.js'
import { useTranslator } from '../composables/useTranslator.js'
import { formatSrtTime } from '../utils/formatTime.js'
import { generateSRT } from '../utils/exportFormats.js'

const {
  translationResults, isTranslating, currentTranslatingIndex, progress,
  translateAll, retranslate, updateTranslation, applyTranslation,
  generateDualSubtitles, stats,
} = useTranslator()

const engine = ref('local')
const targetLang = ref('en')
const mode = ref('dual')
const showGlossary = ref(false)
const newTerm = reactive({ source: '', target: '' })

function formatTime(sec) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function startTranslate() {
  await translateAll(store.subtitles, targetLang.value)
  store.notify('success', `翻译完成，共 ${translationResults.value.length} 条`)
}

async function handleRetranslate(index) {
  await retranslate(index, store.subtitles[index].text, targetLang.value)
  store.notify('info', `第 ${index + 1} 条已重新翻译`)
}

function applyTranslationHandler() {
  applyTranslation(store.subtitles, mode.value)
  store.notify('success', '翻译已应用到字幕')
}

function exportDualSrt() {
  const dual = generateDualSubtitles(store.subtitles)
  const content = generateSRT(dual)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bilingual_subtitles.srt'
  a.click()
  URL.revokeObjectURL(url)
  store.notify('success', '双语字幕已导出')
}

function addTerm() {
  if (!newTerm.source || !newTerm.target) return
  store.glossary.push({ source: newTerm.source, target: newTerm.target })
  newTerm.source = ''
  newTerm.target = ''
}

function removeTerm(index) {
  store.glossary.splice(index, 1)
}

function exportGlossary() {
  const blob = new Blob([JSON.stringify(store.glossary, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'glossary.json'
  a.click()
  URL.revokeObjectURL(url)
}

function importGlossary() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (Array.isArray(data)) {
          store.glossary = [...store.glossary, ...data]
          store.notify('success', `导入了 ${data.length} 条术语`)
        }
      } catch { store.notify('error', '术语库文件格式错误') }
    }
    reader.readAsText(file)
  }
  input.click()
}
</script>

<style scoped>
/* ===== 面板根 ===== */
.translate-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

/* ===== 顶部设置栏（卡片式） ===== */
.translate-settings-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 8px 12px 4px;
  background: var(--bg-card, var(--bg-secondary));
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
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
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.setting-select {
  height: 32px;
  padding: 0 28px 0 10px;
  font-size: 12px;
  font-weight: 500;
  min-width: 110px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #d0d7de);
  background: var(--bg-input, #fff);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(79, 142, 247, 0.12));
}

.translate-actions-top {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

/* ===== 空状态 ===== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: var(--text-muted);
  padding: 40px;
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  color: var(--text-secondary);
}

/* ===== 翻译对照区 ===== */
.translate-content {
  flex: 1;
  overflow: hidden;
  padding: 4px 12px 0;
}

.translate-columns {
  display: flex;
  height: 100%;
  gap: 2px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-card, var(--bg-secondary));
}

.translate-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.translate-column:first-child {
  border-right: 1px solid var(--border-light);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-header, #f6f8fa);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  letter-spacing: 0.3px;
}

.confidence-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--success);
  background: var(--success-bg, rgba(34, 197, 94, 0.10));
  padding: 3px 8px;
  border-radius: 20px;
}

.column-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

/* ===== 字幕行 ===== */
.subtitle-row {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.03));
  transition: background 0.12s ease;
}

.subtitle-row:last-child {
  border-bottom: none;
}

.subtitle-row.active {
  background: var(--accent-very-light, rgba(79, 142, 247, 0.06));
  box-shadow: inset 3px 0 0 var(--accent);
}

.subtitle-row:hover {
  background: var(--bg-hover);
}

.sub-index {
  width: 20px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-align: right;
  padding-top: 2px;
  flex-shrink: 0;
}

.sub-body {
  flex: 1;
  min-width: 0;
}

.sub-time {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 3px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
}

.sub-text {
  font-size: 13.5px;
  color: var(--text-primary);
  line-height: 1.55;
  word-break: break-word;
}

/* 翻译结果列的 meta 区 */
.sub-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.confidence {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 20px;
  letter-spacing: 0.2px;
}

/* 置信度颜色编码 */
.confidence:not(.low) {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.10);
}

.confidence.low {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.08);
}

.retranslate-btn {
  padding: 3px;
  border-radius: 4px;
  opacity: 0.4;
  transition: opacity 0.15s, background 0.15s;
  cursor: pointer;
  background: transparent;
  border: none;
  color: var(--text-muted);
}

.retranslate-btn:hover {
  opacity: 1;
  background: var(--bg-hover);
  color: var(--accent);
}

/* ===== 翻译文本编辑框 ===== */
.sub-text-edit {
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  font-size: 13.5px;
  line-height: 1.55;
  resize: vertical;
  font-family: inherit;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--bg-input, #fafbfc);
  color: var(--text-primary);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.sub-text-edit:hover {
  border-color: var(--border-color, #d0d7de);
}

.sub-text-edit:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--accent-ring, rgba(79, 142, 247, 0.12));
}

/* ===== 底部状态栏 ===== */
.translate-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  margin: 4px 12px 8px;
  background: var(--bg-card, var(--bg-secondary));
  border: 1px solid var(--border-light);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
}

.glossary-info {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
}

/* ===== 术语库弹窗 ===== */
.glossary-content {
  margin-bottom: 16px;
}

.glossary-add {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.glossary-add input {
  flex: 1;
  padding: 7px 10px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.glossary-add .arrow,
.glossary-item .term-arrow {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
}

.glossary-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
}

.glossary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle, rgba(0, 0, 0, 0.03));
  transition: background 0.12s;
}

.glossary-item:last-child {
  border-bottom: none;
}

.glossary-item:hover {
  background: var(--bg-hover);
}

.term-source {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.term-target {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
}

.glossary-empty {
  padding: 28px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* ===== 动画 ===== */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 滚动条美化 ===== */
.column-body::-webkit-scrollbar,
.glossary-list::-webkit-scrollbar {
  width: 5px;
}

.column-body::-webkit-scrollbar-track,
.glossary-list::-webkit-scrollbar-track {
  background: transparent;
}

.column-body::-webkit-scrollbar-thumb,
.glossary-list::-webkit-scrollbar-thumb {
  background: var(--border-color, #d0d7de);
  border-radius: 10px;
}

.column-body::-webkit-scrollbar-thumb:hover,
.glossary-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
