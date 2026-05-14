/**
 * 百度智能云 - 语音识别
 * 文档: https://ai.baidu.com/tech/asr
 *
 * 鉴权方式: access_token（有效期30天，需定时刷新）
 * 接口: RESTful HTTP POST
 */
const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const ASR_URL = 'https://vop.baidu.com/server_api'

/** 获取 access_token */
export async function getAccessToken(apiKey, secretKey) {
  const resp = await fetch(`${TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`)
  const data = await resp.json()
  if (data.error) throw new Error(`百度鉴权失败: ${data.error_description || data.error}`)
  return data.access_token
}

/**
 * 百度语音识别（长音频，异步回调模式）
 * @param {ArrayBuffer} audioData - PCM 音频数据
 * @param {Object} config - { accessToken, language }
 * @returns {Promise<Array>} segments [{start, end, text}]
 */
export async function recognize(audioData, config) {
  const { accessToken, language = 'zh' } = config

  // 将 ArrayBuffer 转为 Base64
  const base64Audio = arrayBufferToBase64(audioData)

  const body = {
    format: 'pcm',
    rate: 16000,
    channel: 1,
    cuid: 'subtitle-app-web',
    token: accessToken,
    speech: base64Audio,
    len: audioData.byteLength,
    dev_pid: language === 'en' ? 1737 : 1537, // 1537中文, 1737英文
  }

  const resp = await fetch(ASR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const result = await resp.json()
  if (result.err_no !== 0) {
    throw new Error(`百度识别失败(${result.err_no}): ${result.err_msg || '未知错误'}`)
  }

  // 解析返回结果
  if (result.result && Array.isArray(result.result)) {
    return parseBaiduResult(result)
  }
  return []
}

function parseBaiduResult(data) {
  // 百度返回每段文字和对应时间信息
  const segments = []
  // 简化解析：百度长语音返回 result 数组 + 可能的 sn/Duration 字段
  if (!data.result) return segments

  // 如果有详细时间戳结果
  if (Array.isArray(data.sn_result) && data.sn_result.length > 0) {
    for (const item of data.sn_result) {
      if (item.res && item.res.length) {
        for (const res of item.res) {
          for (const r of res) {
            segments.push({
              start: r.start_time / 1000 || 0,
              end: r.end_time / 1000 || 0,
              text: r.content?.replace(/<\/*[^>]+>/g, '') || '',
            })
          }
        }
      }
    }
  } else {
    // 简单文本结果：按字符数均匀分配时间
    const totalText = data.result.join('')
    const totalTime = (data.Duration || totalText.length * 300) / 1000
    const avgDuration = Math.max(totalTime / Math.max(data.result.length, 1), 1)
    let offset = 0
    for (const text of data.result) {
      segments.push({
        start: offset,
        end: offset + avgDuration * Math.max(text.length * 0.3, 1),
        text,
      })
      offset += avgDuration * Math.max(text.length * 0.3, 1)
    }
  }

  return segments
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 导出统一的适配接口
export default {
  id: 'baidu',
  name: '百度智能云',
  getAccessToken,
  recognize,
}
