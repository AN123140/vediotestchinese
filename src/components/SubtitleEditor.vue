<template>
  <div class="subtitle-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="header-left">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/></svg>
        <span class="panel-title">字幕编辑</span>
        <span v-if="subtitles.length" class="subtitle-count">{{ subtitles.length }} 条</span>
      </div>
      <div class="header-right">
        <button class="btn btn-sm btn-secondary" @click="$emit('add', -1)" title="添加字幕">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          添加
        </button>
        <button class="btn btn-sm btn-secondary" @click="toggleSortOrder" title="排序">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="10" y2="18"/></svg>
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!subtitles.length" class="empty-state">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/></svg>
      <p>暂无字幕</p>
      <p class="empty-hint">导入视频后点击「开始识别」<br>或手动添加字幕</p>
    </div>

    <!-- 字幕列表 -->
    <div v-else class="subtitle-list" ref="listRef">
      <div
        v-for="(sub, index) in subtitles"
        :key="sub.id"
        class="subtitle-item"
        :class="{ active: activeIndex === index, editing: editingIndex === index }"
        @click="selectItem(index)"
      >
        <!-- 序号 + 时间 -->
        <div class="item-header">
          <span class="item-index">{{ index + 1 }}</span>
          <div class="time-inputs">
            <input
              type="text"
              class="time-input"
              :value="formatTime(sub.start)"
              @click.stop
              @blur="e => updateTime(index, 'start', e.target.value)"
              @keydown.enter="e => e.target.blur()"
              title="开始时间 (MM:SS.ms)"
            />
            <span class="time-sep">→</span>
            <input
              type="text"
              class="time-input"
              :value="formatTime(sub.end)"
              @click.stop
              @blur="e => updateTime(index, 'end', e.target.value)"
              @keydown.enter="e => e.target.blur()"
              title="结束时间 (MM:SS.ms)"
            />
          </div>
          <span class="dur-badge">{{ getDuration(sub) }}s</span>
          <div class="item-actions">
            <button class="btn btn-icon" @click.stop="$emit('seek', sub.start)" title="跳转到此时间">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21"/></svg>
            </button>
            <button class="btn btn-icon" @click.stop="$emit('add', index)" title="在后面添加字幕">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="btn btn-icon danger" @click.stop="$emit('delete', index)" title="删除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <!-- 文本编辑 -->
        <div class="item-body">
          <textarea
            class="text-editor"
            :value="sub.text"
            rows="2"
            @click.stop
            @focus="editingIndex = index"
            @blur="editingIndex = -1"
            @input="e => $emit('update', index, { text: e.target.value })"
            placeholder="输入字幕文字..."
          ></textarea>
        </div>

        <!-- 时间轴可视化 -->
        <div class="timeline-bar" :title="`${formatTime(sub.start)} → ${formatTime(sub.end)}`">
          <div
            class="timeline-fill"
            :style="getTimelineStyle(sub)"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  subtitles: Array,
  currentTime: Number,
  activeIndex: Number,
})

const emit = defineEmits(['update', 'delete', 'add', 'seek'])

const listRef = ref(null)
const editingIndex = ref(-1)

// 自动滚动到激活字幕
watch(
  () => props.activeIndex,
  async (idx) => {
    if (idx < 0 || !listRef.value) return
    await nextTick()
    const items = listRef.value.querySelectorAll('.subtitle-item')
    if (items[idx]) {
      items[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
)

function selectItem(index) {
  if (props.subtitles[index]) {
    emit('seek', props.subtitles[index].start)
  }
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '00:00.000'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

function parseTime(str) {
  // 支持 MM:SS.ms 或 HH:MM:SS,ms 格式
  if (!str) return 0
  const parts = str.replace(',', '.').split(':')
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  } else if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(str) || 0
}

function updateTime(index, field, value) {
  const sec = parseTime(value)
  if (!isNaN(sec) && sec >= 0) {
    emit('update', index, { [field]: sec })
  }
}

function getDuration(sub) {
  return (sub.end - sub.start).toFixed(1)
}

// 时间轴可视化（基于整个序列中的相对位置）
function getTimelineStyle(sub) {
  if (!props.subtitles?.length) return {}
  const maxEnd = Math.max(...props.subtitles.map((s) => s.end))
  if (!maxEnd) return {}
  const left = (sub.start / maxEnd) * 100
  const width = Math.max(((sub.end - sub.start) / maxEnd) * 100, 1)
  return {
    left: left + '%',
    width: width + '%',
  }
}

function toggleSortOrder() {
  // 预留排序功能
}
</script>

<style scoped>
.subtitle-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.subtitle-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 7px;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 14px;
  font-weight: 500;
}

.empty-hint {
  font-size: 12px !important;
  font-weight: 400 !important;
  text-align: center;
  line-height: 1.7;
}

/* 字幕列表 */
.subtitle-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.subtitle-item {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.subtitle-item:hover {
  border-color: var(--border);
  background: var(--bg-hover);
}

.subtitle-item.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.subtitle-item.editing {
  border-color: rgba(76, 175, 132, 0.5);
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-index {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 18px;
  text-align: right;
  font-weight: 600;
}

.time-inputs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.time-input {
  width: 90px;
  padding: 3px 6px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 4px;
  text-align: center;
}

.time-input:focus {
  color: var(--text-primary);
  border-color: var(--accent);
}

.time-sep {
  font-size: 11px;
  color: var(--text-muted);
}

.dur-badge {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.15s;
}

.subtitle-item:hover .item-actions {
  opacity: 1;
}

.btn-icon.danger:hover {
  color: var(--danger);
  background: rgba(224, 92, 109, 0.1);
}

.item-body {
  margin-bottom: 8px;
}

.text-editor {
  width: 100%;
  resize: none;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
  padding: 6px 8px;
  user-select: text;
}

.text-editor:focus {
  border-color: var(--success);
  outline: none;
}

/* 时间轴条 */
.timeline-bar {
  height: 3px;
  background: var(--bg-hover);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.timeline-fill {
  position: absolute;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  opacity: 0.6;
}

.subtitle-item.active .timeline-fill {
  opacity: 1;
}
</style>
