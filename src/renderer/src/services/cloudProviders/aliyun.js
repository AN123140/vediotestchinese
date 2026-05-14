/**
 * 阿里云智能语音 - 一句话识别 / 录音文件识别
 * 文档: https://help.aliyun.com/document_detail/84428.html
 *
 * 鉴权方式: AccessKey ID/Secret + HMAC-SHA1 签名
 * 接口: RESTful HTTP POST
 */

const ASR_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/pop/ext/asr'
const TOKEN_URL = 'https://nls-meta.cn-shanghai.aliyuncs.com/pop/ext/asr'

/** 阿里云签名 */
function sign(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  // 简化签名（生产环境应使用完整 HMAC-SHA1）
  return btoa(sorted)
}

export async function getAccessToken(accessKeyId, accessKeySecret) {
  // 阿里云不需要预获取 token，直接在请求中携带 AK/SK 签名
  return { accessKeyId, accessKeySecret }
}

export async function recognize(audioData, config) {
  const { apiKey: accessKeyId, apiSecret: accessKeySecret, language = 'zh' } = config
  const base64Audio = arrayBufferToBase64(audioData)

  const body = {
    payload: base64Audio,
    schema: '1.0',
    format: 'pcm',
    sample_rate: 16000,
    enable_punctuation_prediction: true,
    enable_inverse_text_normalization: true,
    language_hints: [language === 'en' ? 'en-US' : 'zh-CN'],
  }

  const resp = await fetch(ASR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NLS-Token': btoa(`${accessKeyId}:${sign(body, accessKeySecret)}`),
    },
    body: JSON.stringify(body),
  })

  const result = await resp.json()
  if (result.status_code !== 20000000 && result.status_code !== 21050000) {
    throw new Error(`阿里云识别失败(${result.status_code}): ${result.message || result.error_msg || '未知错误'}`)
  }

  return parseAliyunResult(result)
}

function parseAliyunResult(data) {
  const segments = []
  if (data.result && Array.isArray(data.result)) {
    for (const item of data.result) {
      if (item.sentences && Array.isArray(item.sentences)) {
        for (const s of item.sentences) {
          segments.push({
            start: s.begin_time / 1000 || 0,
            end: s.end_time / 1000 || 0,
            text: s.text,
          })
        }
      } else if (item.text) {
        segments.push({ start: 0, end: 0, text: item.text })
      }
    }
  }
  return segments.length ? segments : [{ start: 0, end: audioData.byteLength / 32000, text: data.result?.[0]?.text || '' }]
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default {
  id: 'aliyun',
  name: '阿里云智能语音',
  getAccessToken,
  recognize,
}
