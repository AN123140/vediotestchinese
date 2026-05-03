<template>
  <div class="emotion-recognition">
    <div class="coming-soon-card">
      <div class="cs-icon">🎭</div>
      <div class="cs-title">情感识别标注</div>
      <div class="cs-desc">
        识别说话人情绪（平静/高兴/激动/严肃/悲伤/惊讶/愤怒），<br />
        自动调整字幕颜色、大小和动画效果。<br /><br />
        此功能需要下载 Wav2Vec2 情感分析模型（约 400MB），<br />
        将在后续版本中开放。
      </div>
      <div class="emotion-table">
        <div class="emotion-row header">
          <span>情绪</span><span>颜色</span><span>大小</span><span>动画</span>
        </div>
        <div v-for="e in emotions" :key="e.name" class="emotion-row">
          <span class="em-name">{{ e.name }}</span>
          <span class="em-color" :style="{ color: e.color }">{{ e.color }}</span>
          <span>{{ e.size }}</span>
          <span class="em-anim">{{ e.anim }}</span>
        </div>
      </div>
      <div class="cs-badge">即将推出</div>
    </div>
  </div>
</template>

<script setup>
const emotions = [
  { name: '平静', color: '#ffffff', size: '100%', anim: '无' },
  { name: '高兴', color: '#FFD700', size: '105%', anim: '轻微弹跳' },
  { name: '激动', color: '#FF8C00', size: '110%', anim: '放大出现' },
  { name: '严肃', color: '#aaaaaa', size: '100%', anim: '无' },
  { name: '悲伤', color: '#87CEEB', size: '95%', anim: '渐显' },
  { name: '惊讶', color: '#FF4444', size: '115%', anim: '闪烁一次' },
  { name: '愤怒', color: '#8B0000', size: '110%', anim: '抖动' },
]
</script>

<style scoped>
.emotion-recognition { display: flex; flex-direction: column; gap: 16px; }

.coming-soon-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 14px; padding: 32px 24px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: 12px; text-align: center;
}

.cs-icon { font-size: 40px; }
.cs-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.cs-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.8; }

.emotion-table {
  width: 100%; max-width: 480px;
  border: 1px solid var(--border-light); border-radius: 8px;
  overflow: hidden; font-size: 13px;
}

.emotion-row {
  display: grid; grid-template-columns: 1fr 1.5fr 1fr 1.5fr;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
}
.emotion-row:last-child { border-bottom: none; }
.emotion-row.header {
  background: var(--bg-primary);
  font-size: 11px; font-weight: 600;
  color: var(--text-secondary); text-transform: uppercase;
}

.em-name { font-weight: 600; color: var(--text-primary); }
.em-anim { font-size: 12px; color: var(--text-secondary); }

.cs-badge {
  padding: 6px 18px;
  background: rgba(245,158,11,0.12); color: #f59e0b;
  border-radius: 20px; font-size: 12px; font-weight: 600;
}
</style>
