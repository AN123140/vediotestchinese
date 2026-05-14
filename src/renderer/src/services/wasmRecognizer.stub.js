/**
 * WebAssembly Whisper 离线识别模块（Stub 版本）
 * 完整功能详见 wasmRecognizer.full.js
 * 当前版本：直接抛出"不可用"错误，由 recognizeAdapter 自动降级
 */

export function getWasmState() {
  return 'unavailable'
}

export function getLoadProgress() {
  return { percent: 0, text: 'WASM 模块未加载' }
}

export async function preloadModel() {
  throw new Error('WASM 离线识别功能尚未就绪')
}

export async function recognizeWasm() {
  throw new Error('WASM 离线识别功能尚未就绪。请使用本地服务或云端 API 进行识别。')
}

export { STATE } from './wasmRecognizer.full.js' // 若不存在则忽略
