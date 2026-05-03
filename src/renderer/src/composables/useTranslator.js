import { ref, computed } from 'vue'
import { generateMockTranslation, mockDelay } from '../utils/mockData.js'

export function useTranslator() {
  const translationResults = ref([])
  const isTranslating = ref(false)
  const currentTranslatingIndex = ref(-1)
  const progress = ref(0)

  // Mock 翻译引擎
  async function translateAll(subtitles, targetLang = 'en') {
    if (!subtitles.length) return
    isTranslating.value = true
    translationResults.value = []
    progress.value = 0

    for (let i = 0; i < subtitles.length; i++) {
      currentTranslatingIndex.value = i
      progress.value = Math.round(((i + 1) / subtitles.length) * 100)

      await mockDelay(200 + Math.random() * 300)
      translationResults.value.push({
        index: i,
        original: subtitles[i].text,
        translated: generateMockTranslation(subtitles[i].text),
        confidence: 0.75 + Math.random() * 0.24,
      })
    }

    currentTranslatingIndex.value = -1
    isTranslating.value = false
  }

  // 单句重译
  async function retranslate(index, originalText) {
    await mockDelay(300 + Math.random() * 200)
    if (translationResults.value[index]) {
      translationResults.value[index].translated = generateMockTranslation(originalText)
      translationResults.value[index].confidence = 0.8 + Math.random() * 0.19
    }
  }

  // 编辑翻译结果
  function updateTranslation(index, text) {
    if (translationResults.value[index]) {
      translationResults.value[index].translated = text
    }
  }

  // 应用翻译（替换原字幕）
  function applyTranslation(subtitles, mode = 'dual') {
    if (mode === 'single') {
      // 单语翻译：替换原字幕
      subtitles.forEach((s, i) => {
        if (translationResults.value[i]) {
          s.text = translationResults.value[i].translated
        }
      })
    }
    // dual 模式：不修改原字幕，导出时生成双语字幕
  }

  // 生成双语字幕
  function generateDualSubtitles(subtitles) {
    return subtitles.map((s, i) => {
      const tr = translationResults.value[i]
      if (tr) {
        return { ...s, text: `${s.text}\n${tr.translated}` }
      }
      return s
    })
  }

  // 获取翻译统计
  const stats = computed(() => {
    const total = translationResults.value.length
    const avgConfidence = total > 0
      ? translationResults.value.reduce((sum, r) => sum + r.confidence, 0) / total
      : 0
    return { total, avgConfidence: Math.round(avgConfidence * 100) }
  })

  function reset() {
    translationResults.value = []
    isTranslating.value = false
    currentTranslatingIndex.value = -1
    progress.value = 0
  }

  return {
    translationResults,
    isTranslating,
    currentTranslatingIndex,
    progress,
    translateAll,
    retranslate,
    updateTranslation,
    applyTranslation,
    generateDualSubtitles,
    stats,
    reset,
  }
}
