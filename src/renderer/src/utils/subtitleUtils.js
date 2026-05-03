import { parseSrtTime, formatSrtTime } from './formatTime.js'

/**
 * 字幕操作工具函数
 */

/**
 * 在指定位置后插入新字幕
 */
export function insertSubtitle(subtitles, afterIndex) {
  const prev = subtitles[afterIndex]
  const newSub = {
    id: Date.now(),
    start: prev ? prev.end + 0.1 : 0,
    end: prev ? prev.end + 2.5 : 2.5,
    text: '',
  }
  subtitles.splice(afterIndex + 1, 0, newSub)
  return newSub
}

/**
 * 在末尾追加字幕
 */
export function appendSubtitle(subtitles, endTime = 0) {
  const newSub = {
    id: Date.now(),
    start: endTime + 0.1,
    end: endTime + 2.5,
    text: '',
  }
  subtitles.push(newSub)
  return newSub
}

/**
 * 删除指定索引的字幕
 */
export function deleteSubtitle(subtitles, index) {
  if (index >= 0 && index < subtitles.length) {
    subtitles.splice(index, 1)
  }
}

/**
 * 合并两条相邻字幕
 */
export function mergeSubtitles(subtitles, index) {
  if (index < 0 || index >= subtitles.length - 1) return false
  const current = subtitles[index]
  const next = subtitles[index + 1]
  current.end = next.end
  current.text = current.text + next.text
  subtitles.splice(index + 1, 1)
  return true
}

/**
 * 拆分一条字幕为两条
 */
export function splitSubtitle(subtitles, index) {
  if (index < 0 || index >= subtitles.length) return false
  const sub = subtitles[index]
  const midTime = (sub.start + sub.end) / 2
  const textParts = splitText(sub.text)
  if (textParts.length < 2) {
    // 无法智能拆分，在中间位置拆
    const mid = Math.floor(sub.text.length / 2)
    textParts.length = 0
    textParts.push(sub.text.substring(0, mid), sub.text.substring(mid))
  }
  sub.text = textParts[0]
  sub.end = midTime
  const newSub = {
    id: Date.now(),
    start: midTime,
    end: midTime + (sub.end - sub.start) / 2,
    text: textParts[1] || '',
  }
  subtitles.splice(index + 1, 0, newSub)
  return true
}

/**
 * 简单文本拆分（按标点或空格）
 */
function splitText(text) {
  const midPunctuation = text.search(/[，。！？；：\.,!?;:\s]/g)
  if (midPunctuation > 0 && midPunctuation < text.length - 1) {
    return [text.substring(0, midPunctuation + 1), text.substring(midPunctuation + 1).trim()]
  }
  return [text]
}

/**
 * 根据当前时间查找匹配的字幕索引
 */
export function findActiveSubtitle(subtitles, currentTime) {
  if (!subtitles.length || currentTime === 0) return -1
  return subtitles.findIndex(
    s => currentTime >= s.start && currentTime <= s.end
  )
}

/**
 * 调整字幕时间（整体偏移）
 */
export function shiftSubtitles(subtitles, offsetSeconds) {
  subtitles.forEach(s => {
    s.start = Math.max(0, s.start + offsetSeconds)
    s.end = Math.max(s.start + 0.1, s.end + offsetSeconds)
  })
}

/**
 * 字幕排序（按开始时间）
 */
export function sortSubtitles(subtitles) {
  subtitles.sort((a, b) => a.start - b.start)
}

/**
 * 检查字幕时间轴是否重叠
 */
export function checkOverlap(subtitles) {
  const overlaps = []
  for (let i = 0; i < subtitles.length - 1; i++) {
    if (subtitles[i].end > subtitles[i + 1].start) {
      overlaps.push({ index: i, nextIndex: i + 1 })
    }
  }
  return overlaps
}

/**
 * 自动调整字幕间隔（避免重叠）
 */
export function autoAdjustTiming(subtitles, minGap = 0.1) {
  sortSubtitles(subtitles)
  for (let i = 0; i < subtitles.length - 1; i++) {
    if (subtitles[i].end + minGap > subtitles[i + 1].start) {
      subtitles[i].end = subtitles[i + 1].start - minGap
    }
  }
}

/**
 * 解析 SRT 文本 → 字幕数组
 */
export function parseSRT(content) {
  const blocks = content.trim().split(/\n\s*\n/)
  const subtitles = []

  blocks.forEach((block, i) => {
    const lines = block.trim().split('\n')
    if (lines.length < 2) return

    let timeLineIdx = -1
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].includes('-->')) {
        timeLineIdx = j
        break
      }
    }
    if (timeLineIdx === -1) return

    const timeMatch = lines[timeLineIdx].match(
      /(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/
    )
    if (!timeMatch) return

    const textLines = lines.slice(timeLineIdx + 1).join('\n').trim()
    if (!textLines) return

    subtitles.push({
      id: i + 1,
      start: parseSrtTime(timeMatch[1]),
      end: parseSrtTime(timeMatch[2]),
      text: textLines,
    })
  })

  return subtitles
}

/**
 * 获取字幕总时长
 */
export function getTotalDuration(subtitles) {
  if (!subtitles.length) return 0
  return Math.max(...subtitles.map(s => s.end))
}

/**
 * 获取字幕总字数
 */
export function getTotalWordCount(subtitles) {
  return subtitles.reduce((sum, s) => sum + s.text.replace(/\s/g, '').length, 0)
}
