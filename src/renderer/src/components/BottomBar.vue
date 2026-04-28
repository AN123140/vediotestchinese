<template>
  <div class="bottom-bar">
    <div class="bar-left">
      <button class="btn btn-secondary" @click="$emit('import')" :disabled="isProcessing">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        导入视频
      </button>

      <div class="divider"></div>

      <!-- 语言选择 -->
      <div class="lang-select-wrapper">
        <label class="lang-label">语言</label>
        <select
          class="lang-select"
          :value="language"
          @change="$emit('update:language', $event.target.value)"
          :disabled="isProcessing"
        >
          <option value="zh">中文（自动检测方言）</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="">自动检测</option>
        </select>
      </div>

      <div class="divider"></div>

      <button
        class="btn btn-primary recognize-btn"
        @click="$emit('recognize')"
        :disabled="!hasVideo || isProcessing"
      >
        <span v-if="!isProcessing" class="btn-inner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>
          开始识别
        </span>
        <span v-else class="btn-inner processing">
          <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          识别中...
        </span>
      </button>
    </div>

    <!-- 进度条区域 -->
    <div class="bar-center">
      <transition name="fade">
        <div v-if="isProcessing" class="progress-area">
          <div class="progress-track">
            <div class="progress-bar" :style="{ width: progress + '%' }">
              <div class="progress-glow"></div>
            </div>
          </div>
          <span class="progress-text">{{ progressText }}</span>
          <span class="progress-pct">{{ progress }}%</span>
        </div>
        <div v-else-if="!hasVideo" class="hint-text">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
          请先导入视频文件，再点击识别
        </div>
      </transition>
    </div>

    <div class="bar-right">
      <button
        class="btn btn-success"
        @click="$emit('export-srt')"
        :disabled="!hasSubtitles || isProcessing"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导出 SRT
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  hasVideo: Boolean,
  isProcessing: Boolean,
  progress: Number,
  progressText: String,
  hasSubtitles: Boolean,
  language: { type: String, default: 'zh' },
})

defineEmits(['import', 'recognize', 'export-srt', 'update:language'])
</script>

<style scoped>
.bottom-bar {
  height: 54px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bar-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border);
}

.recognize-btn {
  min-width: 108px;
}

.btn-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 进度条 */
.progress-area {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
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
  right: 0;
  top: 0;
  bottom: 0;
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

.hint-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 语言选择器 */
.lang-select-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lang-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.lang-select {
  height: 30px;
  padding: 0 8px;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  min-width: 160px;
}

.lang-select:focus {
  border-color: var(--accent);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
