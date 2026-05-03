<template>
  <div class="ai-panel">
    <!-- 功能卡片网格 -->
    <div v-if="!activeFeature" class="ai-home">
      <div class="ai-home-header">
        <div class="ai-home-title">
          <span class="ai-icon">✦</span>
          <h2>AI 智能功能</h2>
        </div>
        <p class="ai-home-subtitle">基于语义理解自动优化字幕，减少人工干预</p>
      </div>

      <div class="feature-grid">
        <button
          v-for="feat in features"
          :key="feat.id"
          class="feature-card"
          :class="{ 'one-click': feat.id === 'one-click' }"
          @click="openFeature(feat.id)"
        >
          <div class="feature-card-icon">{{ feat.icon }}</div>
          <div class="feature-card-body">
            <div class="feature-card-name">{{ feat.name }}</div>
            <div class="feature-card-desc">{{ feat.desc }}</div>
          </div>
          <div class="feature-card-arrow">›</div>
        </button>
      </div>

      <!-- 快速提示 -->
      <div class="ai-tips">
        <div class="ai-tip" v-if="!hasSubtitles">
          <span class="tip-icon">💡</span>
          请先在「单视频处理」中导入视频并完成语音识别，再使用 AI 优化功能。
        </div>
        <div class="ai-tip success" v-else>
          <span class="tip-icon">✅</span>
          已检测到 {{ subtitleCount }} 条字幕，可以开始 AI 优化。
          <button class="tip-btn" @click="openFeature('one-click')">一键全优化 →</button>
        </div>
      </div>
    </div>

    <!-- 子功能面板 -->
    <div v-else class="ai-feature-view">
      <div class="feature-nav">
        <button class="back-btn" @click="activeFeature = null">
          ‹ 返回
        </button>
        <span class="feature-nav-title">{{ currentFeature?.name }}</span>
      </div>
      <div class="feature-content">
        <SmartSegment v-if="activeFeature === 'segment'" />
        <SmartPunctuation v-else-if="activeFeature === 'punctuation'" />
        <ContextCorrection v-else-if="activeFeature === 'correction'" />
        <OneClickOptimize v-else-if="activeFeature === 'one-click'" @done="activeFeature = null" />
        <EmotionRecognition v-else-if="activeFeature === 'emotion'" />
        <AudioSeparation v-else-if="activeFeature === 'audio-sep'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import store from '../composables/useAppStore.js'
import SmartSegment from './SmartSegment.vue'
import SmartPunctuation from './SmartPunctuation.vue'
import ContextCorrection from './ContextCorrection.vue'
import OneClickOptimize from './OneClickOptimize.vue'
import EmotionRecognition from './EmotionRecognition.vue'
import AudioSeparation from './AudioSeparation.vue'

const activeFeature = ref(null)

const features = [
  { id: 'segment',     icon: '✂️',  name: '智能分段', desc: '按语义自动合并/拆分过短或过长的字幕' },
  { id: 'punctuation', icon: '，。', name: '智能标点', desc: '根据语气和停顿自动添加标点符号' },
  { id: 'correction',  icon: '🔍',  name: '上下文纠错', desc: '修正专有名词和同音字识别错误' },
  { id: 'emotion',     icon: '🎭',  name: '情感识别', desc: '识别情绪并自动调整字幕样式' },
  { id: 'audio-sep',   icon: '🎵',  name: '背景音乐处理', desc: 'AI分离人声与背景音，提升识别率' },
  { id: 'one-click',   icon: '⚡',  name: '一键全优化', desc: '依次执行所有AI优化，一步到位' },
]

const currentFeature = computed(() => features.find(f => f.id === activeFeature.value))
const hasSubtitles = computed(() => store.subtitles.length > 0)
const subtitleCount = computed(() => store.subtitles.length)

function openFeature(id) {
  activeFeature.value = id
}

// 响应快捷键触发的子功能导航
watch(() => store.aiSubFeature, (id) => {
  if (id) {
    activeFeature.value = id
    store.aiSubFeature = null
  }
})
</script>

<style scoped>
.ai-panel {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ===== 首页 ===== */
.ai-home {
  padding: 28px 32px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.ai-home-header {
  margin-bottom: 28px;
}

.ai-home-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.ai-icon {
  font-size: 20px;
  color: var(--accent);
}

.ai-home-title h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.ai-home-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== 功能卡片网格 ===== */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.18s;
  color: var(--text-primary);
  width: 100%;
}

.feature-card:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.feature-card.one-click {
  border-color: var(--accent);
  background: var(--accent-light);
}

.feature-card.one-click:hover {
  background: var(--accent);
  color: #fff;
}

.feature-card-icon {
  font-size: 22px;
  flex-shrink: 0;
  width: 36px;
  text-align: center;
}

.feature-card-body {
  flex: 1;
  min-width: 0;
}

.feature-card-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 3px;
}

.feature-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.one-click .feature-card-desc {
  color: var(--accent);
}

.feature-card.one-click:hover .feature-card-desc {
  color: rgba(255,255,255,0.8);
}

.feature-card-arrow {
  font-size: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

/* ===== 提示区 ===== */
.ai-tips {
  margin-top: 8px;
}

.ai-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.ai-tip.success {
  border-color: #22c55e44;
  background: rgba(34, 197, 94, 0.06);
  color: var(--text-primary);
}

.tip-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.tip-btn {
  margin-left: auto;
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.tip-btn:hover {
  opacity: 0.85;
}

/* ===== 子功能视图 ===== */
.ai-feature-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.feature-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  background: transparent;
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.back-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.feature-nav-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.feature-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}
</style>
