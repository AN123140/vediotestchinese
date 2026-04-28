<template>
  <div class="app">
    <!-- 标题栏 -->
    <TitleBar />

    <!-- 主内容区 -->
    <div class="app-body">
      <!-- 左侧：视频预览区 -->
      <div class="panel panel-left">
        <VideoPlayer
          :videoSrc="videoSrc"
          :videoInfo="videoInfo"
          :currentTime="currentTime"
          :subtitles="subtitles"
          @timeupdate="handleTimeUpdate"
          @drop-video="handleDropVideo"
        />
      </div>

      <!-- 右侧：字幕编辑区 -->
      <div class="panel panel-right">
        <SubtitleEditor
          :subtitles="subtitles"
          :currentTime="currentTime"
          :activeIndex="activeSubtitleIndex"
          @update="handleSubtitleUpdate"
          @delete="handleSubtitleDelete"
          @add="handleSubtitleAdd"
          @seek="handleSeek"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <BottomBar
      :hasVideo="!!videoSrc"
      :isProcessing="isProcessing"
      :progress="progress"
      :progressText="progressText"
      :hasSubtitles="subtitles.length > 0"
      @import="handleImportVideo"
      @recognize="handleRecognize"
      @export-srt="handleExportSrt"
    />

    <!-- 通知 -->
    <Notification :messages="notifications" @dismiss="dismissNotification" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import SubtitleEditor from './components/SubtitleEditor.vue'
import BottomBar from './components/BottomBar.vue'
import Notification from './components/Notification.vue'

// 状态
const videoSrc = ref('')
const videoInfo = ref(null)
const currentTime = ref(0)
const subtitles = ref([])
const isProcessing = ref(false)
const progress = ref(0)
const progressText = ref('')
const notifications = ref([])

// 当前激活字幕索引
const activeSubtitleIndex = computed(() => {
  if (!subtitles.value.length || currentTime.value === 0) return -1
  return subtitles.value.findIndex(
    (s) => currentTime.value >= s.start && currentTime.value <= s.end
  )
})

// 时间更新
function handleTimeUpdate(time) {
  currentTime.value = time
}

// 跳转时间
function handleSeek(time) {
  currentTime.value = time
  // 通过 VideoPlayer ref 控制
}

// 导入视频（按钮）
async function handleImportVideo() {
  if (window.electronAPI) {
    const file = await window.electronAPI.openVideoDialog()
    if (file) loadVideo(file)
  }
}

// 拖拽导入 / 点击空状态区域时 file 为 null 则打开对话框
async function handleDropVideo(file) {
  if (!file) {
    await handleImportVideo()
  } else {
    loadVideo(file)
  }
}

function loadVideo(file) {
  videoSrc.value = 'file:///' + file.path.replace(/\\/g, '/')
  videoInfo.value = {
    name: file.name,
    size: formatSize(file.size),
    path: file.path,
  }
  subtitles.value = []
  notify('success', `已加载：${file.name}`)
}

// 模拟 Whisper 语音识别
async function handleRecognize() {
  if (!videoSrc.value) return
  isProcessing.value = true
  progress.value = 0
  progressText.value = '正在提取音频...'

  // 模拟处理进度（真实环境替换为 Python IPC 调用）
  const mockSubtitles = generateMockSubtitles()
  const steps = [
    { p: 10, text: '正在提取音频...' },
    { p: 25, text: '加载 Whisper 模型...' },
    { p: 45, text: '语音识别中 (1/3)...' },
    { p: 65, text: '语音识别中 (2/3)...' },
    { p: 80, text: '语音识别中 (3/3)...' },
    { p: 92, text: '生成字幕数据...' },
    { p: 100, text: '完成！' },
  ]

  for (const step of steps) {
    await sleep(600)
    progress.value = step.p
    progressText.value = step.text
  }

  await sleep(300)
  subtitles.value = mockSubtitles
  isProcessing.value = false
  progress.value = 0
  progressText.value = ''
  notify('success', `识别完成，共生成 ${mockSubtitles.length} 条字幕`)
}

// 导出 SRT
async function handleExportSrt() {
  if (!subtitles.value.length) return
  const content = generateSrt(subtitles.value)

  if (window.electronAPI) {
    const savedPath = await window.electronAPI.saveSrtDialog(content)
    if (savedPath) notify('success', `字幕已导出至：${savedPath}`)
  } else {
    // 浏览器环境降级处理
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subtitles.srt'
    a.click()
    URL.revokeObjectURL(url)
    notify('success', '字幕文件已下载')
  }
}

// 字幕操作
function handleSubtitleUpdate(index, data) {
  subtitles.value[index] = { ...subtitles.value[index], ...data }
}

function handleSubtitleDelete(index) {
  subtitles.value.splice(index, 1)
}

function handleSubtitleAdd(afterIndex) {
  const prev = subtitles.value[afterIndex]
  const newSub = {
    id: Date.now(),
    start: prev ? prev.end + 0.1 : 0,
    end: prev ? prev.end + 2 : 2,
    text: '新字幕',
  }
  subtitles.value.splice(afterIndex + 1, 0, newSub)
}

// 工具函数
function generateMockSubtitles() {
  const lines = [
    '大家好，欢迎来到本期视频',
    '今天我们来介绍一下这款字幕生成软件',
    '它基于 OpenAI Whisper 模型进行语音识别',
    '支持中文、英文等多种语言',
    '识别完成后，你可以在右侧编辑字幕内容',
    '调整字幕的开始和结束时间',
    '还可以添加或删除字幕条目',
    '最后点击导出，保存为 SRT 格式文件',
    '整个过程完全在本地运行，保护你的隐私',
    '感谢大家的收看，下期再见！',
  ]
  let t = 1.0
  return lines.map((text, i) => {
    const dur = 2.5 + Math.random() * 2
    const sub = { id: i + 1, start: Math.round(t * 100) / 100, end: Math.round((t + dur) * 100) / 100, text }
    t += dur + 0.3
    return sub
  })
}

function generateSrt(subs) {
  return subs
    .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`)
    .join('\n')
}

function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function notify(type, message) {
  const id = Date.now()
  notifications.value.push({ id, type, message })
  setTimeout(() => dismissNotification(id), 4000)
}

function dismissNotification(id) {
  const idx = notifications.value.findIndex((n) => n.id === id)
  if (idx !== -1) notifications.value.splice(idx, 1)
}
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-body {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-left {
  flex: 1.1;
  border-right: 1px solid var(--border-light);
  min-width: 420px;
}

.panel-right {
  flex: 1;
  min-width: 360px;
}
</style>
