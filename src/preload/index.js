const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 文件操作 ──────────────────────────────────────
  openVideoDialog: () => ipcRenderer.invoke('open-video-dialog'),
  saveSrtDialog: (content) => ipcRenderer.invoke('save-srt-dialog', content),
  openJsonDialog: () => ipcRenderer.invoke('open-json-dialog'),
  saveJsonDialog: (content, name) => ipcRenderer.invoke('save-json-dialog', content, name),
  showInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath),

  // ── 窗口控制 ──────────────────────────────────────
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowForceQuit: () => ipcRenderer.send('window-force-quit'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  windowSetOnTop: (flag) => ipcRenderer.invoke('window-set-on-top', flag),

  // ── 系统通知 ──────────────────────────────────────
  showNotification: (title, body) => ipcRenderer.send('show-notification', title, body),

  // ── 最近文件 ──────────────────────────────────────
  addRecentFile: (fileInfo) => ipcRenderer.send('add-recent-file', fileInfo),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  clearRecentFiles: () => ipcRenderer.send('clear-recent-files'),

  // ── 应用设置 ──────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ── 托盘状态 ──────────────────────────────────────
  traySetProcessing: (flag) => ipcRenderer.send('tray-set-processing', flag),

  // ── 全局快捷键回调 ────────────────────────────────
  onGlobalShortcut: (callback) => {
    ipcRenderer.on('global-shortcut', (event, action) => callback(action))
  },

  // ── 托盘事件回调 ──────────────────────────────────
  onTrayNewTask: (callback) => {
    ipcRenderer.on('tray-new-task', () => callback())
  },
})
