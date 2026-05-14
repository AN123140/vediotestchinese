/**
 * 存储适配器
 * 统一封装 Electron IPC 存储和浏览器 localStorage
 */
import { isElectron } from '../utils/environment.js'

const STORAGE_PREFIX = 'subtitle-app-'

/**
 * 获取配置值
 * @param {string} key - 配置键名（不含前缀）
 * @returns {Promise<any>} 值
 */
export async function get(key) {
  if (isElectron()) {
    try {
      return await window.electronAPI.getConfig(key)
    } catch {
      // IPC 不可用时降级到 localStorage
      const raw = localStorage.getItem(STORAGE_PREFIX + key)
      return raw ? JSON.parse(raw) : null
    }
  }
  const raw = localStorage.getItem(STORAGE_PREFIX + key)
  return raw ? JSON.parse(raw) : null
}

/**
 * 设置配置值
 * @param {string} key - 配置键名
 * @param {any} value - 值
 */
export async function set(key, value) {
  if (isElectron()) {
    try {
      await window.electronAPI.setConfig(key, value)
      return
    } catch {
      // IPC 不可用时降级到 localStorage
    }
  }
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
}

/**
 * 删除配置值
 * @param {string} key - 配置键名
 */
export async function remove(key) {
  if (isElectron()) {
    try {
      await window.electronAPI.removeConfig(key)
      return
    } catch { /* fallback */ }
  }
  localStorage.removeItem(STORAGE_PREFIX + key)
}
