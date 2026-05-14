const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, globalShortcut, Notification, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── 持久化存储路径 ───────────────────────────────────────────
const userDataPath = app.getPath('userData')
const settingsPath = path.join(userDataPath, 'settings.json')
const recentFilesPath = path.join(userDataPath, 'recent-files.json')
const windowStatePath = path.join(userDataPath, 'window-state.json')

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ─── 应用设置 ─────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  autoLaunch: false,
  minimizeToTray: true,
  closeToTray: true,
  notifyOnComplete: true,
  notifyOnError: true,
  shortcuts: {
    openVideo: 'CommandOrControl+Shift+O',
    exportSrt: 'CommandOrControl+Shift+S',
    startRecognize: 'CommandOrControl+Shift+R',
    togglePause: 'CommandOrControl+Shift+Space',
  },
}

let appSettings = { ...DEFAULT_SETTINGS, ...readJson(settingsPath, {}) }

function saveSettings() {
  writeJson(settingsPath, appSettings)
}

// ─── 最近文件 ─────────────────────────────────────────────────
const MAX_RECENT = 10
let recentFiles = readJson(recentFilesPath, [])

function addRecentFile(fileInfo) {
  recentFiles = recentFiles.filter(f => f.path !== fileInfo.path)
  recentFiles.unshift({ ...fileInfo, openedAt: Date.now() })
  if (recentFiles.length > MAX_RECENT) recentFiles = recentFiles.slice(0, MAX_RECENT)
  writeJson(recentFilesPath, recentFiles)
}

// ─── 全局变量 ─────────────────────────────────────────────────
let mainWindow = null
let tray = null

// ─── 窗口状态 ─────────────────────────────────────────────────
function loadWindowState() {
  return readJson(windowStatePath, { width: 1280, height: 800, x: undefined, y: undefined, maximized: false })
}

function saveWindowState() {
  if (!mainWindow) return
  const bounds = mainWindow.getBounds()
  const maximized = mainWindow.isMaximized()
  writeJson(windowStatePath, { ...bounds, maximized })
}

// ─── 创建主窗口 ───────────────────────────────────────────────
function createWindow() {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
  })

  if (state.maximized) mainWindow.maximize()

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 记忆窗口状态
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)

  // 关闭时行为：最小化到托盘 或 真正关闭
  mainWindow.on('close', (e) => {
    if (appSettings.closeToTray && tray) {
      e.preventDefault()
      mainWindow.hide()
      if (appSettings.notifyOnComplete) {
        new Notification({ title: '视频字幕生成器', body: '程序已最小化到系统托盘，后台继续运行' }).show()
      }
    }
  })

  setupIPC()
  setupGlobalShortcuts()
}

// ─── 系统托盘 ─────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../../resources/icon.png')
  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) throw new Error('empty')
  } catch {
    // 回退：创建一个纯色小图标
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('视频字幕生成器')
  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    }
  })
}

function updateTrayMenu(isProcessing = false) {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    {
      label: isProcessing ? '处理中...' : '开始新任务',
      enabled: !isProcessing,
      click: () => {
        mainWindow?.show()
        mainWindow?.webContents.send('tray-new-task')
      }
    },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit() } },
  ])
  tray.setContextMenu(menu)
}

// ─── 全局快捷键 ───────────────────────────────────────────────
function setupGlobalShortcuts() {
  globalShortcut.unregisterAll()

  const shortcuts = appSettings.shortcuts

  const register = (key, action) => {
    try {
      globalShortcut.register(key, () => {
        mainWindow?.webContents.send('global-shortcut', action)
        if (!mainWindow?.isVisible()) mainWindow?.show()
      })
    } catch (e) {
      console.warn(`快捷键注册失败: ${key}`, e.message)
    }
  }

  if (shortcuts.openVideo) register(shortcuts.openVideo, 'open-video')
  if (shortcuts.exportSrt) register(shortcuts.exportSrt, 'export-srt')
  if (shortcuts.startRecognize) register(shortcuts.startRecognize, 'start-recognize')
}

// ─── IPC 处理 ─────────────────────────────────────────────────
function setupIPC() {
  // 窗口控制
  ipcMain.on('window-minimize', () => {
    if (appSettings.minimizeToTray && tray) {
      mainWindow?.hide()
    } else {
      mainWindow?.minimize()
    }
  })
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window-close', () => {
    if (appSettings.closeToTray && tray) {
      mainWindow?.hide()
    } else {
      mainWindow?.close()
    }
  })
  ipcMain.on('window-force-quit', () => { app.quit() })
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized())

  // 窗口置顶
  ipcMain.handle('window-set-on-top', (_, flag) => {
    mainWindow?.setAlwaysOnTop(flag)
    return flag
  })

  // 打开视频文件
  ipcMain.handle('open-video-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择视频文件',
      filters: [
        { name: '视频文件', extensions: ['mp4', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'webm'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const stat = fs.statSync(filePath)
      return { path: filePath, name: path.basename(filePath), size: stat.size }
    }
    return null
  })

  // 保存 SRT 文件
  ipcMain.handle('save-srt-dialog', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出字幕文件',
      defaultPath: 'subtitles.srt',
      filters: [{ name: '字幕文件', extensions: ['srt'] }],
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return result.filePath
    }
    return null
  })

  // 打开 JSON 文件（热词导入）
  ipcMain.handle('open-json-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入热词文件',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return fs.readFileSync(result.filePaths[0], 'utf-8')
    }
    return null
  })

  // 保存 JSON 文件（热词导出）
  ipcMain.handle('save-json-dialog', async (event, content, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出热词文件',
      defaultPath: defaultName || 'hotwords.json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    })
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return result.filePath
    }
    return null
  })

  // 在文件管理器中显示文件
  ipcMain.on('show-item-in-folder', (event, filePath) => {
    shell.showItemInFolder(filePath)
  })

  // 系统通知
  ipcMain.on('show-notification', (event, title, body) => {
    if (!appSettings.notifyOnComplete && !appSettings.notifyOnError) return
    new Notification({ title, body }).show()
  })

  // 最近文件
  ipcMain.on('add-recent-file', (event, fileInfo) => {
    addRecentFile(fileInfo)
  })
  ipcMain.handle('get-recent-files', () => recentFiles)
  ipcMain.on('clear-recent-files', () => {
    recentFiles = []
    writeJson(recentFilesPath, [])
  })

  // 设置读写
  ipcMain.handle('get-settings', () => appSettings)
  ipcMain.handle('save-settings', (event, newSettings) => {
    const needShortcutReload = JSON.stringify(appSettings.shortcuts) !== JSON.stringify(newSettings.shortcuts)
    appSettings = { ...DEFAULT_SETTINGS, ...newSettings }
    saveSettings()

    // 开机启动
    setAutoLaunch(appSettings.autoLaunch)

    // 重新注册快捷键
    if (needShortcutReload) setupGlobalShortcuts()

    return appSettings
  })

  // 托盘处理中状态
  ipcMain.on('tray-set-processing', (event, isProcessing) => {
    updateTrayMenu(isProcessing)
  })
}

// ─── 开机启动 ─────────────────────────────────────────────────
function setAutoLaunch(enable) {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: appSettings.minimizeToTray,
    args: ['--hidden'],
  })
}

// ─── 应用生命周期 ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()

  // 初始化开机启动状态
  setAutoLaunch(appSettings.autoLaunch)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
