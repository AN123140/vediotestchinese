import { reactive, watch, toRefs } from 'vue'

// 从 localStorage 恢复设置
function loadSettings() {
  try {
    const saved = localStorage.getItem('subtitle-app-settings')
    if (saved) return JSON.parse(saved)
  } catch (e) { /* ignore */ }
  return null
}

const saved = loadSettings()

// 全局响应式状态
const store = reactive({
  // 导航
  activeTab: 'single', // single | batch | translate | ai | settings
  aiSubFeature: null,  // 快捷键触发的子功能 id

  // 视频
  videoSrc: '',
  videoObjectUrl: '',
  videoInfo: null,
  currentTime: 0,

  // 字幕
  subtitles: [],

  // 识别
  isProcessing: false,
  progress: 0,
  progressText: '',

  // 翻译语言
  recognizeLanguage: saved?.recognizeLanguage || 'zh',

  // 通知
  notifications: [],

  // 主题
  theme: saved?.theme || 'dark', // dark | light

  // 字幕压制设置
  burnSettings: {
    codec: 'h264',      // h264 | h265
    resolution: 'original', // original | 720p | 1080p | 4k
    quality: 'high',     // high | medium | low
    format: 'mp4',       // mp4 | mkv | mov
    subtitleStyle: {
      fontFamily: 'Microsoft YaHei',
      fontSize: 5,        // 视频高度百分比 3-10
      position: 'bottom', // top | middle | bottom
      offsetY: 0,         // 像素微调
      fontColor: '#ffffff',
      strokeColor: '#000000',
      bgColor: '#000000',
      strokeWidth: 1,     // 0-5px
      bgOpacity: 0,       // 0-100%
    },
    outputPath: '',
    outputFilename: '',
  },

  // 批量处理
  batchTasks: [],
  batchState: 'idle', // idle | processing | paused
  batchLanguage: saved?.batchLanguage || 'zh',
  batchModel: saved?.batchModel || 'large-v3',

  // 翻译
  translationEngine: 'local',  // local | baidu | youdao | deepl
  translationTargetLang: 'en',
  translationMode: 'dual',     // single | dual

  // 识别优化
  recognitionOptimize: {
    hotwords: [],
    enableDiarization: false,
    speakers: [],
    enableDenoise: true,
    enableNormalize: true,
    enableSkipSilence: false,
    enableAutoPunct: true,
    enableNumberFormat: true,
    enableFilterFiller: false,
  },

  // 导出设置
  exportSettings: {
    encoding: 'utf-8',     // utf-8 | utf-8-bom | gbk
    lineEnding: 'crlf',    // crlf | lf
    timePrecision: 'ms',   // ms | frame
    includeMetadata: false,
  },

  // 翻译 API 设置
  apiSettings: {
    baiduAppId: '',
    baiduSecretKey: '',
    youdaoAppKey: '',
    youdaoSecretKey: '',
    deeplApiKey: '',
  },

  // 术语库
  glossary: saved?.glossary || [],
})

// 持久化设置到 localStorage
watch(
  () => ({
    theme: store.theme,
    recognizeLanguage: store.recognizeLanguage,
    batchLanguage: store.batchLanguage,
    batchModel: store.batchModel,
    glossary: store.glossary,
    exportSettings: store.exportSettings,
    burnSettings: store.burnSettings,
    apiSettings: store.apiSettings,
    recognitionOptimize: store.recognitionOptimize,
  }),
  (val) => {
    localStorage.setItem('subtitle-app-settings', JSON.stringify(val))
  },
  { deep: true }
)

// 主题自动应用到 document
watch(() => store.theme, (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
}, { immediate: true })

// 通知系统
let notifyId = 0
function notify(type, message, duration = 4000) {
  const id = ++notifyId
  store.notifications.push({ id, type, message })
  if (duration > 0) {
    setTimeout(() => {
      const idx = store.notifications.findIndex(n => n.id === id)
      if (idx !== -1) store.notifications.splice(idx, 1)
    }, duration)
  }
}

function dismissNotification(id) {
  const idx = store.notifications.findIndex(n => n.id === id)
  if (idx !== -1) store.notifications.splice(idx, 1)
}

export function useAppStore() {
  return {
    ...toRefs(store),
    store,
    notify,
    dismissNotification,
  }
}

export default store
