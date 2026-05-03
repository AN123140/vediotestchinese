/**
 * 时间格式化工具函数
 * 统一处理 SRT、VTT、ASS、TXT 等格式的时间戳转换
 */

/**
 * 秒数 → SRT 时间格式  HH:MM:SS,mmm
 */
export function formatSrtTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

/**
 * 秒数 → VTT 时间格式  HH:MM:SS.mmm
 */
export function formatVttTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`
}

/**
 * 秒数 → ASS 时间格式  H:MM:SS.cc (百分之一秒)
 */
export function formatAssTime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const cs = Math.floor((sec % 1) * 100)
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs, 2)}`
}

/**
 * 秒数 → 显示格式  MM:SS 或 HH:MM:SS
 */
export function formatDisplayTime(sec) {
  if (sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`
}

/**
 * 秒数 → 精确显示格式  MM:SS.ms
 */
export function formatDisplayTimeMs(sec) {
  if (sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 10)
  return `${pad(m)}:${pad(s)}.${ms}`
}

/**
 * 秒数 → 处理时间估算显示
 */
export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}秒`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}分${s > 0 ? s + '秒' : ''}`
}

/**
 * 解析 SRT 时间字符串 → 秒数
 * 支持格式: HH:MM:SS,mmm  和  MM:SS.ms
 */
export function parseSrtTime(str) {
  if (!str) return 0
  str = str.trim()
  // HH:MM:SS,mmm
  const match1 = str.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/)
  if (match1) {
    const [, h, m, s, ms] = match1
    return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms.padEnd(3, '0')) / 1000
  }
  // MM:SS.ms
  const match2 = str.match(/^(\d+):(\d+)[.](\d+)$/)
  if (match2) {
    const [, m, s, ms] = match2
    return parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 10
  }
  // 纯数字（秒）
  const num = parseFloat(str)
  return isNaN(num) ? 0 : num
}

/**
 * 文件大小格式化
 */
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function pad(n, len = 2) {
  return String(n).padStart(len, '0')
}
