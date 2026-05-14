/**
 * 环境检测工具
 * 统一判断当前运行环境（Electron 桌面端 / 浏览器网页端）
 */

// 缓存检测结果，避免重复计算
let _cachedEnv = null

/**
 * 是否在 Electron 桌面环境中运行
 * 通过检测 preload 脚本暴露的 electronAPI 判断
 */
export function isElectron() {
  if (_cachedEnv === null) {
    _cachedEnv = typeof window !== 'undefined' &&
                  typeof window.electronAPI !== 'undefined'
  }
  return _cachedEnv
}

/**
 * 是否在浏览器环境中运行
 */
export function isBrowser() {
  return !isElectron()
}

/**
 * 获取当前环境标识字符串
 * @returns {'electron' | 'browser'}
 */
export function getEnvironment() {
  return isElectron() ? 'electron' : 'browser'
}

/**
 * 浏览器是否支持 WebAssembly
 */
export function isWasmSupported() {
  return typeof WebAssembly === 'object' &&
         typeof WebAssembly.instantiate === 'function'
}

/**
 * 浏览器是否支持 Web Speech API（语音识别）
 */
export function isWebSpeechSupported() {
  return typeof window !== 'undefined' &&
         ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
}
