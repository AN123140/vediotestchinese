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
      v-model:language="recognizeLanguage"
      @import="handleImportVideo"
      @recognize="handleRecognize"
      @export-srt="handleExportSrt"
    />

    <!-- 通知 -->
    <Notification :messages="notifications" @dismiss="dismissNotification" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import TitleBar from './components/TitleBar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import SubtitleEditor from './components/SubtitleEditor.vue'
import BottomBar from './components/BottomBar.vue'
import Notification from './components/Notification.vue'

// 状态
const videoSrc = ref('')
const videoObjectUrl = ref('')   // blob URL，用于浏览器环境播放
const videoInfo = ref(null)
const currentTime = ref(0)
const subtitles = ref([])
const isProcessing = ref(false)
const progress = ref(0)
const progressText = ref('')
const notifications = ref([])
const recognizeLanguage = ref('zh')  // 识别语言，默认中文

// 浏览器环境拖拽事件监听
function onBrowserFileDrop(e) {
  loadVideoFromBrowserFile(e.detail)
}

onMounted(() => {
  window.addEventListener('browser-file-drop', onBrowserFileDrop)
})

onUnmounted(() => {
  window.removeEventListener('browser-file-drop', onBrowserFileDrop)
})

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
  // 浏览器环境：用 <input type="file"> 选择文件
  if (!window.electronAPI) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mp4,.avi,.mov,.mkv,.flv,.wmv,.webm,video/*'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (file) loadVideoFromBrowserFile(file)
    }
    input.click()
    return
  }

  // Electron 环境：用原生对话框
  const file = await window.electronAPI.openVideoDialog()
  if (file) loadElectronVideo(file)
}

// 拖拽导入 / 点击空状态区域时 file 为 null 则打开对话框
async function handleDropVideo(file) {
  if (!file) {
    await handleImportVideo()
  } else {
    loadVideo(file)
  }
}

// Electron 环境加载视频
function loadElectronVideo(file) {
  videoSrc.value = 'file:///' + file.path.replace(/\\/g, '/')
  videoInfo.value = {
    name: file.name,
    size: formatSize(file.size),
    path: file.path,
  }
  subtitles.value = []
  notify('success', `已加载：${file.name}`)
}

// 浏览器环境加载视频（从 File 对象生成 blob URL）
function loadVideoFromBrowserFile(file) {
  // 回收旧 URL
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value)
  videoObjectUrl.value = URL.createObjectURL(file)
  videoSrc.value = videoObjectUrl.value
  videoInfo.value = {
    name: file.name,
    size: formatSize(file.size),
  }
  subtitles.value = []
  currentTime.value = 0
  notify('success', `已加载：${file.name}`)
}

// 真实 Whisper 语音识别（调用 Python 后端 API）
async function handleRecognize() {
  if (!videoSrc.value) return
  isProcessing.value = true
  progress.value = 0
  progressText.value = '准备上传视频...'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)  // 10 分钟超时

  try {
    progress.value = 10
    progressText.value = '正在上传视频文件...'
    const formData = new FormData()

    // Electron 环境：用文件路径接口（无需上传文件）
    if (window.electronAPI && videoInfo.value?.path) {
      progressText.value = '正在处理视频文件...'
      const result = await callRecognizeByPath(videoInfo.value.path, controller.signal)
      clearTimeout(timeoutId)
      onRecognizeResult(result)
      return
    }

    // 浏览器环境：上传视频 blob 到后端
    progressText.value = '正在读取视频文件...'
    const videoBlob = await fetch(videoSrc.value).then(r => r.blob())
    formData.append('file', videoBlob, videoInfo.value?.name || 'video.mp4')
    formData.append('model_size', 'large-v3')
    formData.append('language', recognizeLanguage.value)

    progress.value = 20
    progressText.value = '正在上传到识别服务器...'

    const resp = await fetch('http://127.0.0.1:8765/api/recognize', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    progress.value = 80
    progressText.value = '正在解析识别结果...'

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(err.detail || `服务器错误: ${resp.status}`)
    }

    const result = await resp.json()
    onRecognizeResult(result)

  } catch (e) {
    clearTimeout(timeoutId)
    const msg = e.name === 'AbortError' ? '请求超时（处理时间超过10分钟）' : `识别失败: ${e.message}`
    notify('error', msg)
    console.error('Recognize error:', e)
  } finally {
    isProcessing.value = false
    progress.value = 0
    progressText.value = ''
  }
}

// Electron 环境：通过文件路径调用识别接口
async function callRecognizeByPath(filePath, signal) {
  progress.value = 20
  progressText.value = '正在调用识别服务...'

  const resp = await fetch('http://127.0.0.1:8765/api/recognize/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: filePath,
      model_size: 'large-v3',
      language: recognizeLanguage.value,
    }),
    signal,
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.detail || `服务器错误: ${resp.status}`)
  }

  return await resp.json()
}

// 处理识别结果
function onRecognizeResult(result) {
  if (!result.success) {
    throw new Error('识别失败')
  }

  // 转换后端格式到前端格式
  subtitles.value = (result.subtitles || []).map((s, i) => ({
    id: s.id || i + 1,
    start: s.start,
    end: s.end,
    text: s.text,
  }))

  progress.value = 100
  progressText.value = '完成！'
  notify('success', `识别完成，共生成 ${subtitles.value.length} 条字幕（语言：${result.language || '自动检测'}）`)
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
