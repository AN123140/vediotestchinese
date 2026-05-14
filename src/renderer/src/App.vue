<template>
  <div class="app">
    <!-- 标题栏 -->
    <TitleBar :mode="isElectron() ? 'electron' : 'browser'" />

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
import { isElectron } from './utils/environment.js'
import * as fileAdapter from './adapters/fileAdapter.js'
import * as recognizeAdapter from './adapters/recognizeAdapter.js'

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

// 导入视频（适配双环境）
async function handleImportVideo() {
  const file = await fileAdapter.openVideo()
  if (file) loadVideo(file)
}

// 拖拽导入
async function handleDropVideo(file) {
  if (!file) {
    await handleImportVideo()
  } else {
    loadVideo(file)
  }
}

/**
 * 统一视频加载函数（支持 Electron 文件路径和浏览器 File 对象）
 */
function loadVideo(fileOrPath) {
  let videoUrl, videoInfo

  if (isElectron()) {
    // Electron: fileOrPath 是 { path, name, size }
    videoUrl = fileAdapter.getVideoUrl(fileOrPath)
    videoInfo = { name: fileOrPath.name, size: formatSize(fileOrPath.size), path: fileOrPath.path }
  } else {
    // Browser: fileOrPath 是 File 对象
    videoUrl = fileAdapter.getVideoUrl(fileOrPath)
    videoInfo = { name: fileOrPath.name, size: formatSize(fileOrPath.size), path: '', _file: fileOrPath }
  }

  store.videoSrc = videoUrl
  store.videoInfo = videoInfo
  store.subtitles = []
  fileAdapter.addRecentFile(videoInfo)
  notify('success', `已加载：${videoInfo.name}`)
}

const BACKEND_URL = 'http://127.0.0.1:8081'

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
    store.progressText = '正在处理视频文件...'
    if (isElectron()) window.electronAPI.traySetProcessing(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000)

    try {
      store.progressText = '正在处理视频文件...'
      const result = await recognizeAdapter.recognize(store.videoInfo, {
        language: store.recognizeLanguage,
        signal: controller.signal,
        onProgress: (p, t) => { store.progress = p; store.progressText = t },
      })
      clearTimeout(timeoutId)
      onRecognizeResult(result)
    } catch (e) {
      clearTimeout(timeoutId)
      notify('error', classifyError(e))
    }
  } catch (e) {
    notify('error', classifyError(e))
  } finally {
    store.isProcessing = false
    store.progress = 0
    store.progressText = ''
    if (isElectron()) window.electronAPI.traySetProcessing(false)
  }
}

async function onRecognizeResult(result) {
  if (!result.success) throw new Error('识别失败')
  store.subtitles = (result.subtitles || []).map((s, i) => ({
    id: s.id || i + 1, start: s.start, end: s.end, text: s.text,
  }))
  store.progress = 100
  store.progressText = '完成！'
  notify('success', `识别完成，共生成 ${store.subtitles.length} 条字幕`)
  if (isElectron()) {
    window.electronAPI.showNotification('识别完成', `已生成 ${store.subtitles.length} 条字幕`)
  }
}

// 导出 SRT（适配双环境）
async function handleExportSrt() {
  if (!store.subtitles.length) return
  const content = store.subtitles
    .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`)
    .join('\n')

  const savedPath = await fileAdapter.saveSrt(content)
  if (savedPath) {
    notify('success', `字幕已导出至：${savedPath}`)
    if (isElectron()) {
      window.electronAPI.showNotification('导出完成', `字幕已保存到 ${savedPath.split(/[\\/]/).pop()}`)
    }
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

// 全局快捷键（应用内）
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

// 监听主进程全局快捷键触发（仅 Electron）
function setupGlobalShortcutListeners() {
  if (!isElectron()) return
  window.electronAPI.onGlobalShortcut((action) => {
    switch (action) {
      case 'open-video': handleImportVideo(); break
      case 'export-srt': handleExportSrt(); break
      case 'start-recognize': handleRecognize(); break
    }
  })
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  setupGlobalShortcutListeners()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
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
