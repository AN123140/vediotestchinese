const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    // win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 窗口控制
  ipcMain.on('window-minimize', () => win.minimize())
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window-close', () => win.close())

  // 打开视频文件
  ipcMain.handle('open-video-dialog', async () => {
    const result = await dialog.showOpenDialog(win, {
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
      return {
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
      }
    }
    return null
  })

  // 保存 SRT 文件
  ipcMain.handle('save-srt-dialog', async (event, content) => {
    const result = await dialog.showSaveDialog(win, {
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

  // 在文件管理器中显示文件
  ipcMain.on('show-item-in-folder', (event, filePath) => {
    shell.showItemInFolder(filePath)
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
