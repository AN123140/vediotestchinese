/**
 * 识别适配器
 * 统一封装语音识别入口，支持多策略自动降级：
 *   local(本地后端) → cloud(云端API) → wasm(浏览器WASM) → web-speech → null(提示)
 */
import { isElectron, isWasmSupported, isWebSpeechSupported } from '../utils/environment.js'

const BACKEND_URL = 'http://127.0.0.1:8081'

// 策略类型常量
export const STRATEGY = {
  LOCAL: 'local',
  CLOUD: 'cloud',
  WASM: 'wasm',
  WEB_SPEECH: 'web-speech',
}

/**
 * 选择识别策略（智能降级）
 * 降级顺序：local(本地后端) → cloud(云端API) → wasm(浏览器WASM) → web-speech → null
 *
 * @param {Object} [options={}]
 * @param {string} [options.apiKey] - 云端 API Key（有值时作为降级选项）
 * @param {string} [options.provider] - 云端服务商标识
 * @param {boolean} [options.useLocal=true] - 是否允许使用本地后端（默认 true）
 * @returns {Promise<string|null>} STRATEGY 常量或 null（无可用策略）
 */
export async function selectStrategy(options = {}) {
  const { apiKey, provider, useLocal = true } = options

  // 1. 本地后端（默认首选）— 快速检测是否可用
  if (useLocal) {
    const localOk = await checkBackendAvailable()
    if (localOk) return STRATEGY.LOCAL
    // 本地不可用时继续尝试其他策略，不立即报错
    console.log('[recognizeAdapter] 本地后端不可用，尝试降级...')
  }

  // 2. 云端 API
  if (apiKey && provider) {
    return STRATEGY.CLOUD
  }

  // 3. WASM（浏览器离线）
  if (isWasmSupported()) {
    return STRATEGY.WASM
  }

  // 4. Web Speech API（仅 Chrome）
  if (isWebSpeechSupported()) {
    return STRATEGY.WEB_SPEECH
  }

  // 无可用策略
  return null
}

/** 检查本地后端是否可用（快速检测，不阻塞） */
async function checkBackendAvailable() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    console.log(`[recognizeAdapter] 检测后端: ${BACKEND_URL}/api/health`)
    const resp = await fetch(`${BACKEND_URL}/api/health`, {
      signal: controller.signal,
      method: 'GET',
    })
    clearTimeout(timeout)
    console.log(`[recognizeAdapter] 后端状态: ${resp.status} ${resp.ok ? 'OK' : 'FAIL'}`)
    return resp.ok
  } catch (e) {
    console.warn(`[recognizeAdapter] 后端不可用: ${e.message}`)
    return false
  }
}

/**
 * 统一语音识别入口
 *
 * @param {Object|File} source - 视频源信息
 *   Electron: { path, name, size }
 *   Browser: File 对象（或包含 fileRef 的 task 对象）
 * @param {Object} options
 * @param {string} [options.language='zh'] - 识别语言
 * @param {AbortSignal} [options.signal] - 取消信号
 * @param {number} [options.timeout=600000] - 超时时间(ms)
 * @param {Function} [options.onProgress] - 进度回调 (percent, text)
 * @returns {Promise<Object>} 识别结果 { success, subtitles: [{start,end,text}], ... }
 */
export async function recognize(source, options = {}) {
  const strategy = await selectStrategy(options)

  // 策略降级：如果选定的策略失败，尝试下一个可用策略
  const strategyOrder = [
    STRATEGY.LOCAL, STRATEGY.CLOUD, STRATEGY.WASM, STRATEGY.WEB_SPEECH,
  ].filter(s => s !== strategy) // 排除当前策略，避免重复
  // 将当前策略放在最前面
  const orderedStrategies = [strategy, ...strategyOrder]

  let lastError = null
  for (const s of orderedStrategies) {
    try {
      switch (s) {
        case STRATEGY.LOCAL:
          return await recognizeLocal(source, { ...options, useLocal: true })
        case STRATEGY.CLOUD:
          return await recognizeCloud(source, options)
        case STRATEGY.WASM:
          return await recognizeWasm(source, options)
        case STRATEGY.WEB_SPEECH:
          return await recognizeWebSpeech(source, options)
        default:
          break
      }
    } catch (e) {
      lastError = e
      console.warn(`[recognizeAdapter] 策略 ${s} 失败: ${e.message}`)
      if (s === STRATEGY.LOCAL && options.apiKey && options.provider) {
        // 本地失败但云端配置了，提示用户正在降级
        options.onProgress?.(0, '本地服务不可用，尝试云端识别...')
      }
      continue
    }
  }

  // 所有策略都失败了
  throw lastError || new Error(
    '无可用识别方式。请确保：\n' +
    '1. 本地识别服务已启动（python backend/server.py），或\n' +
    '2. 已在设置中配置云端 API Key，或\n' +
    '3. 使用 Chrome 浏览器以启用 Web Speech API'
  )
}

// ========== 本地后端识别 ==========

async function recognizeLocal(source, options) {
  const { language = 'zh', signal, timeout = 10 * 60 * 1000, onProgress } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // 链接外部 signal
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    onProgress?.(5, '连接识别服务...')

    // Electron 环境：发送文件路径
    if (isElectron() && source.path) {
      onProgress?.(20, '正在处理视频文件...')
      const resp = await fetch(`${BACKEND_URL}/api/recognize/path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: source.path,
          model_size: 'large-v3',
          language,
        }),
        signal: controller.signal,
      })
      return await handleResponse(resp)
    }

    // 浏览器环境 / 有 File 对象：FormData 上传
    const file = source instanceof File ? source : source.fileRef || source._file
    if (file instanceof File) {
      onProgress?.(15, '上传视频文件...')
      // 大文件警告
      if (file.size > 500 * 1024 * 1024) {
        console.warn(`文件较大(${(file.size / 1024 / 1024).toFixed(0)}MB)，可能需要较长时间`)
      }
      const formData = new FormData()
      formData.append('file', file, file.name || 'video.mp4')
      formData.append('model_size', 'large-v3')
      formData.append('language', language)

      onProgress?.(25, '上传中...')
      const resp = await fetch(`${BACKEND_URL}/api/recognize`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      return await handleResponse(resp)
    }

    throw new Error('无法获取文件数据')
  } catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') throw new Error('请求超时或已取消')

    // 友好错误分类
    const msg = String(e.message || '')
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('识别服务连接中断。请确认已运行 python backend/server.py')
    }
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

/** 处理后端响应 */
async function handleResponse(resp) {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.detail || `服务器错误 (${resp.status})`)
  }
  const result = await resp.json()
  if (!result.success) throw new Error(result.detail || '识别失败')
  return result
}

// ========== 云端 API 识别 ==========

async function recognizeCloud(source, options) {
  const { provider = 'baidu', apiKey, apiSecret, language = 'zh', signal, timeout = 600000, onProgress } = options

  // 动态导入云端服务商（避免未配置时加载）
  try {
    const { callProvider } = await import('../services/cloudProviders/index.js')

    onProgress?.(5, '连接云端识别服务...')

    // 获取音频数据：从视频文件提取 PCM
    const audioData = await extractAudioData(source, options)
    onProgress?.(30, '音频已就绪，发送到云端...')

    // 设置超时
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const segments = await callProvider(provider, audioData, {
        apiKey, apiSecret, language,
      })

      clearTimeout(timeoutId)

      if (!segments || segments.length === 0) {
        throw new Error('云端识别返回空结果')
      }

      return {
        success: true,
        subtitles: segments.map((s, i) => ({
          id: i + 1, start: s.start, end: s.end, text: s.text,
        })),
      }
    } catch (e) {
      clearTimeout(timeoutId)
      if (e.name === 'AbortError') throw new Error('请求超时或已取消')
      throw e
    }
  } catch (importErr) {
    // 动态导入失败（可能模块不存在）
    console.error('云端模块加载失败:', importErr)
    throw new Error('云端识别模块加载失败，请确认服务商配置正确')
  }
}

/**
 * 从视频源中提取音频数据为 PCM ArrayBuffer
 * 浏览器环境使用 Web Audio API 或 FFmpeg.wasm
 * @param {Object|File} source - 视频源
 * @param {Object} options - 配置
 * @returns {Promise<ArrayBuffer>} PCM 音频数据
 */
async function extractAudioData(source, options) {
  const file = source instanceof File ? source : source.fileRef || source._file

  if (file instanceof File) {
    // 使用 Web Audio API 解码音频
    return await extractAudioFromFile(file)
  } else if (source.path && isElectron()) {
    // Electron 环境：通过后端代理提取音频
    const resp = await fetch(`${BACKEND_URL}/api/audio/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: source.path }),
      signal: options.signal,
    })
    if (!resp.ok) throw new Error('音频提取失败')
    return await resp.arrayBuffer()
  }

  throw new Error('无法从视频文件中提取音频数据')
}

/**
 * 从 File 对象解码音频为 PCM 数据
 * 使用 Web Audio API 的 decodeAudioData
 */
async function extractAudioFromFile(file) {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()

    file.arrayBuffer().then(arrayBuffer => {
      audioContext.decodeAudioData(
        arrayBuffer,
        (audioBuffer) => {
          // 提取 PCM 数据
          const pcmData = audioBuffer.getChannelData(0) // 取第一个声道
          const float32To16BitPCM = (float32Array) => {
            const buffer = new ArrayBuffer(float32Array.length * 2)
            const view = new DataView(buffer)
            for (let i = 0; i < float32Array.length; i++) {
              const s = Math.max(-1, Math.min(1, float32Array[i]))
              view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
            }
            return buffer
          }
          resolve(float32To16BitPCM(pcmData))
          audioContext.close()
        },
        (error) => {
          reject(new Error(`音频解码失败: ${error.message}`))
          audioContext.close()
        }
      )
    }).catch(reject)
  })
}

/**
 * 注册云端识别引擎（供 Phase 4 的 cloudProviders 使用）
 * @param {string} providerId - 服务商标识
 * @param {Function} recognizer - async (audioData, opts) => result
 */
export function registerCloudEngine(providerId, recognizer) {
  _cloudEngines[providerId] = recognizer
}

const _cloudEngines = {}

// ========== WASM 离线识别 ==========

async function recognizeWasm(source, options) {
  try {
    const { default: wasmModule } = await import('../services/wasmRecognizer.js')

    // 获取音频源
    const file = source instanceof File ? source : source.fileRef || source._file
    if (!file && !source.path) throw new Error('无法获取视频文件数据')

    // 调用 WASM 识别
    return await wasmModule.recognizeWasm(file || source, {
      language: options.language || 'zh',
      onProgress: options.onProgress,
      signal: options.signal,
    })
  } catch (importErr) {
    // 模块加载失败或不可用
    if (importErr.message.includes('不支持') || importErr.message.includes('无法')) {
      throw new Error(importErr.message)
    }
    console.error('[recognizeAdapter] WASM 模块错误:', importErr)
    throw new Error('WASM 离线识别功能尚未就绪。请使用本地服务或云端 API 进行识别。')
  }
}

// ========== Web Speech API 识别 ==========

async function recognizeWebSpeech(source, _options) {
  // Web Speech API 仅支持实时音频流输入，不支持文件直接识别
  // 这里作为最后的降级提示
  throw new Error(
    '当前仅 Web Speech API 可用（仅限 Chrome 浏览器的实时麦克风输入）。' +
    '对于文件识别，请启动本地识别服务或配置云端 API。'
  )
}
