import { formatSrtTime, formatVttTime, formatAssTime } from './formatTime.js'

/**
 * 生成 SRT 格式字幕
 */
export function generateSRT(subtitles) {
  return subtitles
    .map((s, i) =>
      `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(s.end)}\n${s.text}\n`
    )
    .join('\n')
}

/**
 * 生成 ASS 格式字幕
 * @param {Array} subtitles - 字幕数组
 * @param {Object} style - 样式配置
 */
export function generateASS(subtitles, style = {}) {
  const {
    fontFamily = 'Microsoft YaHei',
    fontSize = 20,
    fontColor = '&H00FFFFFF', // ASS 使用 BGR 格式
    strokeColor = '&H00000000',
    bgColor = '&H00000000',
    outlineWidth = 1,
    shadowDepth = 1,
    alignment = 2, // 2=底部居中, 8=顶部居中, 5=中部居中
    marginV = 30,
    bold = false,
  } = style

  const assStyleName = 'Default'
  const resX = 1920
  const resY = 1080

  const assFontSize = Math.round(fontSize * resY / 100)

  const events = subtitles
    .map(s =>
      `Dialogue: 0,${formatAssTime(s.start)},${formatAssTime(s.end)},${assStyleName},,0,0,0,,${escapeAss(s.text)}`
    )
    .join('\n')

  const boldFlag = bold ? -1 : 0

  return `[Script Info]
Title: Subtitles
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${assStyleName},${fontFamily},${assFontSize},${fontColor},&H000000FF,${strokeColor},${bgColor},${boldFlag},0,0,0,100,100,0,0,1,${outlineWidth},${shadowDepth},${alignment},10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}`
}

/**
 * 生成 WebVTT 格式字幕
 */
export function generateVTT(subtitles) {
  const header = 'WEBVTT\n\n'
  const cues = subtitles
    .map(s =>
      `${formatVttTime(s.start)} --> ${formatVttTime(s.end)}\n${escapeVtt(s.text)}\n`
    )
    .join('\n')
  return header + cues
}

/**
 * 生成纯文本格式（时间戳 + 文本）
 */
export function generateTXT(subtitles, withTimestamp = true) {
  if (withTimestamp) {
    return subtitles
      .map((s, i) => {
        const start = new Date(s.start * 1000).toISOString().substring(11, 23)
        const end = new Date(s.end * 1000).toISOString().substring(11, 23)
        return `[${start} --> ${end}]\n${s.text}`
      })
      .join('\n\n')
  }
  return subtitles.map(s => s.text).join('\n')
}

/**
 * 生成 JSON 格式
 */
export function generateJSON(subtitles, metadata = {}) {
  return JSON.stringify({
    metadata: {
      generator: 'Subtitle Generator v2.0',
      createdAt: new Date().toISOString(),
      ...metadata,
    },
    subtitles: subtitles.map((s, i) => ({
      index: i + 1,
      start: Math.round(s.start * 1000) / 1000,
      end: Math.round(s.end * 1000) / 1000,
      text: s.text,
    })),
  }, null, 2)
}

/**
 * 生成 CSV 格式
 */
export function generateCSV(subtitles) {
  const bom = '\uFEFF' // UTF-8 BOM，确保 Excel 正确识别
  const header = '序号,开始时间,结束时间,持续时间(秒),字幕文本\n'
  const rows = subtitles
    .map((s, i) => {
      const duration = (s.end - s.start).toFixed(2)
      const text = s.text.replace(/"/g, '""')
      return `${i + 1},"${formatSrtTime(s.start)}","${formatSrtTime(s.end)}","${duration}","${text}"`
    })
    .join('\n')
  return bom + header + rows
}

/**
 * 获取所有支持的导出格式配置
 */
export function getExportFormats() {
  return [
    { id: 'srt', name: 'SRT', ext: '.srt', mimeType: 'text/plain', desc: '最通用格式，所有播放器支持' },
    { id: 'ass', name: 'ASS/SSA', ext: '.ass', mimeType: 'text/plain', desc: '支持特效、样式、动画' },
    { id: 'vtt', name: 'WebVTT', ext: '.vtt', mimeType: 'text/vtt', desc: '网页视频标准格式' },
    { id: 'txt', name: 'TXT', ext: '.txt', mimeType: 'text/plain', desc: '纯文本，无时间轴' },
    { id: 'json', name: 'JSON', ext: '.json', mimeType: 'application/json', desc: '结构化数据，供程序使用' },
    { id: 'csv', name: 'CSV', ext: '.csv', mimeType: 'text/csv', desc: '表格格式，方便 Excel 编辑' },
  ]
}

/**
 * 根据格式 ID 生成字幕内容
 */
export function generateByFormat(formatId, subtitles, options = {}) {
  switch (formatId) {
    case 'srt': return generateSRT(subtitles)
    case 'ass': return generateASS(subtitles, options.style)
    case 'vtt': return generateVTT(subtitles)
    case 'txt': return generateTXT(subtitles, options.withTimestamp)
    case 'json': return generateJSON(subtitles, options.metadata)
    case 'csv': return generateCSV(subtitles)
    default: return generateSRT(subtitles)
  }
}

// ASS 特殊字符转义
function escapeAss(text) {
  return text
    .replace(/\\n/g, '\\N')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
}

// VTT 特殊字符处理
function escapeVtt(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
