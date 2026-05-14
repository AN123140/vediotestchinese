/**
 * Azure Speech Services - 语音转文字
 * 文档: https://learn.microsoft.com/azure/ai-services/speech-service/
 *
 * 鉴权方式: Subscription Key 或 OAuth Token
 * 接口: RESTful HTTP POST (Speech-to-Text REST API for Short Audio)
 */

const ASR_URL = 'https://eastus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1'

export async function getAccessToken(subscriptionKey) {
  // Azure 使用 subscription key 直接调用，无需预获取 token
  return { token: subscriptionKey }
}

export async function recognize(audioData, config) {
  const { apiKey: subscriptionKey, language = 'zh-CN' } = config

  const resp = await fetch(ASR_URL, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      'Accept': 'application/json',
    },
    body: audioData,
  })

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    throw new Error(`Azure识别失败(${resp.status}): ${errText || 'HTTP错误'}`)
  }

  const result = await resp.json()
  if (result.RecognitionStatus === 'Failure') {
    throw new Error(`Azure识别失败: ${result.DisplayText || result.Error?.Message || '未知错误'}`)
  }

  return parseAzureResult(result)
}

function parseAzureResult(data) {
  const segments = []

  if (data.NBest && Array.isArray(data.NBest)) {
    // Azure 返回 N 个最佳结果，每个包含词级时间戳
    const best = data.NBest[0]
    if (best.Display) {
      // 简单模式：只有文本
      segments.push({
        start: data.Offset ? parseInt(data.Offset) / 10000000 : 0,
        end: data.Duration ? parseInt(data.Duration) / 10000000 : 0,
        text: best.Display,
      })
    } else if (best.Lexical && Array.isArray(best.Words)) {
      // 详细模式：有词级别时间戳
      let segStart = Infinity
      let segEnd = 0
      let segText = ''
      let lastEnd = -1

      for (const word of best.Words) {
        const wStart = word.Offset / 10000000
        const wEnd = wStart + word.Duration / 10000000

        if (lastEnd >= 0 && (wStart - lastEnd) > 1.5) {
          // 超过1.5秒间隔，分段
          segments.push({ start: segStart, end: segEnd, text: segText.trim() })
          segStart = wStart
          segText = ''
        }

        if (wStart < segStart) segStart = wStart
        segEnd = wEnd > segEnd ? wEnd : segEnd
        segText += word.Word + ' '
        lastEnd = wEnd
      }
      if (segText.trim()) segments.push({ start: segStart, end: segEnd, text: segText.trim() })
    }
  }

  return segments.length ? segments : [{ start: 0, end: 0, text: '' }]
}

export default {
  id: 'azure',
  name: 'Azure Speech Services',
  getAccessToken,
  recognize,
}
