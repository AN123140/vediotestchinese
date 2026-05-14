<template>
  <div class="context-correction">
    <!-- 操作按钮 -->
    <div class="action-row">
      <button class="btn-primary" :disabled="isProcessing || !hasSubtitles" @click="runCorrection">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '分析中...' : '开始纠错分析' }}
      </button>
      <button v-if="canUndo" class="btn-ghost" @click="undoAll">↩ 全部撤销</button>
    </div>

    <div v-if="!hasSubtitles" class="empty-hint">请先完成语音识别，获取字幕后再使用此功能。</div>

    <!-- 统计信息 -->
    <div v-if="stats" class="stats-bar">
      <span class="stat-item">
        发现 <strong>{{ stats.total }}</strong> 处问题
      </span>
      <span class="stat-sep">·</span>
      <span class="stat-item success">
        自动修正 <strong>{{ stats.auto }}</strong> 处
      </span>
      <span class="stat-sep">·</span>
      <span class="stat-item warn">
        待确认 <strong>{{ stats.pending }}</strong> 处
      </span>
    </div>

    <!-- 待确认问题 -->
    <div v-if="pendingItems.length" class="section">
      <div class="section-title">待确认问题</div>
      <div class="table-wrap">
        <table class="result-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>原文</th>
              <th>建议修正</th>
              <th>置信度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in pendingItems" :key="i" :class="{ accepted: item.accepted, ignored: item.ignored }">
              <td class="col-idx">{{ item.subtitleIndex + 1 }}</td>
              <td class="col-orig">{{ item.original }}</td>
              <td class="col-suggest">{{ item.suggestion }}</td>
              <td class="col-conf">
                <span class="conf-badge" :class="confClass(item.confidence)">
                  {{ item.confidence }}%
                </span>
              </td>
              <td class="col-action">
                <template v-if="!item.accepted && !item.ignored">
                  <button class="btn-accept" @click="acceptItem(i)">接受</button>
                  <button class="btn-ignore" @click="ignoreItem(i)">忽略</button>
                </template>
                <span v-else-if="item.accepted" class="status-tag accepted">已接受</span>
                <span v-else class="status-tag ignored">已忽略</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="bulk-action-row">
        <button class="btn-primary-sm" @click="acceptAll">一键接受所有</button>
        <button class="btn-ghost-sm" @click="addToHotwords">添加到热词库</button>
      </div>
    </div>

    <!-- 已自动修正 -->
    <div v-if="autoFixedItems.length" class="section">
      <div class="section-title">已自动修正</div>
      <div class="table-wrap">
        <table class="result-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>原文</th>
              <th>修正后</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in autoFixedItems" :key="i">
              <td class="col-idx">{{ item.subtitleIndex + 1 }}</td>
              <td class="col-orig">{{ item.original }}</td>
              <td class="col-suggest">{{ item.suggestion }}</td>
              <td class="col-desc">{{ item.reason }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import store, { useAppStore } from '../composables/useAppStore.js'

const { notify } = useAppStore()

const isProcessing = ref(false)
const stats = ref(null)
const pendingItems = ref([])
const autoFixedItems = ref([])
const backupSubtitles = ref(null)
const canUndo = ref(false)

const hasSubtitles = computed(() => store.subtitles.length > 0)

function confClass(conf) {
  if (conf >= 90) return 'high'
  if (conf >= 75) return 'mid'
  return 'low'
}

async function runCorrection() {
  if (!hasSubtitles.value) return
  isProcessing.value = true
  try {
    const resp = await fetch('http://127.0.0.1:8081/api/ai/correction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subtitles: store.subtitles }),
    })
    if (!resp.ok) throw new Error('服务端错误')
    const result = await resp.json()

    backupSubtitles.value = JSON.parse(JSON.stringify(store.subtitles))
    canUndo.value = true

    autoFixedItems.value = result.auto_fixed || []
    pendingItems.value = (result.pending || []).map(item => ({ ...item, accepted: false, ignored: false }))
    store.subtitles = result.subtitles

    stats.value = {
      total: (result.auto_fixed?.length || 0) + (result.pending?.length || 0),
      auto: result.auto_fixed?.length || 0,
      pending: result.pending?.length || 0,
    }

    notify('success', `纠错完成：自动修正 ${stats.value.auto} 处，待确认 ${stats.value.pending} 处`)
  } catch (e) {
    notify('error', '纠错分析失败：' + e.message)
  } finally {
    isProcessing.value = false
  }
}

function acceptItem(i) {
  const item = pendingItems.value[i]
  item.accepted = true
  // 直接修改对应字幕
  const sub = store.subtitles[item.subtitleIndex]
  if (sub) sub.text = sub.text.replace(item.original, item.suggestion)
  notify('success', `已接受修正：${item.original} → ${item.suggestion}`)
}

function ignoreItem(i) {
  pendingItems.value[i].ignored = true
}

function acceptAll() {
  pendingItems.value.forEach((item, i) => {
    if (!item.accepted && !item.ignored) acceptItem(i)
  })
}

function undoAll() {
  if (!backupSubtitles.value) return
  store.subtitles = backupSubtitles.value
  backupSubtitles.value = null
  canUndo.value = false
  stats.value = null
  pendingItems.value = []
  autoFixedItems.value = []
  notify('success', '已撤销所有纠错修改')
}

function addToHotwords() {
  const accepted = pendingItems.value.filter(i => i.accepted)
  if (!accepted.length) {
    notify('warning', '请先接受至少一条修正')
    return
  }
  accepted.forEach(item => {
    if (!store.recognitionOptimize.hotwords.includes(item.suggestion)) {
      store.recognitionOptimize.hotwords.push(item.suggestion)
    }
  })
  notify('success', `已添加 ${accepted.length} 个词到热词库`)
}
</script>

<style scoped>
.context-correction {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-primary {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 20px;
  background: var(--accent); color: #fff;
  border: none; border-radius: 7px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.85; }

.btn-ghost {
  padding: 7px 14px;
  background: transparent; border: 1px solid var(--border-light);
  border-radius: 7px; color: var(--text-secondary);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-hint {
  padding: 16px; background: var(--bg-secondary);
  border: 1px dashed var(--border-light); border-radius: 8px;
  font-size: 13px; color: var(--text-secondary); text-align: center;
}

.stats-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; background: var(--bg-secondary);
  border: 1px solid var(--border-light); border-radius: 8px;
  font-size: 13px; color: var(--text-secondary);
}
.stat-sep { color: var(--border-light); }
.stat-item strong { color: var(--text-primary); font-weight: 700; }
.stat-item.success strong { color: #22c55e; }
.stat-item.warn strong { color: #f59e0b; }

.section { display: flex; flex-direction: column; gap: 10px; }
.section-title {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.05em;
}

.table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--border-light); }

.result-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
}

.result-table thead {
  background: var(--bg-secondary);
}

.result-table th {
  padding: 8px 12px; text-align: left;
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
}

.result-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
}

.result-table tr:last-child td { border-bottom: none; }
.result-table tr.accepted td { background: rgba(34,197,94,0.05); }
.result-table tr.ignored td { opacity: 0.5; }

.col-idx { width: 50px; color: var(--text-secondary); font-size: 11px; }
.col-orig { color: var(--text-secondary); }
.col-suggest { color: var(--accent); font-weight: 500; }
.col-desc { font-size: 12px; color: var(--text-secondary); }

.conf-badge {
  display: inline-block; padding: 2px 8px;
  border-radius: 10px; font-size: 11px; font-weight: 600;
}
.conf-badge.high { background: rgba(34,197,94,0.12); color: #22c55e; }
.conf-badge.mid { background: rgba(245,158,11,0.12); color: #f59e0b; }
.conf-badge.low { background: rgba(239,68,68,0.12); color: #ef4444; }

.col-action { white-space: nowrap; }

.btn-accept {
  padding: 3px 10px; background: var(--accent); color: #fff;
  border: none; border-radius: 4px; font-size: 12px; cursor: pointer; margin-right: 4px;
}
.btn-accept:hover { opacity: 0.85; }

.btn-ignore {
  padding: 3px 10px; background: transparent;
  border: 1px solid var(--border-light); border-radius: 4px;
  color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.btn-ignore:hover { border-color: #ef4444; color: #ef4444; }

.status-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
}
.status-tag.accepted { background: rgba(34,197,94,0.12); color: #22c55e; }
.status-tag.ignored { background: var(--bg-secondary); color: var(--text-secondary); }

.bulk-action-row {
  display: flex; gap: 10px; margin-top: 4px;
}

.btn-primary-sm {
  padding: 6px 14px; background: var(--accent); color: #fff;
  border: none; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.btn-primary-sm:hover { opacity: 0.85; }

.btn-ghost-sm {
  padding: 6px 14px; background: transparent;
  border: 1px solid var(--border-light); border-radius: 6px;
  color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.btn-ghost-sm:hover { border-color: var(--accent); color: var(--accent); }
</style>
