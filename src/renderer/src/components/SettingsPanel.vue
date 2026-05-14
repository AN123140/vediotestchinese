<template>
  <div class="settings-panel">
    <div class="settings-layout">
      <!-- 左侧导航 -->
      <div class="settings-nav">
        <button v-for="cat in categories" :key="cat.id"
                class="nav-item"
                :class="{ active: activeCat === cat.id }"
                @click="activeCat = cat.id">
          <component :is="cat.icon" class="nav-icon" />
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <!-- 右侧内容 -->
      <div class="settings-content">
        <!-- 通用设置 -->
        <template v-if="activeCat === 'general'">
          <h3 class="section-title">通用设置</h3>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">界面主题</span>
              <span class="setting-desc">切换深色/浅色界面主题</span>
            </div>
            <div class="setting-control">
              <select v-model="store.theme" class="setting-select">
                <option value="dark">深色模式</option>
                <option value="light">浅色模式</option>
              </select>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">界面缩放</span>
              <span class="setting-desc">调整整体界面大小</span>
            </div>
            <div class="setting-control">
              <select v-model="uiScale" class="setting-select">
                <option value="100">100%</option>
                <option value="125">125%</option>
                <option value="150">150%</option>
              </select>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">默认识别语言</span>
              <span class="setting-desc">语音识别的默认语言</span>
            </div>
            <div class="setting-control">
              <select v-model="store.recognizeLanguage" class="setting-select">
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="ko">한국어</option>
                <option value="">自动检测</option>
              </select>
            </div>
          </div>
        </template>

        <!-- 系统设置（桌面专属） -->
        <template v-if="activeCat === 'system'">
          <h3 class="section-title">系统设置</h3>

          <div class="setting-group">
            <span class="group-title">启动行为</span>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">开机自动启动</span>
                <span class="setting-desc">系统启动时自动运行本应用</span>
              </div>
              <button class="toggle" :class="{ active: sysSettings.autoLaunch }"
                      @click="sysSettings.autoLaunch = !sysSettings.autoLaunch"></button>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">最小化到系统托盘</span>
                <span class="setting-desc">点击最小化时隐藏到托盘而非任务栏</span>
              </div>
              <button class="toggle" :class="{ active: sysSettings.minimizeToTray }"
                      @click="sysSettings.minimizeToTray = !sysSettings.minimizeToTray"></button>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">关闭窗口时最小化到托盘</span>
                <span class="setting-desc">关闭按钮不退出程序，仅隐藏到托盘</span>
              </div>
              <button class="toggle" :class="{ active: sysSettings.closeToTray }"
                      @click="sysSettings.closeToTray = !sysSettings.closeToTray"></button>
            </div>
          </div>

          <div class="setting-group">
            <span class="group-title">通知设置</span>
            <div class="setting-row">
              <span class="setting-label">处理完成时通知</span>
              <button class="toggle" :class="{ active: sysSettings.notifyOnComplete }"
                      @click="sysSettings.notifyOnComplete = !sysSettings.notifyOnComplete"></button>
            </div>
            <div class="setting-row">
              <span class="setting-label">出错时通知</span>
              <button class="toggle" :class="{ active: sysSettings.notifyOnError }"
                      @click="sysSettings.notifyOnError = !sysSettings.notifyOnError"></button>
            </div>
          </div>

          <div class="setting-group">
            <div class="group-header">
              <span class="group-title">全局快捷键</span>
              <button class="btn btn-sm btn-secondary" @click="resetShortcuts">恢复默认</button>
            </div>
            <div v-for="sc in shortcutLabels" :key="sc.key" class="setting-row">
              <span class="setting-label">{{ sc.label }}</span>
              <input type="text" class="shortcut-input"
                     :value="sysSettings.shortcuts[sc.key]"
                     @input="sysSettings.shortcuts[sc.key] = $event.target.value"
                     :placeholder="`如 CommandOrControl+Shift+O`" />
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-top:8px">
            <button class="btn btn-primary" @click="saveSysSettings">保存设置</button>
          </div>
        </template>

        <!-- 识别设置 -->
        <template v-if="activeCat === 'recognition'">
          <h3 class="section-title">语音识别优化</h3>

          <!-- 热词设置 -->
          <div class="setting-group">
            <div class="group-header">
              <span class="group-title">热词设置</span>
              <div class="group-actions">
                <button class="btn btn-sm btn-secondary" @click="importHotwords">导入</button>
                <button class="btn btn-sm btn-secondary" @click="exportHotwords">导出</button>
                <button class="btn btn-sm btn-primary" @click="showAddHotword = true">添加热词</button>
              </div>
            </div>
            <div class="preset-row">
              <span class="setting-label">预设热词库</span>
              <div class="preset-tags">
                <button v-for="preset in hotwordPresets" :key="preset.id"
                        class="preset-tag" :class="{ active: activePreset === preset.id }"
                        @click="loadPreset(preset)">{{ preset.label }}</button>
              </div>
            </div>
            <div class="hotword-list">
              <div v-for="(word, i) in store.recognitionOptimize.hotwords" :key="i" class="hotword-item">
                <span class="hotword-text">{{ word.text }}</span>
                <div class="hotword-weight">
                  <input type="range" v-model.number="word.weight" min="1" max="10" step="1"
                         class="range-input" />
                  <span class="weight-value">{{ word.weight }}</span>
                </div>
                <button class="btn-icon" @click="store.recognitionOptimize.hotwords.splice(i, 1)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div v-if="store.recognitionOptimize.hotwords.length === 0" class="empty-hint">
                暂无热词，点击"添加热词"或加载预设热词库
              </div>
            </div>
          </div>

          <!-- 说话人识别 -->
          <div class="setting-group">
            <div class="group-header">
              <span class="group-title">说话人识别</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableDiarization }"
                      @click="store.recognitionOptimize.enableDiarization = !store.recognitionOptimize.enableDiarization"></button>
            </div>
            <div v-if="store.recognitionOptimize.enableDiarization" class="speaker-list">
              <div v-for="(sp, i) in store.recognitionOptimize.speakers" :key="i" class="speaker-item">
                <span class="speaker-color" :style="{ background: sp.color }"></span>
                <input type="text" v-model="sp.name" class="speaker-name" placeholder="说话人名称" />
                <button class="btn-icon" @click="store.recognitionOptimize.speakers.splice(i, 1)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <button class="btn btn-sm btn-secondary" @click="addSpeaker">添加说话人</button>
            </div>
          </div>

          <!-- 音频预处理 -->
          <div class="setting-group">
            <span class="group-title">音频预处理</span>
            <div class="setting-row">
              <span class="setting-label">启用降噪</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableDenoise }"
                      @click="store.recognitionOptimize.enableDenoise = !store.recognitionOptimize.enableDenoise"></button>
            </div>
            <div class="setting-row">
              <span class="setting-label">音量归一化</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableNormalize }"
                      @click="store.recognitionOptimize.enableNormalize = !store.recognitionOptimize.enableNormalize"></button>
            </div>
            <div class="setting-row">
              <span class="setting-label">跳过静音段</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableSkipSilence }"
                      @click="store.recognitionOptimize.enableSkipSilence = !store.recognitionOptimize.enableSkipSilence"></button>
            </div>
          </div>

          <!-- 后处理 -->
          <div class="setting-group">
            <span class="group-title">识别后处理</span>
            <div class="setting-row">
              <span class="setting-label">智能标点</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableAutoPunct }"
                      @click="store.recognitionOptimize.enableAutoPunct = !store.recognitionOptimize.enableAutoPunct"></button>
            </div>
            <div class="setting-row">
              <span class="setting-label">数字格式化</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableNumberFormat }"
                      @click="store.recognitionOptimize.enableNumberFormat = !store.recognitionOptimize.enableNumberFormat"></button>
            </div>
            <div class="setting-row">
              <span class="setting-label">过滤语气词</span>
              <button class="toggle" :class="{ active: store.recognitionOptimize.enableFilterFiller }"
                      @click="store.recognitionOptimize.enableFilterFiller = !store.recognitionOptimize.enableFilterFiller"></button>
            </div>
          </div>
        </template>

        <!-- 导出设置 -->
        <template v-if="activeCat === 'export'">
          <h3 class="section-title">导出设置</h3>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">默认导出格式</span>
              <span class="setting-desc">快速导出时使用的格式</span>
            </div>
            <div class="setting-control">
              <select v-model="store.exportSettings.defaultFormat" class="setting-select">
                <option v-for="f in formats" :key="f.id" :value="f.id">{{ f.name }} ({{ f.ext }})</option>
              </select>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">文件编码</span>
            </div>
            <div class="setting-control">
              <select v-model="store.exportSettings.encoding" class="setting-select">
                <option value="utf-8">UTF-8</option>
                <option value="utf-8-bom">UTF-8 BOM</option>
                <option value="gbk">GBK</option>
              </select>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">换行符</span>
            </div>
            <div class="setting-control">
              <select v-model="store.exportSettings.lineEnding" class="setting-select">
                <option value="crlf">Windows (CRLF)</option>
                <option value="lf">Unix (LF)</option>
              </select>
            </div>
          </div>

          <!-- 格式对照表 -->
          <h4 class="section-subtitle">格式特性对照</h4>
          <table class="data-table format-table">
            <thead>
              <tr>
                <th>格式</th><th>样式</th><th>时间轴</th><th>特效</th><th>推荐场景</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>SRT</td><td>基础</td><td>支持</td><td>不支持</td><td>通用播放</td></tr>
              <tr><td>ASS</td><td>丰富</td><td>支持</td><td>支持</td><td>特效字幕</td></tr>
              <tr><td>VTT</td><td>基础</td><td>支持</td><td>部分</td><td>网页播放</td></tr>
              <tr><td>TXT</td><td>无</td><td>不支持</td><td>不支持</td><td>纯文本稿</td></tr>
              <tr><td>JSON</td><td>-</td><td>支持</td><td>-</td><td>数据交换</td></tr>
              <tr><td>CSV</td><td>-</td><td>支持</td><td>-</td><td>表格编辑</td></tr>
            </tbody>
          </table>
        </template>

        <!-- 翻译设置 -->
        <template v-if="activeCat === 'translate'">
          <h3 class="section-title">翻译设置</h3>
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">默认目标语言</span>
            </div>
            <div class="setting-control">
              <select v-model="store.translationTargetLang" class="setting-select">
                <option value="en">英文</option>
                <option value="zh">中文</option>
                <option value="ja">日文</option>
                <option value="ko">韩文</option>
              </select>
            </div>
          </div>

          <div class="setting-group">
            <span class="group-title">API 密钥配置</span>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">百度翻译 App ID</span>
              </div>
              <div class="setting-control">
                <input type="text" v-model="store.apiSettings.baiduAppId" placeholder="输入百度翻译 App ID" style="width: 240px" />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">百度翻译密钥</span>
              </div>
              <div class="setting-control">
                <input type="password" v-model="store.apiSettings.baiduSecretKey" placeholder="输入密钥" style="width: 240px" />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">有道翻译 App Key</span>
              </div>
              <div class="setting-control">
                <input type="text" v-model="store.apiSettings.youdaoAppKey" placeholder="输入有道翻译 App Key" style="width: 240px" />
              </div>
            </div>
            <div class="setting-row">
              <div class="setting-info">
                <span class="setting-label">DeepL API Key</span>
              </div>
              <div class="setting-control">
                <input type="password" v-model="store.apiSettings.deeplApiKey" placeholder="输入 DeepL API Key" style="width: 240px" />
              </div>
            </div>
          </div>
        </template>

        <!-- 关于 -->
        <template v-if="activeCat === 'about'">
          <h3 class="section-title">关于</h3>
          <div class="about-card card">
            <div class="about-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="14" rx="2" fill="none" stroke="#4f8ef7" stroke-width="1.5"/>
                <path d="M8 21h8M12 16v5" stroke="#4f8ef7" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M9 9l2 2 4-4" stroke="#4caf84" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="about-info">
              <h4>视频字幕自动生成器</h4>
              <p class="about-version">版本 v3.1.0</p>
              <p class="about-desc">基于 AI 语音识别技术，帮助用户快速自动地为视频生成字幕。支持多种格式导出、批量处理、字幕翻译、AI 智能优化等功能。纯桌面原生版本，支持系统托盘、全局快捷键及系统通知。</p>
            </div>
          </div>
          <div class="about-links">
            <button class="btn btn-secondary" @click="checkUpdate">检查更新</button>
          </div>
        </template>
      </div>
    </div>

    <!-- 添加热词弹窗 -->
    <div v-if="showAddHotword" class="modal-overlay" @click.self="showAddHotword = false">
      <div class="modal" style="min-width: 360px">
        <div class="modal-header">
          <span class="modal-title">添加热词</span>
          <button class="modal-close" @click="showAddHotword = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-item">
            <label>热词文本</label>
            <input type="text" v-model="newHotword" placeholder="输入热词（如：公司名称、专业术语）" />
          </div>
          <div class="form-item">
            <label>权重 (1-10)</label>
            <input type="number" v-model.number="newHotwordWeight" min="1" max="10" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showAddHotword = false">取消</button>
          <button class="btn btn-primary" @click="confirmAddHotword">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h, onMounted } from 'vue'
import store from '../composables/useAppStore.js'
import { getExportFormats } from '../utils/exportFormats.js'
import { isElectron } from '../utils/environment.js'
import * as fileAdapter from '../adapters/fileAdapter.js'
import * as storageAdapter from '../adapters/storageAdapter.js'

const formats = getExportFormats()
const activeCat = ref('general')
const uiScale = ref('100')
const showAddHotword = ref(false)
const newHotword = ref('')
const newHotwordWeight = ref(5)
const activePreset = ref(null)

// 桌面专属设置
const sysSettings = ref({
  autoLaunch: false,
  minimizeToTray: true,
  closeToTray: true,
  notifyOnComplete: true,
  notifyOnError: true,
  shortcuts: {
    openVideo: 'CommandOrControl+Shift+O',
    exportSrt: 'CommandOrControl+Shift+S',
    startRecognize: 'CommandOrControl+Shift+R',
  },
})

const shortcutLabels = [
  { key: 'openVideo', label: '打开视频' },
  { key: 'exportSrt', label: '导出字幕' },
  { key: 'startRecognize', label: '开始识别' },
]

onMounted(async () => {
  if (isElectron()) {
    const s = await window.electronAPI.getSettings()
    if (s) sysSettings.value = { ...sysSettings.value, ...s }
  } else {
    // 浏览器环境从 localStorage 读取
    const s = await storageAdapter.get('sys-settings')
    if (s) sysSettings.value = { ...sysSettings.value, ...s }
  }
})

async function saveSysSettings() {
  if (isElectron()) {
    await window.electronAPI.saveSettings(sysSettings.value)
  } else {
    await storageAdapter.set('sys-settings', sysSettings.value)
  }
  store.notify('success', '系统设置已保存')
}

function resetShortcuts() {
  sysSettings.value.shortcuts = {
    openVideo: 'CommandOrControl+Shift+O',
    exportSrt: 'CommandOrControl+Shift+S',
    startRecognize: 'CommandOrControl+Shift+R',
  }
}

// 导航分类（根据环境动态过滤）
const allCategories = [
  { id: 'general', label: '通用设置', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('circle', { cx: '12', cy: '12', r: '3' }), h('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' })]) } } },
  { id: 'system', label: '系统设置', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2' }), h('line', { x1: '8', y1: '21', x2: '16', y2: '21' }), h('line', { x1: '12', y1: '17', x2: '12', y2: '21' })]) } } },
  { id: 'recognition', label: '识别优化', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { d: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z' }), h('path', { d: 'M19 10v2a7 7 0 01-14 0v-2' }), h('line', { x1: '12', y1: '19', x2: '12', y2: '23' }), h('line', { x1: '8', y1: '23', x2: '16', y2: '23' })]) } } },
  { id: 'export', label: '导出设置', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' }), h('polyline', { points: '7 10 12 15 17 10' }), h('line', { x1: '12', y1: '15', x2: '12', y2: '3' })]) } } },
  { id: 'translate', label: '翻译设置', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('path', { d: 'M5 8l6 6' }), h('path', { d: 'M4 14l6-6 2-3' }), h('path', { d: 'M2 5h12' }), h('path', { d: 'M22 22l-5-10-5 10' }), h('path', { d: 'M14 18h6' })]) } } },
  { id: 'about', label: '关于', icon: { render() { return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [h('circle', { cx: '12', cy: '12', r: '10' }), h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }), h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })]) } } },
]

const categories = computed(() => {
  if (!isElectron()) {
    // 网页端隐藏"系统设置"（托盘/快捷键/开机启动等桌面专属功能）
    return allCategories.filter(cat => cat.id !== 'system')
  }
  return allCategories
})

// 热词预设
const hotwordPresets = [
  { id: 'tech', label: '科技', words: ['人工智能', '深度学习', '机器学习', '神经网络', '自然语言处理', '计算机视觉', '大语言模型', '云计算', '区块链', '物联网'] },
  { id: 'medical', label: '医疗', words: ['高血压', '糖尿病', '抗生素', '临床', '手术', '诊断', '病理', '影像学', '基因', '免疫'] },
  { id: 'legal', label: '法律', words: ['合同', '违约', '赔偿', '诉讼', '仲裁', '知识产权', '专利', '商标', '侵权', '管辖'] },
  { id: 'education', label: '教育', words: ['课程', '教学', '学生', '考试', '成绩', '毕业', '学分', '论文', '导师', '学期'] },
]

// 应用缩放
watch(uiScale, (v) => {
  document.body.style.fontSize = (parseInt(v) / 100 * 16) + 'px'
})

function loadPreset(preset) {
  activePreset.value = preset.id
  store.recognitionOptimize.hotwords = preset.words.map(w => ({
    text: w, weight: 5,
  }))
  store.notify('info', `已加载"${preset.label}"热词库（${preset.words.length}条）`)
}

function confirmAddHotword() {
  if (!newHotword.value.trim()) return
  store.recognitionOptimize.hotwords.push({
    text: newHotword.value.trim(),
    weight: newHotwordWeight.value,
  })
  newHotword.value = ''
  showAddHotword.value = false
}

function addSpeaker() {
  const colors = ['#4f8ef7', '#4caf84', '#f0a742', '#e05c6d', '#9c6ade', '#e070c0']
  const idx = store.recognitionOptimize.speakers.length
  store.recognitionOptimize.speakers.push({
    name: `说话人${idx + 1}`,
    color: colors[idx % colors.length],
  })
}

async function importHotwords() {
  const result = await fileAdapter.openJsonDialog()
  if (!result) return
  try {
    const data = JSON.parse(result)
    if (Array.isArray(data)) {
      const words = data.map(w => typeof w === 'string' ? { text: w, weight: 5 } : w)
      store.recognitionOptimize.hotwords.push(...words)
      store.notify('success', `导入了 ${words.length} 条热词`)
    }
  } catch { store.notify('error', '文件格式错误') }
}

async function exportHotwords() {
  const data = store.recognitionOptimize.hotwords.map(w => w.text)
  await fileAdapter.saveJsonDialog(JSON.stringify(data, null, 2), 'hotwords.json')
}

function checkUpdate() {
  store.notify('info', '当前已是最新版本 v3.1.0')
}
</script>

<style scoped>
.settings-panel {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.settings-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧导航 */
.settings-nav {
  width: 160px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-light);
  padding: 12px 8px;
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  text-align: left;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.nav-icon {
  flex-shrink: 0;
}

/* 右侧内容 */
.settings-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.section-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 24px 0 12px;
}

/* 设置行 */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light);
  gap: 16px;
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.setting-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.setting-control {
  flex-shrink: 0;
}

.setting-select {
  height: 32px;
  padding: 0 24px 0 8px;
  font-size: 13px;
  min-width: 140px;
}

/* 设置组 */
.setting-group {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-actions {
  display: flex;
  gap: 6px;
}

/* 热词 */
.preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.preset-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-tag {
  padding: 4px 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-tag:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.preset-tag.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.hotword-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
}

.hotword-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-light);
}

.hotword-item:last-child { border-bottom: none; }

.hotword-text {
  flex: 1;
  font-size: 13px;
}

.hotword-weight {
  display: flex;
  align-items: center;
  gap: 6px;
}

.weight-value {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 16px;
  text-align: center;
}

.range-input {
  -webkit-appearance: none;
  width: 80px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  outline: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
}

.empty-hint {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}

/* 说话人 */
.speaker-list {
  margin-top: 8px;
}

.speaker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.speaker-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.speaker-name {
  flex: 1;
  max-width: 150px;
}

/* 格式对照表 */
.format-table {
  font-size: 12px;
}

/* 关于 */
.about-card {
  display: flex;
  gap: 20px;
  padding: 24px;
}

.about-logo {
  flex-shrink: 0;
}

.about-info h4 {
  font-size: 18px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.about-version {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.about-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.about-links {
  margin-top: 16px;
}

/* 模态框 */
.modal-body {
  padding: 16px 0;
}

/* 快捷键输入 */
.shortcut-input {
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  width: 220px;
  font-family: monospace;
}

.shortcut-input:focus {
  border-color: var(--accent);
  outline: none;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.form-item label {
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
