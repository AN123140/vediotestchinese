/**
 * WebAssembly Whisper 离线识别模块（Stub 版本）
 *
 * 功能已移至 wasmRecognizer.full.js（因 Rollup 解析问题暂未启用）
 * 当前版本：所有 API 直接抛出"不可用"错误，
 * 由 recognizeAdapter 自动降级到其他识别策略。
 */

export const STATE = {
  UNINITIALIZED: 'uninitialized',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
}

/** 获取当前 WASM 引擎状态 */
export function getWasmState() {
  return STATE.UNINITIALIZED
}

/** 获取模型加载进度 */
export function getLoadProgress() {
  return { percent: 0, text: 'WASM 模块未启用' }
}

/** 预加载 Whisper WASM 模型 */
export async function preloadModel() {
  throw new Error('WASM 离线识别功能尚未就绪')
}

/**
 * Whisper WASM 语音识别
 */
export async function recognizeWasm() {
  throw new Error('WASM 离线识别功能尚未就绪。请使用本地服务或云端 API 进行识别。')
}
