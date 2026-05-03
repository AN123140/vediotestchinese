<template>
  <div class="app">
    <!-- 标题栏 -->
    <TitleBar />

    <!-- Tab 导航栏 -->
    <TabBar v-model:activeTab="store.activeTab" />

    <!-- 主内容区 -->
    <div class="app-content">
      <!-- 单视频处理 -->
      <template v-if="store.activeTab === 'single'">
        <div class="app-body">
          <div class="panel panel-left">
            <VideoPlayer
              :videoSrc="store.videoSrc"
              :videoInfo="store.videoInfo"
              :currentTime="store.currentTime"
              :subtitles="store.subtitles"
              @timeupdate="handleTimeUpdate"
              @drop-video="handleDropVideo"
            />
          </div>
          <div class="panel panel-right">
            <SubtitleEditor
              :subtitles="store.subtitles"
              :currentTime="store.currentTime"
              :activeIndex="activeSubtitleIndex"
              @update="handleSubtitleUpdate"
              @delete="handleSubtitleDelete"
              @add="handleSubtitleAdd"
              @seek="handleSeek"
            />
          </div>
        </div>
        <BottomBar
          :hasVideo="!!store.videoSrc"
          :isProcessing="store.isProcessing"
          :progress="store.progress"
          :progressText="store.progressText"
          :hasSubtitles="store.subtitles.length > 0"
          v-model:language="store.recognizeLanguage"
          @import="handleImportVideo"
          @recognize="handleRecognize"
          @export-srt="handleExportSrt"
        />
      </template>

      <!-- 批量处理 -->
      <template v-if="store.activeTab === 'batch'">
        <BatchProcess />
      </template>

      <!-- 字幕翻译 -->
      <template v-if="store.activeTab === 'translate'">
        <SubtitleTranslate />
      </template>

      <!-- AI 智能 -->
      <template v-if="store.activeTab === 'ai'">
        <AIPanel />
      </template>

      <!-- 设置 -->
      <template v-if="store.activeTab === 'settings'">
        <SettingsPanel />
      </template>
    </div>

    <!-- 通知 -->
    <Notification :messages="store.notifications" @dismiss="dismissNotification" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import store, { useAppStore } from './composables/useAppStore.js'
import TitleBar from './components/TitleBar.vue'
import TabBar from './components/TabBar.vue'
import VideoPlayer from './components/VideoPlayer.vue'
import SubtitleEditor from './components/SubtitleEditor.vue'
import BottomBar from './components/BottomBar.vue'
import Notification from './components/Notification.vue'
import BatchProcess from './components/BatchProcess.vue'
import SubtitleTranslate from './components/SubtitleTranslate.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import AIPanel from './components/AIPanel.vue'
import { formatSrtTime } from './utils/formatTime.js'

const { notify, dismissNotification } = useAppStore()

// 当前激活字幕索引
const activeSubtitleIndex = computed(() => {
  if (!store.subtitles.length || store.currentTime === 0) return -1
  return store.subtitles.findIndex(
    s => store.currentTime >= s.start && store.currentTime <= s.end
  )
})

// 时间更新
function handleTimeUpdate(time) {
  store.currentTime = time
}

// 跳转时间
function handleSeek(time) {
  store.currentTime = time
}

// 导入视频
async function handleImportVideo() {
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
  const file = await window.electronAPI.openVideoDialog()
  if (file) loadElectronVideo(file)
}

// 拖拽导入
async function handleDropVideo(file) {
  if (!file) {
    await handleImportVideo()
  } else {
    loadVideo(file)
  }
}

function loadElectronVideo(file) {
  store.videoSrc = 'file:///' + file.path.replace(/\\/g, '/')
  store.videoInfo = { name: file.name, size: formatSize(file.size), path: file.path }
  store.subtitles = []
  notify('success', `已加载：${file.name}`)
}

function loadVideoFromBrowserFile(file) {
  if (store.videoObjectUrl) URL.revokeObjectURL(store.videoObjectUrl)
  store.videoObjectUrl = URL.createObjectURL(file)
  store.videoSrc = store.videoObjectUrl
  store.videoInfo = { name: file.name, size: formatSize(file.size) }
  store.subtitles = []
  store.currentTime = 0
  notify('success', `已加载：${file.name}`)
}

const BACKEND_URL = 'http://127.0.0.1:8765'

// 后端服务健康检查（最多等待15秒，覆盖模型加载期）
async function checkBackendHealth() {
  const MAX_RETRIES = 5
  const RETRY_DELAY = 3000
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(2500) })
      if (resp.ok) return true
    } catch { /* 连接失败，继续重试 */ }
    if (i < MAX_RETRIES - 1) {
      store.progressText = `等待识别服务启动中...（${i + 1}/${MAX_RETRIES}）`
      await new Promise(r => setTimeout(r, RETRY_DELAY))
    }
  }
  return false
}

// 将网络错误分类为用户友好的提示
function classifyError(e) {
  if (e.name === 'AbortError') return '请求超时（处理时间超过10分钟）'
  const msg = String(e.message || '')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION_REFUSED'))
    return '识别服务连接中断，请检查后端服务是否正常运行'
  if (msg.includes('服务器错误')) return msg
  if (msg.includes('识别失败')) return msg
  return `识别失败: ${msg}`
}

// 语音识别
async function handleRecognize() {
  if (!store.videoSrc) return
  store.isProcessing = true
  store.progress = 0
  store.progressText = '检查识别服务状态...'

  try {
    const healthy = await checkBackendHealth()
    if (!healthy) {
      notify('error', '识别服务不可用。请确认已运行：python backend/server.py（首次启动需加载模型，约1分钟）')
      return
    }

    store.progress = 10
    store.progressText = '正在上传视频文件...'

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)

    try {
      if (window.electronAPI && store.videoInfo?.path) {
        store.progressText = '正在处理视频文件...'
        const result = await callRecognizeByPath(store.videoInfo.path, controller.signal)
        clearTimeout(timeoutId)
        onRecognizeResult(result)
        return
      }

      store.progressText = '正在读取视频文件...'
      const videoBlob = await fetch(store.videoSrc).then(r => r.blob())
      const formData = new FormData()
      formData.append('file', videoBlob, store.videoInfo?.name || 'video.mp4')
      formData.append('model_size', 'large-v3')
      formData.append('language', store.recognizeLanguage)

      store.progress = 20
      store.progressText = '正在上传到识别服务器...'

      const resp = await fetch(`${BACKEND_URL}/api/recognize`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      store.progress = 80
      store.progressText = '正在解析识别结果...'

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `服务器错误: ${resp.status}`)
      }
      const result = await resp.json()
      onRecognizeResult(result)
    } catch (e) {
      notify('error', classifyError(e))
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (e) {
    notify('error', classifyError(e))
  } finally {
    store.isProcessing = false
    store.progress = 0
    store.progressText = ''
  }
}

async function callRecognizeByPath(filePath, signal) {
  store.progress = 20
  store.progressText = '正在调用识别服务...'
  const resp = await fetch(`${BACKEND_URL}/api/recognize/path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, model_size: 'large-v3', language: store.recognizeLanguage }),
    signal,
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.detail || `服务器错误: ${resp.status}`)
  }
  return await resp.json()
}

function onRecognizeResult(result) {
  if (!result.success) throw new Error('识别失败')
  store.subtitles = (result.subtitles || []).map((s, i) => ({
    id: s.id || i + 1, start: s.start, end: s.end, text: s.text,
  }))
  store.progress = 100
  store.progressText = '完成！'
  notify('success', `识别完成，共生成 ${store.subtitles.length} 条字幕`)
}

// 导出 SRT
async function handleExportSrt() {
  if (!store.subtitles.length) return
  const content = store.subtitles
    .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`)
    .join('\n')

  if (window.electronAPI) {
    const savedPath = await window.electronAPI.saveSrtDialog(content)
    if (savedPath) notify('success', `字幕已导出至：${savedPath}`)
  } else {
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
  store.subtitles[index] = { ...store.subtitles[index], ...data }
}

function handleSubtitleDelete(index) {
  store.subtitles.splice(index, 1)
}

function handleSubtitleAdd(afterIndex) {
  const prev = store.subtitles[afterIndex]
  const newSub = { id: Date.now(), start: prev ? prev.end + 0.1 : 0, end: prev ? prev.end + 2 : 2, text: '' }
  store.subtitles.splice(afterIndex + 1, 0, newSub)
}

// 快捷键
function onKeyDown(e) {
  if (e.ctrlKey && e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case 'b': e.preventDefault(); store.activeTab = 'batch'; break
      case 't': e.preventDefault(); store.activeTab = 'translate'; break
      case 'a': e.preventDefault(); store.activeTab = 'ai'; break
      case 'i': e.preventDefault(); store.activeTab = 'ai'; store.aiSubFeature = 'one-click'; break
      case 'p': e.preventDefault(); store.activeTab = 'ai'; store.aiSubFeature = 'punctuation'; break
      case 's': e.preventDefault(); store.activeTab = 'ai'; store.aiSubFeature = 'segment'; break
      case 'c': e.preventDefault(); store.activeTab = 'ai'; store.aiSubFeature = 'correction'; break
    }
  }
}

// 浏览器拖拽事件
function onBrowserFileDrop(e) {
  loadVideoFromBrowserFile(e.detail)
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('browser-file-drop', onBrowserFileDrop)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('browser-file-drop', onBrowserFileDrop)
})

// 工具函数
function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
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
