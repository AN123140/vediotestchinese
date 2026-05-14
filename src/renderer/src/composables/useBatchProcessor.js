import { ref, computed } from 'vue'
import { useAppStore } from './useAppStore.js'

const BACKEND_URL = 'http://127.0.0.1:8081'

export function useBatchProcessor() {
  const { store, notify } = useAppStore()

  const isProcessing = computed(() => store.batchState === 'processing')
  const isPaused = computed(() => store.batchState === 'paused')

  // 添加文件（保存原始 File 对象用于后续上传）
  function addFiles(files) {
    const videoExts = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm']
    for (const file of files) {
      const ext = '.' + (file.name?.split('.').pop() || '').toLowerCase()
      if (!videoExts.includes(ext)) continue
      // Electron 环境：file 是 { path, name, size }
      // 浏览器环境：file 是 File 对象（有 name, size, arrayBuffer）
      const isElectron = !!(window.electronAPI && file.path)
      store.batchTasks.push({
        id: Date.now() + Math.random(),
        name: file.name,
        size: file.size || 0,
        filePath: isElectron ? file.path : '',
        fileRef: isElectron ? null : file, // 浏览器模式保留 File 引用
        duration: 0,
        status: 'pending',
        progress: 0,
        outputPath: '',
        error: null,
        subtitles: [],
      })
    }
    // 获取视频时长（异步，不阻塞）
    if (files.length > 0) fetchDurations()
  }

  // 异步获取视频时长
  async function fetchDurations() {
    for (const task of store.batchTasks) {
      if (task.duration > 0) continue
      if (task.fileRef instanceof File) {
        try {
          const url = URL.createObjectURL(task.fileRef)
          const dur = await getVideoDuration(url)
          if (dur > 0) task.duration = Math.round(dur)
          URL.revokeObjectURL(url)
        } catch { /* ignore */ }
      } else if (task.filePath) {
        try {
          const dur = await getVideoDuration(task.filePath)
          if (dur > 0) task.duration = Math.round(dur)
        } catch { /* ignore */ }
      }
    }
  }

  function getVideoDuration(src) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(video.duration)
        video.remove()
      }
      video.onerror = () => {
        reject(new Error('无法加载视频'))
        video.remove()
      }
      video.src = src
    })
  }

  // 后端健康检查
  async function checkBackendHealth() {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(5000) })
      return resp.ok
    } catch {
      return false
    }
  }

  // 调用真实后端识别单个文件
  async function recognizeTask(task, signal) {
    // Electron 环境：通过文件路径调用
    if (window.electronAPI && task.filePath) {
      const resp = await fetch(`${BACKEND_URL}/api/recognize/path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: task.filePath,
          model_size: store.batchModel || 'large-v3',
          language: store.batchLanguage || 'zh',
        }),
        signal,
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `服务器错误: ${resp.status}`)
      }
      return await resp.json()
    }

    // 浏览器环境：通过 FormData 上传
    if (task.fileRef) {
      const formData = new FormData()
      formData.append('file', task.fileRef, task.name)
      formData.append('model_size', store.batchModel || 'large-v3')
      formData.append('language', store.batchLanguage || 'zh')

      const resp = await fetch(`${BACKEND_URL}/api/recognize`, {
        method: 'POST',
        body: formData,
        signal,
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.detail || `服务器错误: ${resp.status}`)
      }
      return await resp.json()
    }

    throw new Error('无有效文件数据')
  }

  // 开始批量处理
  async function startBatch() {
    if (isProcessing.value) return
    const pending = store.batchTasks.filter(t => t.status === 'pending' || t.status === 'failed')
    if (pending.length === 0) {
      notify('info', '没有待处理的任务')
      return
    }

    // 检查后端服务
    notify('info', '检查识别服务状态...')
    const healthy = await checkBackendHealth()
    if (!healthy) {
      notify('error', '识别服务不可用，请确认已运行：python backend/start_backend.py')
      return
    }

    store.batchState = 'processing'
    store.batchTasks.forEach(t => {
      if (t.status === 'pending' || t.status === 'failed') {
        t.status = 'waiting'
        t.progress = 0
        t.error = null
      }
    })

    const controller = new AbortController()

    for (const task of store.batchTasks) {
      if (task.status !== 'waiting') continue
      if (store.batchState === 'idle') break

      // 等待取消/暂停
      while (store.batchState === 'paused') {
        await new Promise(r => setTimeout(r, 200))
        if (store.batchState === 'idle') return
      }

      task.status = 'processing'
      task.progress = 10

      try {
        const result = await recognizeTask(task, controller.signal)

        if (result.success && result.subtitles?.length > 0) {
          task.status = 'completed'
          task.progress = 100
          task.subtitles = result.subtitles.map((s, i) => ({
            id: s.id || i + 1,
            start: s.start,
            end: s.end,
            text: s.text,
          }))
        } else {
          task.status = 'failed'
          task.error = result.detail || '识别结果为空'
        }
      } catch (e) {
        if (e.name === 'AbortError' || store.batchState === 'idle') {
          task.status = 'pending'
          task.progress = 0
          break
        }
        task.status = 'failed'
        task.error = classifyBatchError(e)
      }
    }

    store.batchState = 'idle'
    const completed = store.batchTasks.filter(t => t.status === 'completed').length
    const failed = store.batchTasks.filter(t => t.status === 'failed').length
    if (failed === 0) {
      notify('success', `批量处理完成！共 ${completed} 个文件`)
    } else {
      notify('warning', `批量处理完成：成功 ${completed} 个，失败 ${failed} 个`)
    }
  }

  // 错误分类
  function classifyBatchError(e) {
    const msg = String(e.message || '')
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_CONNECTION_REFUSED'))
      return '识别服务连接中断'
    if (msg.includes('服务器错误'))
      return msg
    return msg || '未知错误'
  }

  // 移除任务
  function removeTask(taskId) {
    const idx = store.batchTasks.findIndex(t => t.id === taskId)
    if (idx !== -1 && store.batchTasks[idx].status !== 'processing') {
      store.batchTasks.splice(idx, 1)
    }
  }

  // 清空所有任务
  function clearAll() {
    if (isProcessing.value) return
    store.batchTasks = []
  }

  // 上移
  function moveUp(taskId) {
    const idx = store.batchTasks.findIndex(t => t.id === taskId)
    if (idx > 0) {
      const temp = store.batchTasks[idx]
      store.batchTasks[idx] = store.batchTasks[idx - 1]
      store.batchTasks[idx - 1] = temp
    }
  }

  // 下移
  function moveDown(taskId) {
    const idx = store.batchTasks.findIndex(t => t.id === taskId)
    if (idx < store.batchTasks.length - 1) {
      const temp = store.batchTasks[idx]
      store.batchTasks[idx] = store.batchTasks[idx + 1]
      store.batchTasks[idx + 1] = temp
    }
  }

  // 暂停
  function pauseBatch() {
    if (store.batchState === 'processing') {
      store.batchState = 'paused'
      notify('info', '批量处理已暂停')
    }
  }

  // 恢复
  function resumeBatch() {
    if (store.batchState === 'paused') {
      store.batchState = 'processing'
      notify('info', '批量处理已恢复')
    }
  }

  // 取消
  function cancelBatch() {
    store.batchState = 'idle'
    store.batchTasks.forEach(t => {
      if (t.status === 'processing' || t.status === 'waiting') {
        t.status = 'pending'
        t.progress = 0
      }
    })
    notify('info', '批量处理已取消')
  }

  // 统计
  const stats = computed(() => {
    const total = store.batchTasks.length
    const completed = store.batchTasks.filter(t => t.status === 'completed').length
    const failed = store.batchTasks.filter(t => t.status === 'failed').length
    const processing = store.batchTasks.filter(t => t.status === 'processing').length
    const pending = total - completed - failed - processing
    return { total, completed, failed, processing, pending }
  })

  const totalProgress = computed(() => {
    if (stats.value.total === 0) return 0
    const done = stats.value.completed * 100 + stats.value.failed * 100
    const inProgress = store.batchTasks.reduce((sum, t) => {
      return sum + (t.status === 'processing' ? t.progress : 0)
    }, 0)
    return Math.round((done + inProgress) / (stats.value.total * 100) * 100)
  })

  // 导出处理报告
  function generateReport() {
    const lines = ['批量处理报告', '=' .repeat(40), '']
    lines.push(`生成时间: ${new Date().toLocaleString()}`)
    lines.push(`总任务数: ${stats.value.total}`)
    lines.push(`成功: ${stats.value.completed}`)
    lines.push(`失败: ${stats.value.failed}`)
    lines.push('')
    lines.push('详细列表:')
    lines.push('-'.repeat(60))
    store.batchTasks.forEach((t, i) => {
      const statusMap = { completed: '成功', failed: '失败', pending: '待处理', processing: '处理中', waiting: '等待中' }
      lines.push(`${i + 1}. ${t.name}`)
      lines.push(`   状态: ${statusMap[t.status] || t.status}`)
      if (t.subtitles.length > 0) lines.push(`   字幕数: ${t.subtitles.length} 条`)
      if (t.error) lines.push(`   错误: ${t.error}`)
      lines.push('')
    })
    return lines.join('\n')
  }

  return {
    addFiles,
    removeTask,
    clearAll,
    moveUp,
    moveDown,
    startBatch,
    pauseBatch,
    resumeBatch,
    cancelBatch,
    generateReport,
    stats,
    totalProgress,
    isProcessing,
    isPaused,
  }
}
