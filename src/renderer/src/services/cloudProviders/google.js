/**
 * Google Cloud Speech-to-Text
 * 文档: https://cloud.google.com/speech-to-text/docs
 *
 * 鉴权方式: OAuth 2.0 / Service Account JSON Key
 * 接口: RESTful HTTP POST (v1:speech:recognize)
 *
 * 注意：Google Cloud API 需要服务端代理（API Key 不能在浏览器端直接使用）
 * 此模块提供接口定义，实际调用建议通过后端代理转发
 */

const ASR_URL = 'https://speech.googleapis.com/v1/speech:recognize'

export async function getAccessToken(apiKey) {
  // Google Cloud 推荐通过后端代理，浏览器端仅传递 API key
  return { token: apiKey }
}

/**
 * Google 语音识别
 * 注意：由于 CORS 限制，此函数可能需要通过后端代理调用
 * 建议配置 vite.web.config.js 的 proxy 将 /google-stt 转发到 Google API
 */
export async function recognize(audioData, config) {
  const { apiKey, language = 'zh-CN' } = config
  const base64Audio = arrayBufferToBase64(audioData)

  const body = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: language,
      enableAutomaticPunctuation: true,
      model: 'latest_long', // 支持长音频
    },
    audio: {
      content: base64Audio,
    },
  }

  try {
    // 尝试直接调用（如果用户已配置 CORS 或使用代理）
    const resp = await fetch(`${ASR_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}))
      throw new Error(`Google识别失败(${resp.status}): ${err.error?.message || 'HTTP错误'}`)
    }

    const result = await resp.json()
    return parseGoogleResult(result)
  } catch (e) {
    // 如果是 CORS 错误，提示用户配置代理
    if (e.message.includes('CORS') || e.message.includes('Failed to fetch')) {
      throw new Error('Google Cloud API 存在跨域限制。请在设置中切换其他服务商，或配置后端代理。')
    }
    throw e
  }
}

function parseGoogleResult(data) {
  const segments = []
  if (!data.results) return segments

  for (const result of data.results) {
    const alternatives = result.alternatives || []
    if (alternatives.length === 0) continue

    const best = alternatives[0]
    const words = best.words || []

    if (words.length > 0) {
      // 有词级时间戳：按标点/长停顿分段
      let segStart = words[0].startTime?.seconds || 0
        + (words[0].startTime?.nanos || 0) / 1e9
      let segEnd = words[words.length - 1].endTime?.seconds || 0
        + (words[words.length - 1].endTime?.nanos || 0) / 1e9

      // 检查是否有足够长的停顿需要分段
      const text = words.map(w => w.word).join('')
      segments.push({ start: segStart, end: segEnd, text })
    } else if (best.transcript) {
      // 无时间戳信息
      segments.push({
        start: 0,
        end: 0,
        text: best.transcript,
      })
    }
  }

  return segments
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default {
  id: 'google',
  name: 'Google Cloud Speech-to-Text',
  getAccessToken,
  recognize,
}
