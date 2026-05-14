<template>
  <div class="video-panel" @dragover.prevent @drop.prevent="onDrop">
    <!-- 无视频时的空状态 -->
    <div v-if="!videoSrc" class="drop-zone" @click="$emit('drop-video', null)" @dragover="dragOver = true" @dragleave="dragOver = false" :class="{ 'drag-over': dragOver }">
      <div class="drop-content">
        <div class="drop-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <rect x="4" y="8" width="48" height="34" rx="4" fill="none" stroke="#4f8ef7" stroke-width="2" stroke-dasharray="6 3"/>
            <path d="M22 25l8-8 8 8M30 17v16" stroke="#4f8ef7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M16 48h24M28 42v6" stroke="#4f8ef7" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="drop-title">拖拽视频文件到此处</p>
        <p class="drop-sub">支持 MP4 / AVI / MOV / MKV / FLV 等格式</p>
        <button class="btn btn-primary" style="margin-top: 16px;" @click.stop="$emit('drop-video', null)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          选择视频文件
        </button>

        <!-- 最近文件列表 -->
        <div v-if="recentFiles.length > 0" class="recent-files">
          <div class="recent-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            最近打开
          </div>
          <div class="recent-list">
            <div v-for="file in recentFiles.slice(0, 5)" :key="file.path"
                 class="recent-item"
                 @click.stop="openRecentFile(file)"
                 :title="file.path">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span class="recent-name">{{ file.name }}</span>
            </div>
          </div>
          <button class="recent-clear" @click.stop="clearRecent">清除记录</button>
        </div>
      </div>
    </div>

    <!-- 有视频时的播放器 -->
    <template v-else>
      <div class="player-header">
        <span class="file-name" :title="videoInfo?.name">{{ videoInfo?.name }}</span>
        <span class="file-meta">{{ videoInfo?.size }}</span>
        <button class="btn btn-sm btn-secondary" @click="clearVideo" title="清除视频">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="video-container">
        <video
          ref="videoRef"
          :src="videoSrc"
          class="video-element"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoaded"
          @click="togglePlay"
        ></video>

        <!-- 字幕叠加层 -->
        <div v-if="currentSubtitle" class="subtitle-overlay">
          <span>{{ currentSubtitle }}</span>
        </div>
      </div>

      <!-- 控制栏 -->
      <div class="controls">
        <div class="progress-bar" @click="seekByClick" ref="progressRef">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>

        <div class="controls-row">
          <div class="controls-left">
            <button class="btn btn-icon" @click="stepBack" title="后退5秒">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
            </button>
            <button class="btn btn-icon play-btn" @click="togglePlay">
              <svg v-if="!playing" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button class="btn btn-icon" @click="stepForward" title="前进5秒">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.51"/></svg>
            </button>
          </div>

          <div class="time-display">
            {{ formatTime(current) }} / {{ formatTime(duration) }}
          </div>

          <div class="controls-right">
            <select class="speed-select" v-model="playbackRate" @change="changeSpeed">
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
            <button class="btn btn-icon" @click="toggleMute">
              <svg v-if="!muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import * as fileAdapter from '../adapters/fileAdapter.js'

const props = defineProps({
  videoSrc: String,
  videoInfo: Object,
  currentTime: Number,
  subtitles: Array,
})

const emit = defineEmits(['timeupdate', 'drop-video'])

const videoRef = ref(null)
const progressRef = ref(null)
const playing = ref(false)
const muted = ref(false)
const current = ref(0)
const duration = ref(0)
const playbackRate = ref('1')
const dragOver = ref(false)
const recentFiles = ref([])

onMounted(async () => {
  recentFiles.value = await fileAdapter.getRecentFiles()
})

function openRecentFile(file) {
  emit('drop-video', { path: file.path, name: file.name, size: file.size || 0 })
}

async function clearRecent() {
  fileAdapter.clearRecentFiles()
  recentFiles.value = []
}

const progressPercent = computed(() =>
  duration.value ? (current.value / duration.value) * 100 : 0
)

const currentSubtitle = computed(() => {
  if (!props.subtitles?.length) return ''
  const sub = props.subtitles.find(
    (s) => props.currentTime >= s.start && props.currentTime <= s.end
  )
  return sub?.text || ''
})

function onDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  // 兼容双环境：Electron 有 file.path，浏览器没有
  if (/\.(mp4|avi|mov|mkv|flv|wmv|webm)$/i.test(file.name)) {
    emit('drop-video', {
      path: file.path || '',
      name: file.name,
      size: file.size,
      _file: file.path ? null : file, // 浏览器模式保留 File 引用
    })
  }
}

function onTimeUpdate() {
  current.value = videoRef.value?.currentTime || 0
  emit('timeupdate', current.value)
}

function onLoaded() {
  duration.value = videoRef.value?.duration || 0
}

function togglePlay() {
  if (!videoRef.value) return
  if (playing.value) {
    videoRef.value.pause()
    playing.value = false
  } else {
    videoRef.value.play()
    playing.value = true
  }
}

function stepBack() {
  if (videoRef.value) videoRef.value.currentTime -= 5
}

function stepForward() {
  if (videoRef.value) videoRef.value.currentTime += 5
}

function toggleMute() {
  if (videoRef.value) {
    muted.value = !muted.value
    videoRef.value.muted = muted.value
  }
}

function changeSpeed() {
  if (videoRef.value) videoRef.value.playbackRate = parseFloat(playbackRate.value)
}

function seekByClick(e) {
  if (!progressRef.value || !videoRef.value) return
  const rect = progressRef.value.getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  videoRef.value.currentTime = ratio * duration.value
}

function clearVideo() {
  emit('drop-video', null)
  if (videoRef.value) {
    videoRef.value.src = ''
    playing.value = false
  }
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 外部跳转
watch(
  () => props.currentTime,
  (val) => {
    if (videoRef.value && Math.abs(videoRef.value.currentTime - val) > 0.5) {
      videoRef.value.currentTime = val
    }
  }
)
</script>

<style scoped>
.video-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

/* 空状态 */
.drop-zone {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.drop-zone.drag-over,
.drop-zone:hover {
  background: var(--accent-light);
}

.drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.drop-icon {
  margin-bottom: 8px;
  opacity: 0.8;
}

.drop-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.drop-sub {
  font-size: 12px;
  color: var(--text-muted);
}

/* 播放器 */
.player-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.video-container {
  flex: 1;
  position: relative;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: pointer;
}

.subtitle-overlay {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 500;
  max-width: 80%;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

/* 控制栏 */
.controls {
  background: var(--bg-secondary);
  padding: 8px 12px;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.progress-bar {
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: height 0.1s;
}

.progress-bar:hover {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.controls-left {
  display: flex;
  align-items: center;
  gap: 2px;
}

.controls-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-display {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.play-btn {
  color: var(--accent) !important;
}

.speed-select {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 6px;
  border-radius: var(--radius);
  cursor: pointer;
}

/* 最近文件 */
.recent-files {
  margin-top: 20px;
  width: 320px;
  text-align: left;
}

.recent-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recent-list {
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  overflow: hidden;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.12s;
  color: var(--text-secondary);
  font-size: 12px;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.recent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-clear {
  margin-top: 6px;
  padding: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  text-decoration: underline;
}

.recent-clear:hover {
  color: var(--danger);
}
</style>
