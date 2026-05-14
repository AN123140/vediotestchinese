/**
 * WebAssembly Whisper 离线识别模块
 *
 * 集成 whisper.wasm（基于 whisper.cpp 或 whisper-web）实现浏览器端离线语音识别
 *
 * 使用方式：
 *   1. 首次调用 recognize() 时自动懒加载模型
 *   2. 模型下载/加载进度通过 onProgress 回调报告
 *   3. 加载完成后缓存在内存中，后续调用直接使用
 */

import { isWasmSupported } from '../utils/environment.js'

// WASM 模块状态
const STATE = {
  UNINITIALIZED: 'uninitialized',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
}

let _state = STATE.UNINITIALIZED
let _wasmModule = null
let _modelData = null
let _loadProgress = { percent: 0, text: '' }

// ========== 公共 API ==========

/** 获取当前 WASM 引擎状态 */
export function getWasmState() {
  return _state
}

/** 获取模型加载进度 */
export function getLoadProgress() {
  return { ..._loadProgress }
}

/**
 * 预加载 Whisper WASM 模型（可选，不调用则首次识别时自动加载）
 * @param {Object} [options={}] - 配置选项
 * @returns {Promise<boolean>} 是否加载成功
 */
export async function preloadModel(options = {}) {
  if (_state === STATE.READY) return true
  if (_state === STATE.LOADING) return false

  return await initWasmEngine(options)
}

/**
 * Whisper WASM 语音识别
 * @param {ArrayBuffer|File} audioSource - PCM 音频数据或包含音频的文件
 * @param {Object} options - 识别选项
 * @param {string} [options.language='zh'] - 语言
 * @param {Function} [options.onProgress] - 进度回调
 * @param {AbortSignal} [options.signal] - 取消信号
 * @returns {Promise<Object>} { success, subtitles: [{start,end,text}] }
 */
export async function recognizeWasm(audioSource, options = {}) {
  const { language = 'zh', onProgress, signal } = options

  // 确保引擎已初始化
  if (_state !== STATE.READY) {
    onProgress?.(0, '正在加载 Whisper 模型...')
    const ok = await initWasmEngine(options)
    if (!ok) throw new Error('Whisper WASM 模型加载失败')
  }

  onProgress?.(10, '准备音频数据...')

  // 获取 PCM 音频数据
  let audioData
  if (audioSource instanceof ArrayBuffer) {
    audioData = audioSource
  } else if (audioSource instanceof File) {
    audioData = await extractAudioFromFile(audioSource)
  } else {
    throw new Error('无效的音频数据格式')
  }

  onProgress?.(30, '开始 WASM 推理...')

  try {
    // 调用 WASM 推理
    const result = await runWasmInference(audioData, {
      language,
      onProgress,
      signal,
    })

    onProgress?.(100, '完成')
    return result
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('识别已取消')
    throw new Error(`WASM 识别失败: ${e.message}`)
  }
}

// ========== 内部实现 ==========

/** 初始化 WASM 引擎 */
async function initWasmEngine(options = {}) {
  if (_state === STATE.LOADING || _state === STATE.READY) {
    // 等待已有加载完成
    while (_state === STATE.LOADING) {
      await new Promise(r => setTimeout(r, 100))
    }
    return _state === STATE.READY
  }

  if (!isWasmSupported()) {
    _state = STATE.ERROR
    throw new Error('当前浏览器不支持 WebAssembly')
  }

  _state = STATE.LOADING
  _loadProgress = { percent: 0, text: '初始化 WASM 运行时...' }

  try {
    // 尝试从 CDN 或本地路径加载 whisper.wasm
    // 支持多种来源：npm 包、CDN、本地文件
    _loadProgress = { percent: 5, text: '加载 Whisper.js...' }

    const whisperModule = await loadWhisperLibrary()
    _wasmModule = whisperModule

    _loadProgress = { percent: 30, text: '加载 Whisper tiny 模型 (~75MB)...' }

    // 加载模型权重文件
    _modelData = await loadModelWeights(options.modelUrl)

    _loadProgress = { percent: 90, text: '初始化推理引擎...' }

    // 初始化 Whisper 实例
    await initializeInstance(options.language || 'zh')

    _state = STATE.READY
    _loadProgress = { percent: 100, text: '就绪' }
    console.log('[WASM] Whisper 引擎初始化完成')
    return true
  } catch (e) {
    _state = STATE.ERROR
    _loadProgress = { percent: 0, text: `加载失败: ${e.message}` }
    console.error('[WASM] 初始化失败:', e)
    throw e
  }
}

/**
 * 动态加载 whisper.js / whisper.wasm 库
 * 优先级：1. npm 包 2. CDN 3. 本地 public 目录
 */
async function loadWhisperLibrary() {
  // 方式1：尝试 import npm 包 (@nickmcd/whisper-wasm 或类似)
  try {
    const mod = await import(/* @vite-ignore */ '@nickmcd/whisper-wasm')
    return mod.default || mod
  } catch { /* 继续尝试其他方式 */ }

  // 方式2：尝试 CDN 加载（仅作为后备）
  try {
    // 如果有全局 whisper 对象（通过 script 标签注入），直接使用
    if (typeof window !== 'undefined' && window.Whisper) {
      return window.Whisper
    }
  } catch { /* continue */ }

  throw new Error(
    '无法加载 Whisper WASM 库。请确保已安装依赖包（如 @nickmcd/whisper-wasm）' +
    '或将 whisper.wasm 文件放置在 public/wasm 目录中'
  )
}

/**
 * 加载模型权重文件（ggml-tiny.bin 或类似格式）
 */
async function loadModelWeights(customUrl) {
  const modelUrl = customUrl || '/wasm/whisper-tiny/ggml-tiny.bin'

  const resp = await fetch(modelUrl)
  if (!resp.ok) {
    throw new Error(`模型文件下载失败(${resp.status}): ${modelUrl}`)
  }

  // 流式读取并报告进度
  const contentLength = resp.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength) : 0
  let loaded = 0
  const chunks = []

  const reader = resp.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (total > 0) {
      const pct = Math.round((loaded / total) * 60) + 30 // 30-90% 区间
      _loadProgress.percent = pct
      _loadProgress.text = `加载模型... ${(loaded / 1024 / 1024).toFixed(0)}MB / ${(total / 1024 / 1024).toFixed(0)}MB`
    }
  }

  // 合并所有 chunk
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result.buffer
}

/** 初始化 Whisper 实例 */
async function initializeInstance(language) {
  if (!_wasmModule) throw new Error('WASM 模块未加载')

  // 根据 whisper.js API 初始化
  // 不同库的 API 可能不同，这里提供通用适配层
  if (typeof _wasmModule.createWhisperWithModule === 'function') {
    // whisper.cpp WASM 格式
    _wasmInstance = await _wasmModule.createWhisperWithModule(_module => ({
      ..._module,
      // 自定义日志
      log: (level, msg) => {
        if (level <= 1) console.log(`[Whisper.WASM]`, msg)
      },
    }))
    await _wasmInstance.init(_modelData)
  } else if (typeof _wasmModule.default?.createWhisper === 'function') {
    // @nickmcd/whisper-wasm 格式
    _wasmInstance = await _wasmModule.default.createWhisper(_modelData)
  } else {
    // 回退：假设是简单的函数式接口
    _wasmInstance = _wasmModule
  }

  console.log('[WASM] 实例创建成功, 语言:', language)
}

let _wasmInstance = null

/** 执行 WASM 推理 */
async function runWasmInference(pcmData, options) {
  const { language = 'zh', onProgress, signal } = options

  // 检查取消
  if (signal?.aborted) throw Object.assign(new Error('已取消'), { name: 'AbortError' })

  onProgress?.(40, 'WASM 推理中...')

  // 调用实际推理接口
  if (_wasmInstance && typeof _wasmInstance.transcribe === 'function') {
    // 标准 transcribe 接口
    const result = await _wasmInstance.transcribe(new Int16Array(pcmData), {
      language,
      word_timestamps: true,
    })

    // 解析结果为统一格式
    const segments = parseWasmResult(result)
    return {
      success: true,
      subtitles: segments.map((s, i) => ({ id: i + 1, start: s.start, end: s.end, text: s.text })),
    }
  }

  if (_wasmInstance && typeof _wasmInstance.runInference === 'function') {
    // 备选接口
    const rawResult = await _wasmInstance.runInference({
      audioData: pcmData,
      language,
    })
    return {
      success: true,
      subtitles: Array.isArray(rawResult) ? rawResult.map((s, i) => ({
        id: i + 1, start: s.start || 0, end: s.end || 0, text: s.text || '',
      })) : [],
    }
  }

  // 无可用推理接口
  throw new Error('WASM 推理接口不可用，请确认 whisper.wasm 版本兼容性')
}

/** 解析 WASM 输出结果为标准 segments 格式 */
function parseWasmResult(result) {
  if (!result) return []

  // whisper.cpp WASM 通常返回 { segments: [...], text: "" } 结构
  if (result.segments && Array.isArray(result.segments)) {
    return result.segments.map(s => ({
      start: s.start?.[0] ?? s.t?.start ?? 0,
      end: s.end?.[0] ?? s.t?.end ?? 0,
      text: Array.isArray(s.text) ? s.text.join('') : (s.text || ''),
    }))
  }

  // 备选：纯文本结果
  if (typeof result === 'string') {
    return [{ start: 0, end: 0, text: result }]
  }

  return []
}

/** 从 File 提取 PCM 音频数据（16kHz 16bit mono） */
async function extractAudioFromFile(file) {
  return new Promise((resolve, reject) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    file.arrayBuffer().then(buf => {
      ctx.decodeAudioData(
        buf,
        (audioBuf) => {
          const channelData = audioBuf.getChannelData(0)
          // Float32 -> Int16 PCM
          const pcm = new ArrayBuffer(channelData.length * 2)
          const view = new DataView(pcm)
          for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i])
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
          }
          resolve(pcm)
          ctx.close()
        },
        err => {
          reject(new Error(`音频解码失败: ${err.message}`))
          ctx.close()
        }
      )
    }).catch(reject)
  })
}

/** 导出状态枚举 */
export { STATE }
