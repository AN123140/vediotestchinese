/**
 * 讯飞开放平台 - 语音听写（流式）
 * 文档: https://www.xfyun.cn/services/voicedictation
 *
 * 鉴权方式: WebSocket + API Secret 签名（每3小时刷新）
 * 接口: WebSocket 实时转写
 */

const WEBSOCKET_URL = 'wss://iat-api.xfyun.cn/v2/iat'

/** 生成讯飞鉴权 URL 参数 */
export function generateAuthUrl(apiKey, apiSecret) {
  const host = 'iat-api.xfyun.cn'
  const path = '/v2/iat'
  const date = new Date().toUTCString().replace(/GMT/, 'GMT+0800') // 北京时间

  // HMAC-SHA256 签名
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`

  // 使用 Web Crypto API 或简单实现
  const signatureSha256 = btoa(signatureOrigin) // 简化：生产环境应使用真实 HMAC

  const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha256}"`

  return `${WEBSOCKET_URL}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${host}`
}

/**
 * 讯飞语音识别（WebSocket 流式）
 * @param {ArrayBuffer} audioData - PCM 音频数据 (16kHz 16bit)
 * @param {Object} config - { apiKey, apiSecret, language }
 * @returns {Promise<Array>} segments [{start, end, text}]
 */
export async function recognize(audioData, config) {
  const { apiKey, apiSecret, language = 'zh_cn' } = config

  return new Promise((resolve, reject) => {
    try {
      const url = generateAuthUrl(apiKey, apiSecret)
      const ws = new WebSocket(url)

      let allText = []
      const startTime = Date.now()

      ws.onopen = () => {
        // 发送开始帧
        const langCode = language.startsWith('en') ? 'en_us' : 'zh_cn'
        sendFrame(ws, {
          common: { app_id: apiKey }, // 讯飞用 app_id 作为 apiKey
          business: { language: langCode, ptt: 0 },
          data: { status: 0, format: 'audio/L16;rate=16000', encoding: '', audio: '' },
        })

        // 分片发送音频数据
        const chunkSize = 12800 // 每片约400ms音频
        for (let offset = 0; offset < audioData.byteLength; offset += chunkSize) {
          const chunk = audioData.slice(offset, Math.min(offset + chunkSize, audioData.byteLength))
          const isLast = offset + chunkSize >= audioData.byteLength
          sendFrame(ws, {
            data: {
              status: isLast ? 2 : 1,
              format: 'audio/L16;rate=16000',
              encoding: '',
              audio: arrayBufferToBase64(chunk),
            }
          })
        }

        // 发送结束帧
        sendFrame(ws, { data: { status: 3, format: '', encoding: '', audio: '' } })
      }

      ws.onmessage = (event) => {
        const result = JSON.parse(event.data)
        if (result.data && result.data.result) {
          const wsResult = JSON.parse(result.data.result)
          if (wsResult.ws && Array.isArray(wsResult.ws)) {
            for (const item of wsResult.ws) {
              if (item.cw && Array.isArray(item.cw)) {
                allText.push({
                  time: (item.sn || 0),
                  text: item.cw.map(c => c.w).join(''),
                  bg: item.bg || 0,
                  ed: item.ed || 0,
                })
              }
            }
          }
        }
        if (result.data?.status === 2 || result.code === 0) {
          ws.close()
          resolve(parseXunfeiResult(allText))
        }
      }

      ws.onerror = (err) => {
        reject(new Error('讯飞WebSocket连接错误'))
      }

      ws.onclose = () => {
        resolve(parseXunfeiResult(allText))
      }

      // 超时保护
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
          resolve(parseXunfeiResult(allText))
        }
      }, 60000)
    } catch (e) {
      reject(new Error(`讯飞识别失败: ${e.message}`))
    }
  })
}

function sendFrame(ws, payload) {
  ws.send(JSON.stringify(payload))
}

function parseXunfeiResult(rawItems) {
  return rawItems.map(item => ({
    start: item.bg / 1000 || 0,
    end: item.ed / 1000 || 0,
    text: item.text,
  }))
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default {
  id: 'xunfei',
  name: '讯飞开放平台',
  generateAuthUrl,
  recognize,
}
