import { contextBridge, ipcRenderer } from 'electron'

// 文件项接口
export interface FileItem {
  id: string
  path: string
  name: string
  type: 'image' | 'file'
  source: 'file' | 'clipboard'
  thumbnail: string
  createdAt: number
  size: number
}

// 设置接口
export interface Settings {
  watchPath: string
  maxFiles: number
  clipboardEnabled: boolean
}

// 暴露给渲染进程的 API
const electronAPI = {
  // 监听文件添加事件
  onFileAdded: (callback: (file: FileItem) => void) => {
    ipcRenderer.on('file-added', (_event, file: FileItem) => {
      callback(file)
    })
  },

  // 移除文件添加监听
  removeFileAddedListener: () => {
    ipcRenderer.removeAllListeners('file-added')
  },

  // 开始拖拽文件
  startDrag: (filePath: string) => {
    ipcRenderer.send('start-drag', filePath)
  },

  // 复制文件到剪贴板
  copyFile: (filePath: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('copy-file', filePath)
  },

  // 使用系统默认程序打开文件
  openFile: (filePath: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-file', filePath)
  },

  // 在 Finder 中显示文件
  showInFolder: (filePath: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('show-in-folder', filePath)
  },

  // 获取文件缩略图（base64）
  getFileThumbnail: (filePath: string): Promise<{ success: boolean; data?: string; error?: string }> => {
    return ipcRenderer.invoke('get-file-thumbnail', filePath)
  },

  // 新建文件夹
  createFolder: (folderName: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('create-folder', folderName)
  },

  // 移动文件到文件夹
  moveFile: (filePath: string, targetFolder: string): Promise<{ success: boolean; newPath?: string; error?: string }> => {
    return ipcRenderer.invoke('move-file', filePath, targetFolder)
  },

  // 获取桌面文件夹列表
  getFolders: (): Promise<{ success: boolean; folders: Array<{ name: string; path: string }>; error?: string }> => {
    return ipcRenderer.invoke('get-folders')
  },

  // 重命名文件
  renameFile: (oldPath: string, newName: string): Promise<{ success: boolean; newPath?: string; newName?: string; error?: string }> => {
    return ipcRenderer.invoke('rename-file', oldPath, newName)
  },

  // 获取设置
  getSettings: (): Promise<Settings> => {
    return ipcRenderer.invoke('get-settings')
  },

  // 更新设置
  updateSettings: (settings: Partial<Settings>): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke('update-settings', settings)
  },

  // 最小化窗口
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window')
  },

  // 关闭窗口
  closeWindow: () => {
    ipcRenderer.send('close-window')
  }
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// 类型声明
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}


