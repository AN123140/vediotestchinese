/**
 * Mock 数据生成器
 * 用于在无后端时提供模拟数据
 */

/**
 * 生成模拟字幕数据
 * @param {number} count - 字幕条数
 * @param {number} duration - 视频总时长（秒）
 */
export function generateMockSubtitles(count = 20, duration = 180) {
  const sampleTexts = [
    '大家好，欢迎来到本期视频。',
    '今天我们要讨论一个非常有趣的话题。',
    '人工智能技术正在改变我们的生活方式。',
    '首先，让我们来看一下最新的研究进展。',
    '在过去几年里，深度学习取得了突破性的成果。',
    '特别是在自然语言处理领域，效果非常显著。',
    '我们可以看到，大语言模型的能力越来越强。',
    '这些模型能够理解复杂的语义信息。',
    '不仅如此，它们还能生成高质量的文本内容。',
    '接下来，我将为大家展示几个实际案例。',
    '第一个案例是智能客服系统的应用。',
    '通过AI技术，客服响应时间减少了百分之六十。',
    '第二个案例是内容创作辅助工具。',
    '创作者可以利用AI快速生成初稿，大幅提升效率。',
    '当然，我们也需要关注技术带来的挑战。',
    '数据隐私和安全性是首要考虑的问题。',
    '此外，算法偏见也需要我们认真对待。',
    '总的来说，AI技术前景广阔。',
    '我们需要在创新和监管之间找到平衡。',
    '感谢大家的观看，我们下期再见。',
    '如果有任何问题，欢迎在评论区留言讨论。',
    '请记得点赞关注，支持我们继续创作。',
  ]

  const interval = duration / count
  const subtitles = []

  for (let i = 0; i < count; i++) {
    const start = i * interval + Math.random() * (interval * 0.2)
    const end = start + interval * 0.7 + Math.random() * (interval * 0.3)
    subtitles.push({
      id: i + 1,
      start: Math.round(start * 100) / 100,
      end: Math.round(Math.min(end, duration) * 100) / 100,
      text: sampleTexts[i % sampleTexts.length],
    })
  }

  return subtitles
}

/**
 * 生成模拟批量任务
 */
export function generateMockBatchTasks(count = 5) {
  const names = [
    '会议录像_20260425.mp4',
    '产品介绍视频.mp4',
    '培训课程_第三讲.mov',
    '客户访谈记录.mp4',
    '年度总结汇报.mp4',
    '技术分享会录像.mp4',
    '项目评审会议.mp4',
    '英语口语练习.mp4',
    '日语听力训练.mp4',
    '韩语口语课程.mp4',
  ]
  const statuses = ['completed', 'completed', 'completed', 'processing', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']

  return Array.from({ length: count }, (_, i) => ({
    id: Date.now() + i,
    name: names[i % names.length],
    duration: Math.floor(180 + Math.random() * 1620), // 3-30分钟
    size: Math.floor(50 + Math.random() * 950), // 50MB-1GB
    status: statuses[i % statuses.length],
    progress: statuses[i % statuses.length] === 'completed' ? 100
      : statuses[i % statuses.length] === 'processing' ? Math.floor(30 + Math.random() * 60)
      : 0,
    outputPath: `D:\\output\\${names[i % names.length].replace(/\.\w+$/, '.srt')}`,
    error: null,
  }))
}

/**
 * 生成模拟翻译结果
 * @param {string} sourceText - 原文
 * @param {string} targetLang - 目标语言（en/zh/ja/ko）
 */
export function generateMockTranslation(sourceText, targetLang = 'en') {
  // 目标为中文：直接返回原文（原文已经是中文）
  if (targetLang === 'zh') {
    return sourceText
  }

  // 目标为日文/韩文（Mock 暂不支持，返回原文 + 提示）
  if (targetLang === 'ja' || targetLang === 'ko') {
    return `[${targetLang === 'ja' ? '日文' : '韩文'}翻译暂未启用] ${sourceText}`
  }

  // 目标为英文（默认）
  const translationMap = {
    '大家好，欢迎来到本期视频。': 'Hello everyone, welcome to this video.',
    '今天我们要讨论一个非常有趣的话题。': 'Today we will discuss a very interesting topic.',
    '人工智能技术正在改变我们的生活方式。': 'AI technology is changing our way of life.',
    '首先，让我们来看一下最新的研究进展。': 'First, let us look at the latest research progress.',
    '在过去几年里，深度学习取得了突破性的成果。': 'Deep learning has achieved breakthrough results in recent years.',
    '特别是在自然语言处理领域，效果非常显著。': 'Especially in the field of NLP, the results are very significant.',
    '我们可以看到，大语言模型的能力越来越强。': 'We can see that large language models are becoming more capable.',
    '这些模型能够理解复杂的语义信息。': 'These models can understand complex semantic information.',
    '不仅如此，它们还能生成高质量的文本内容。': 'Moreover, they can also generate high-quality text content.',
    '接下来，我将为大家展示几个实际案例。': 'Next, I will show you some practical examples.',
    '第一个案例是智能客服系统的应用。': 'The first example is the application of intelligent customer service.',
    '通过AI技术，客服响应时间减少了百分之六十。': 'With AI technology, customer service response time has been reduced by 60%.',
    '第二个案例是内容创作辅助工具。': 'The second example is content creation assistant tools.',
    '创作者可以利用AI快速生成初稿，大幅提升效率。': 'Creators can use AI to quickly generate drafts, greatly improving efficiency.',
    '当然，我们也需要关注技术带来的挑战。': 'Of course, we also need to pay attention to the challenges brought by technology.',
    '数据隐私和安全性是首要考虑的问题。': 'Data privacy and security are the primary concerns.',
    '此外，算法偏见也需要我们认真对待。': 'In addition, algorithmic bias also needs to be taken seriously.',
    '总的来说，AI技术前景广阔。': 'Overall, AI technology has broad prospects.',
    '我们需要在创新和监管之间找到平衡。': 'We need to find a balance between innovation and regulation.',
    '感谢大家的观看，我们下期再见。': 'Thank you for watching. See you next time.',
  }

  if (translationMap[sourceText]) {
    return translationMap[sourceText]
  }

  // 通用模拟翻译：关键词替换 + 简单句式转换
  const words = sourceText.replace(/[，。！？、；：""''（）【】]/g, ' ').trim().split(/\s+/)
  const simpleMap = {
    '的': 'of', '是': 'is', '在': 'in', '有': 'have', '和': 'and',
    '不': 'not', '我们': 'we', '他们': 'they', '这个': 'this', '那个': 'that',
    '技术': 'technology', '数据': 'data', '系统': 'system', '模型': 'model',
    '视频': 'video', '功能': 'function', '问题': 'problem', '方法': 'method',
    '你': 'you', '他': 'he', '我': 'I', '她': 'she',
    '什么': 'what', '怎么': 'how', '哪里': 'where', '为什么': 'why',
    '好': 'good', '大': 'big', '小': 'small', '新': 'new', '老': 'old',
  }
  const translated = words.map(w => simpleMap[w] || w).join(' ')
  return translated.charAt(0).toUpperCase() + translated.slice(1) + '.'
}

/**
 * 模拟延迟（用于 Mock 异步操作）
 */
export function mockDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 模拟识别进度回调
 * @param {Function} onProgress - 进度回调 (progress: 0-100, text: string)
 * @param {number} duration - 模拟总耗时(ms)
 */
export function simulateProgress(onProgress, duration = 5000) {
  return new Promise(resolve => {
    const steps = [
      { p: 10, t: '正在提取音频...' },
      { p: 25, t: '正在加载模型...' },
      { p: 40, t: '正在识别语音...' },
      { p: 60, t: '正在识别语音...' },
      { p: 75, t: '正在识别语音...' },
      { p: 85, t: '正在生成字幕...' },
      { p: 95, t: '正在优化结果...' },
      { p: 100, t: '完成！' },
    ]

    let i = 0
    const interval = duration / steps.length

    function next() {
      if (i < steps.length) {
        onProgress(steps[i].p, steps[i].t)
        i++
        setTimeout(next, interval)
      } else {
        resolve()
      }
    }
    next()
  })
}

/**
 * 可用字体列表（Mock，实际应从系统获取）
 */
export const MOCK_FONTS = [
  'Microsoft YaHei',
  'SimHei',
  'SimSun',
  'KaiTi',
  'FangSong',
  'Arial',
  'Times New Roman',
  'Consolas',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
]
