/**
 * 导出适配器
 * 统一封装各格式字幕导出，底层使用 Blob + 浏览器下载（双环境通用）
 * Electron 环境也可选择原生保存对话框
 */
import { isElectron } from '../utils/environment.js'
import { generateSRT, generateASS, generateVTT, generateTXT } from '../utils/exportFormats.js'
import * as fileAdapter from './fileAdapter.js'

/**
 * 导出 SRT 字幕
 */
export async function downloadSrt(subtitles, options = {}) {
  const content = generateSRT(subtitles)
  const name = options.filename || 'subtitles.srt'
  if (isElectron() && !options.forceBrowser) {
    return await fileAdapter.saveSrt(content, name)
  }
  triggerDownload(content, name, 'text/plain;charset=utf-8')
}

/**
 * 导出 ASS 字幕
 */
export async function downloadAss(subtitles, options = {}) {
  const content = generateASS(subtitles, options.style)
  const name = options.filename || 'subtitles.ass'
  if (isElectron() && !options.forceBrowser) {
    return await fileAdapter.saveSrt(content, name)
  }
  triggerDownload(content, name, 'text/plain;charset=utf-8')
}

/**
 * 导出 WebVTT 字幕
 */
export async function downloadVtt(subtitles, options = {}) {
  const content = generateVTT(subtitles)
  const name = options.filename || 'subtitles.vtt'
  triggerDownload(content, name, 'text/vtt')
}

/**
 * 导出纯文本字幕
 */
export async function downloadTxt(subtitles, options = {}) {
  const content = generateTXT(subtitles, options.withTimestamp)
  const name = options.filename || 'subtitles.txt'
  triggerDownload(content, name, 'text/plain;charset=utf-8')
}

/**
 * 通用导出入口（根据 formatId 自动选择格式）
 * @param {string} formatId - 格式标识（srt/ass/vtt/txt/json/csv）
 * @param {Array} subtitles - 字幕数组
 * @param {Object} [options={}] - filename, style, forceBrowser 等
 */
export async function exportByFormat(formatId, subtitles, options = {}) {
  switch (formatId) {
    case 'srt': return await downloadSrt(subtitles, options)
    case 'ass': return await downloadAss(subtitles, options)
    case 'vtt': return await downloadVtt(subtitles, options)
    case 'txt': return await downloadTxt(subtitles, options)
    default: return await downloadSrt(subtitles, options)
  }
}

// ========== 内部工具 ==========

function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
