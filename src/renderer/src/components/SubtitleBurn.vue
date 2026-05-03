<template>
  <div class="burn-panel">
    <div class="burn-layout">
      <!-- 左侧：输出设置 + 字幕样式 -->
      <div class="burn-left">
        <!-- 输出设置 -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">输出设置</span>
          </div>
          <div class="form-grid">
            <div class="form-item">
              <label>编码格式</label>
              <select v-model="store.burnSettings.codec">
                <option value="h264">H.264（兼容性好）</option>
                <option value="h265">H.265 / HEVC（体积小）</option>
              </select>
            </div>
            <div class="form-item">
              <label>分辨率</label>
              <select v-model="store.burnSettings.resolution">
                <option value="original">原画</option>
                <option value="720p">720p (1280x720)</option>
                <option value="1080p">1080p (1920x1080)</option>
                <option value="4k">4K (3840x2160)</option>
              </select>
            </div>
            <div class="form-item">
              <label>视频质量</label>
              <select v-model="store.burnSettings.quality">
                <option value="high">高（码率较大）</option>
                <option value="medium">中（推荐）</option>
                <option value="low">低（体积最小）</option>
              </select>
            </div>
            <div class="form-item">
              <label>输出格式</label>
              <select v-model="store.burnSettings.format">
                <option value="mp4">MP4</option>
                <option value="mkv">MKV</option>
                <option value="mov">MOV</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 字幕样式 -->
        <div class="card" style="margin-top: 12px">
          <div class="card-header">
            <span class="card-title">字幕样式</span>
            <button class="btn btn-sm btn-secondary" @click="resetStyle">重置默认</button>
          </div>
          <div class="form-grid">
            <div class="form-item full-width">
              <label>字体</label>
              <select v-model="style.fontFamily">
                <option v-for="font in fonts" :key="font" :value="font">{{ font }}</option>
              </select>
            </div>
            <div class="form-item">
              <label>字号 <span class="form-hint">{{ style.fontSize }}%</span></label>
              <input type="range" v-model.number="style.fontSize" min="3" max="10" step="0.5"
                     class="range-input" />
            </div>
            <div class="form-item">
              <label>位置</label>
              <select v-model="style.position">
                <option value="top">顶部</option>
                <option value="middle">中部</option>
                <option value="bottom">底部</option>
              </select>
            </div>
            <div class="form-item">
              <label>垂直微调 <span class="form-hint">{{ style.offsetY }}px</span></label>
              <input type="range" v-model.number="style.offsetY" min="-100" max="100" step="1"
                     class="range-input" />
            </div>
            <div class="form-item">
              <label>字体颜色</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="style.fontColor" class="color-input" />
                <span class="color-value">{{ style.fontColor }}</span>
              </div>
            </div>
            <div class="form-item">
              <label>描边颜色</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="style.strokeColor" class="color-input" />
                <span class="color-value">{{ style.strokeColor }}</span>
              </div>
            </div>
            <div class="form-item">
              <label>描边宽度 <span class="form-hint">{{ style.strokeWidth }}px</span></label>
              <input type="range" v-model.number="style.strokeWidth" min="0" max="5" step="0.5"
                     class="range-input" />
            </div>
            <div class="form-item">
              <label>背景颜色</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="style.bgColor" class="color-input" />
                <span class="color-value">{{ style.bgColor }}</span>
              </div>
            </div>
            <div class="form-item">
              <label>背景透明度 <span class="form-hint">{{ style.bgOpacity }}%</span></label>
              <input type="range" v-model.number="style.bgOpacity" min="0" max="100" step="5"
                     class="range-input" />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：预览区 + 输出路径 -->
      <div class="burn-right">
        <!-- 预览区 -->
        <div class="card preview-card">
          <div class="card-header">
            <span class="card-title">效果预览</span>
          </div>
          <div class="preview-area" ref="previewArea">
            <div class="preview-frame" :style="previewBackground">
              <div class="preview-subtitle" :style="previewSubtitleStyle">
                {{ previewText }}
              </div>
            </div>
          </div>
        </div>

        <!-- 输出路径 -->
        <div class="card" style="margin-top: 12px">
          <div class="card-header">
            <span class="card-title">输出设置</span>
          </div>
          <div class="form-grid">
            <div class="form-item full-width">
              <label>输出路径</label>
              <div class="path-input-group">
                <input type="text" v-model="store.burnSettings.outputPath" placeholder="选择输出目录..."
                       class="path-input" readonly />
                <button class="btn btn-sm btn-secondary" @click="selectOutputPath">浏览</button>
              </div>
            </div>
            <div class="form-item full-width">
              <label>文件名</label>
              <input type="text" v-model="outputFilename" placeholder="输入输出文件名..." />
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="burn-actions">
          <button class="btn btn-primary burn-start-btn" @click="startBurn"
                  :disabled="!store.subtitles.length || isBurning">
            <svg v-if="!isBurning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <svg v-else class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            {{ isBurning ? '压制中...' : '开始压制' }}
          </button>
          <span v-if="estimatedTime" class="estimate-time">预计用时: {{ estimatedTime }}</span>
        </div>

        <!-- 进度 -->
        <div v-if="isBurning" class="burn-progress">
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: burnProgress + '%' }">
              <div class="progress-glow"></div>
            </div>
          </div>
          <span class="progress-text">{{ burnStatusText }}</span>
          <span class="progress-pct">{{ burnProgress }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import store from '../composables/useAppStore.js'
import { MOCK_FONTS } from '../utils/mockData.js'

const fonts = MOCK_FONTS
const style = computed(() => store.burnSettings.subtitleStyle)

// 预览文字：取第一条字幕或默认
const previewText = computed(() => {
  if (store.subtitles.length > 0) return store.subtitles[0].text
  return '预览字幕文字'
})

// 预览背景（模拟视频帧）
const previewBackground = computed(() => {
  const gradients = [
    'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 50%, #0a1628 100%)',
    'linear-gradient(135deg, #1b2d3d 0%, #0f1f3a 50%, #0a0a2e 100%)',
  ]
  return {
    background: gradients[0],
  }
})

// 预览字幕样式
const previewSubtitleStyle = computed(() => {
  const s = style.value
  const positionMap = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  }
  return {
    fontFamily: `"${s.fontFamily}", sans-serif`,
    fontSize: s.fontSize * 3.2 + 'px',
    color: s.fontColor,
    textShadow: s.strokeWidth > 0
      ? `${s.strokeWidth}px ${s.strokeWidth}px 0 ${s.strokeColor}, -${s.strokeWidth}px -${s.strokeWidth}px 0 ${s.strokeColor}, ${s.strokeWidth}px -${s.strokeWidth}px 0 ${s.strokeColor}, -${s.strokeWidth}px ${s.strokeWidth}px 0 ${s.strokeColor}`
      : 'none',
    backgroundColor: `rgba(${hexToRgb(s.bgColor)}, ${s.bgOpacity / 100})`,
    padding: '4px 16px',
    borderRadius: '4px',
    alignSelf: positionMap[s.position] || 'flex-end',
    transform: `translateY(${s.offsetY}px)`,
  }
})

const outputFilename = computed({
  get: () => store.burnSettings.outputFilename,
  set: (v) => { store.burnSettings.outputFilename = v },
})

// 预计用时
const estimatedTime = computed(() => {
  if (!store.videoInfo || !store.subtitles.length) return null
  // Mock: 假设处理速度为 2x 实时
  return '3分25秒'
})

// 压制状态
const isBurning = ref(false)
const burnProgress = ref(0)
const burnStatusText = ref('')

function resetStyle() {
  Object.assign(store.burnSettings.subtitleStyle, {
    fontFamily: 'Microsoft YaHei',
    fontSize: 5,
    position: 'bottom',
    offsetY: 0,
    fontColor: '#ffffff',
    strokeColor: '#000000',
    bgColor: '#000000',
    strokeWidth: 1,
    bgOpacity: 0,
  })
}

async function selectOutputPath() {
  if (window.electronAPI?.openOutputDialog) {
    const path = await window.electronAPI.openOutputDialog()
    if (path) store.burnSettings.outputPath = path
  } else {
    // 浏览器环境: 使用 mock 路径
    store.burnSettings.outputPath = 'D:\\output'
  }
}

async function startBurn() {
  if (!store.subtitles.length) return
  isBurning.value = true
  burnProgress.value = 0

  const steps = [
    { p: 5, t: '正在准备压制参数...' },
    { p: 15, t: '正在加载视频文件...' },
    { p: 30, t: '正在渲染字幕画面...' },
    { p: 50, t: '正在编码视频（H.264）...' },
    { p: 70, t: '正在编码视频（H.264）...' },
    { p: 85, t: '正在合并音视频轨道...' },
    { p: 95, t: '正在写入输出文件...' },
    { p: 100, t: '压制完成！' },
  ]

  for (const step of steps) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800))
    burnProgress.value = step.p
    burnStatusText.value = step.t
  }

  isBurning.value = false
  burnProgress.value = 0
  burnStatusText.value = ''
  store.notify('success', '字幕压制完成！输出文件已保存。')
}

// 颜色转换辅助
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0'
}
</script>

<style scoped>
.burn-panel {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.burn-layout {
  display: flex;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.burn-left {
  flex: 1;
  min-width: 300px;
}

.burn-right {
  flex: 1;
  min-width: 300px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-item.full-width {
  grid-column: 1 / -1;
}

.form-item label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-hint {
  color: var(--accent);
  font-size: 11px;
}

.form-item select {
  height: 34px;
}

/* 范围输入 */
.range-input {
  -webkit-appearance: none;
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  outline: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-card);
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

/* 颜色输入 */
.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input {
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  padding: 2px;
  background: var(--bg-input);
}

.color-value {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
}

/* 预览区 */
.preview-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-area {
  flex: 1;
  min-height: 200px;
}

.preview-frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.preview-subtitle {
  color: #fff;
  font-weight: 600;
  text-align: center;
  max-width: 90%;
  word-break: break-word;
  transition: all 0.2s;
}

/* 路径输入 */
.path-input-group {
  display: flex;
  gap: 6px;
}

.path-input {
  flex: 1;
}

/* 操作按钮 */
.burn-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.burn-start-btn {
  min-width: 140px;
  height: 40px;
  font-size: 14px;
}

.estimate-time {
  font-size: 12px;
  color: var(--text-muted);
}

/* 进度 */
.burn-progress {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: var(--bg-hover);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: 3px;
  transition: width 0.4s ease;
  position: relative;
}

.progress-glow {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.progress-pct {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  min-width: 32px;
  text-align: right;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
