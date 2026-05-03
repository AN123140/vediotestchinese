<template>
  <div class="audio-separation">
    <div class="coming-soon-card">
      <div class="cs-icon">🎵</div>
      <div class="cs-title">背景音乐智能处理</div>
      <div class="cs-desc">
        使用 AI 模型（Demucs v4）自动分离人声与背景音乐，<br />
        大幅提升有背景音视频的语音识别准确率。<br /><br />
        此功能需要下载 Demucs 音源分离模型（约 80MB），<br />
        将在后续版本中开放。
      </div>
      <div class="feature-list">
        <div class="feat-item" v-for="f in features" :key="f">
          <span class="feat-icon">✓</span>
          <span>{{ f }}</span>
        </div>
      </div>
      <div class="cs-badge">即将推出</div>
    </div>
  </div>
</template>

<script setup>
const features = [
  '2轨分离：人声 + 伴奏',
  '4轨分离：人声 + 鼓 + 贝斯 + 其他',
  '仅对人声轨道进行语音识别',
  '压制视频时可选是否保留背景音乐',
  '可调节人声/背景音乐音量比例',
]
</script>

<style scoped>
.audio-separation { display: flex; flex-direction: column; gap: 16px; }

.coming-soon-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 16px; padding: 32px 24px;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-light);
  border-radius: 12px; text-align: center;
}

.cs-icon { font-size: 40px; }
.cs-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.cs-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.8; }

.feature-list {
  display: flex; flex-direction: column; gap: 8px;
  text-align: left; width: 100%; max-width: 400px;
}

.feat-item {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--text-primary);
}

.feat-icon { color: #22c55e; font-weight: 700; flex-shrink: 0; }

.cs-badge {
  padding: 6px 18px;
  background: rgba(245,158,11,0.12); color: #f59e0b;
  border-radius: 20px; font-size: 12px; font-weight: 600;
}
</style>
