/**
 * 文件操作适配器
 * 统一封装 Electron 原生文件操作和浏览器文件操作，屏蔽环境差异
 */
import { isElectron } from '../utils/environment.js'

// 最近文件的 localStorage key
const RECENT_FILES_KEY = 'subtitle-app-recent-files'
const MAX_RECENT_FILES = 20

/**
 * 打开视频文件选择对话框
 * @returns {Promise<Object|null>} Electron: { path, name, size } | Browser: File 对象 | null(取消)
 */
export async function openVideo() {
  if (isElectron()) {
    return await window.electronAPI.openVideoDialog()
  }
  // 浏览器：使用隐藏的 input 触发文件选择
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mp4,.avi,.mov,.mkv,.flv,.wmv,.webm,video/*'
    input.onchange = () => {
      const file = input.files?.[0] || null
      resolve(file)
      // 清理 DOM
      setTimeout(() => input.remove(), 100)
    }
    // 用户取消时也 resolve null
    input.addEventListener('cancel', () => {
      resolve(null)
      setTimeout(() => input.remove(), 100)
    })
    input.click()
  })
}

/**
 * 获取视频播放 URL
 * @param {Object|File} file - Electron: { path, name, size } | Browser: File 对象
 * @returns {string} 播放 URL（file:/// 或 blob:）
 */
export function getVideoUrl(file) {
  if (isElectron()) {
    // Electron：使用本地文件协议
    return 'file:///' + file.path.replace(/\\/g, '/')
  }
  // 浏览器：生成 Blob URL
  if (file instanceof File) {
    return URL.createObjectURL(file)
  }
  throw new Error('浏览器环境需要 File 对象')
}

/**
 * 释放视频 URL（仅浏览器需要）
 * @param {string} url - 需要释放的 URL
 */
export function revokeVideoUrl(url) {
  if (!isElectron() && url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

/**
 * 保存 SRT 字幕文件
 * @param {string} content - SRT 内容
 * @param {string} [defaultName='subtitles.srt'] - 默认文件名
 * @returns {Promise<string|null>} Electron: 保存路径 | Browser: null
 */
export async function saveSrt(content, defaultName = 'subtitles.srt') {
  if (isElectron()) {
    return await window.electronAPI.saveSrtDialog(content)
  }
  // 浏览器：触发下载
  downloadFile(content, defaultName, 'text/plain;charset=utf-8')
  return defaultName
}

/**
 * 打开 JSON 文件导入对话框（热词、术语表等）
 * @returns {Promise<string|null>} 文件内容字符串，取消返回 null
 */
export async function openJsonDialog() {
  if (isElectron()) {
    const filePath = await window.electronAPI.openJsonDialog()
    if (!filePath) return null
    // 通过 IPC 读取文件内容（或直接用 readFile）
    return await window.electronAPI.readFile(filePath)
  }
  // 浏览器：使用 FileReader
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      try {
        const text = await readFileAsText(file)
        resolve(text)
      } catch {
        resolve(null)
      }
      setTimeout(() => input.remove(), 100)
    }
    input.addEventListener('cancel', () => {
      resolve(null)
      setTimeout(() => input.remove(), 100)
    })
    input.click()
  })
}

/**
 * 导出/保存 JSON 文件
 * @param {Object|string} data - 数据对象或字符串
 * @param {string} [defaultName='data.json'] - 默认文件名
 * @returns {Promise<string|null>}
 */
export async function saveJsonDialog(data, defaultName = 'data.json') {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  if (isElectron()) {
    return await window.electronAPI.saveJsonDialog(content, defaultName)
  }
  downloadFile(content, defaultName, 'application/json')
  return defaultName
}

// ========== 最近文件记录 ==========

/**
 * 添加最近打开的文件记录
 * @param {Object} fileInfo - { path?, name, size? }
 */
export function addRecentFile(fileInfo) {
  if (isElectron()) {
    window.electronAPI.addRecentFile(fileInfo)
    return
  }
  // 浏览器：localStorage 存储
  try {
    const list = getRecentFilesFromStorage()
    // 去重（按 name + size 判断）
    const idx = list.findIndex(f =>
      f.name === fileInfo.name && f.size === fileInfo.size
    )
    if (idx !== -1) list.splice(idx, 1)
    // 添加到头部
    list.unshift({
      name: fileInfo.name,
      size: fileInfo.size || 0,
      path: fileInfo.path || '',
      time: Date.now(),
    })
    // 限制数量
    if (list.length > MAX_RECENT_FILES) list.length = MAX_RECENT_FILES
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(list))
  } catch { /* ignore */ }
}

/**
 * 获取最近文件列表
 * @returns {Array<{name, size, path?, time}>}
 */
export function getRecentFiles() {
  if (isElectron()) {
    return window.electronAPI.getRecentFiles()
  }
  return getRecentFilesFromStorage()
}

/**
 * 清除最近文件记录
 */
export function clearRecentFiles() {
  if (isElectron()) {
    window.electronAPI.clearRecentFiles()
    return
  }
  localStorage.removeItem(RECENT_FILES_KEY)
}

// ========== 内部工具函数 ==========

/** 从 localStorage 读取最近文件列表 */
function getRecentFilesFromStorage() {
  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * 触发浏览器下载
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟释放 Blob URL，确保下载开始
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 将 File 对象读取为文本
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
