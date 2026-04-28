const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  openVideoDialog: () => ipcRenderer.invoke('open-video-dialog'),
  saveSrtDialog: (content) => ipcRenderer.invoke('save-srt-dialog', content),
  showInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
})
