import { app, BrowserWindow, ipcMain, screen, nativeImage, clipboard, shell, protocol } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { fileWatcher, FileItem } from './fileWatcher'
import { clipboardWatcher } from './clipboardWatcher'
import Store from 'electron-store'

// 设置存储
const store = new Store({
  defaults: {
    theme: 'dark'
  }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  
  // 悬浮窗尺寸
  const windowWidth = 320
  const windowHeight = 550
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 280,
    minHeight: 400,
    maxWidth: 500,
    maxHeight: 800,
    x: screenWidth - windowWidth - 20, // 屏幕右侧
    y: Math.floor((screenHeight - windowHeight) / 2), // 垂直居中
    frame: false, // 无边框
    transparent: true, // 透明背景
    alwaysOnTop: true, // 始终置顶
    skipTaskbar: true, // 不显示在任务栏
    resizable: true, // 允许调整大小
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // 允许加载本地文件
    }
  })

  // 设置窗口级别，使其不抢占焦点
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setAlwaysOnTop(true, 'floating')

  // 加载渲染进程
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 初始化监听服务
function initWatchers(): void {
  // 文件监听回调
  fileWatcher.onFileAdded((file: FileItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('file-added', file)
    }
  })

  // 剪贴板监听回调
  clipboardWatcher.onImageCaptured((file: FileItem) => {
    if (mainWindow) {
      mainWindow.webContents.send('file-added', file)
    }
  })

  // 启动监听
  fileWatcher.start()
  clipboardWatcher.start()
}

// 创建默认拖拽图标 (必须是有效的图片，不能为空)
function createDefaultDragIcon(): Electron.NativeImage {
  // 创建一个 32x32 的蓝色方块作为默认图标
  const width = 32
  const height = 32
  const channels = 4 // RGBA
  const buffer = Buffer.alloc(width * height * channels)
  
  for (let i = 0; i < width * height; i++) {
    buffer[i * channels] = 99      // R
    buffer[i * channels + 1] = 102 // G
    buffer[i * channels + 2] = 241 // B
    buffer[i * channels + 3] = 255 // A
  }
  
  return nativeImage.createFromBuffer(buffer, { width, height })
}

// IPC 处理
function setupIPC(): void {
  // 开始拖拽文件 - 使用 webContents.startDrag
  ipcMain.on('start-drag', (event, filePath: string) => {
    console.log('[Drag] ========== 开始拖拽 ==========')
    console.log('[Drag] 文件路径:', filePath)
    
    try {
      // 检查文件是否存在
      const fs = require('fs')
      if (!fs.existsSync(filePath)) {
        console.error('[Drag] 文件不存在:', filePath)
        return
      }
      
      // 创建拖拽图标
      let icon: Electron.NativeImage
      
      // 尝试从图片文件创建图标
      const fileIcon = nativeImage.createFromPath(filePath)
      if (!fileIcon.isEmpty()) {
        const size = fileIcon.getSize()
        console.log('[Drag] 从文件创建图标成功, 尺寸:', size)
        // 确保图标不会太大
        if (size.width > 128 || size.height > 128) {
          icon = fileIcon.resize({ width: 64, height: 64 })
        } else {
          icon = fileIcon
        }
      } else {
        // 创建默认图标
        console.log('[Drag] 使用默认图标')
        icon = createDefaultDragIcon()
      }
      
      console.log('[Drag] 图标是否为空:', icon.isEmpty())
      console.log('[Drag] 图标尺寸:', icon.getSize())
      
      // 执行拖拽
      event.sender.startDrag({
        file: filePath,
        icon: icon
      })
      
      console.log('[Drag] startDrag 已调用')
      console.log('[Drag] ========== 拖拽完成 ==========')
    } catch (error) {
      console.error('[Drag] 拖拽出错:', error)
    }
  })

  // 复制文件到剪贴板
  ipcMain.handle('copy-file', async (_event, filePath: string) => {
    try {
      const image = nativeImage.createFromPath(filePath)
      if (!image.isEmpty()) {
        clipboard.writeImage(image)
        return { success: true }
      }
      return { success: false, error: '无法读取图片' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 使用系统默认程序打开文件
  ipcMain.handle('open-file', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 在 Finder 中显示文件
  ipcMain.handle('show-in-folder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 新建文件夹
  ipcMain.handle('create-folder', async (_event, folderName: string) => {
    try {
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const desktopPath = path.join(os.homedir(), 'Desktop')
      const folderPath = path.join(desktopPath, folderName)
      
      if (fs.existsSync(folderPath)) {
        return { success: false, error: '文件夹已存在' }
      }
      
      fs.mkdirSync(folderPath, { recursive: true })
      return { success: true, path: folderPath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 移动文件到文件夹
  ipcMain.handle('move-file', async (_event, filePath: string, targetFolder: string) => {
    try {
      const fs = require('fs')
      const path = require('path')
      const fileName = path.basename(filePath)
      const newPath = path.join(targetFolder, fileName)
      
      if (fs.existsSync(newPath)) {
        return { success: false, error: '目标文件夹中已存在同名文件' }
      }
      
      fs.renameSync(filePath, newPath)
      return { success: true, newPath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取桌面文件夹列表
  ipcMain.handle('get-folders', async () => {
    try {
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const desktopPath = path.join(os.homedir(), 'Desktop')
      
      const items = fs.readdirSync(desktopPath, { withFileTypes: true })
      const folders = items
        .filter((item: any) => item.isDirectory() && !item.name.startsWith('.'))
        .map((item: any) => ({
          name: item.name,
          path: path.join(desktopPath, item.name)
        }))
      
      return { success: true, folders }
    } catch (error) {
      return { success: false, error: String(error), folders: [] }
    }
  })

  // 重命名文件
  ipcMain.handle('rename-file', async (_event, oldPath: string, newName: string) => {
    try {
      const fs = require('fs')
      const path = require('path')
      const dir = path.dirname(oldPath)
      const ext = path.extname(oldPath)
      // 如果新名称没有扩展名，保留原扩展名
      const finalName = newName.includes('.') ? newName : newName + ext
      const newPath = path.join(dir, finalName)
      
      // 检查新文件名是否已存在
      if (fs.existsSync(newPath) && oldPath !== newPath) {
        return { success: false, error: '文件名已存在' }
      }
      
      fs.renameSync(oldPath, newPath)
      return { success: true, newPath, newName: finalName }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取文件的 base64 数据（用于预览）
  ipcMain.handle('get-file-thumbnail', async (_event, filePath: string) => {
    try {
      // 对于图片，使用 nativeImage 生成缩略图
      const image = nativeImage.createFromPath(filePath)
      if (!image.isEmpty()) {
        // 缩放到合适大小
        const resized = image.resize({ width: 200, height: 200, quality: 'good' })
        return { success: true, data: resized.toDataURL() }
      }
      return { success: false, error: '无法读取图片' }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 获取设置
  ipcMain.handle('get-settings', async () => {
    return {
      watchPath: fileWatcher.getWatchPath(),
      maxFiles: 50,
      clipboardEnabled: clipboardWatcher.isEnabled(),
      theme: store.get('theme', 'dark')
    }
  })

  // 更新设置
  ipcMain.handle('update-settings', async (_event, settings: {
    watchPath?: string
    clipboardEnabled?: boolean
    theme?: string
  }) => {
    if (settings.watchPath) {
      fileWatcher.setWatchPath(settings.watchPath)
    }
    if (typeof settings.clipboardEnabled === 'boolean') {
      if (settings.clipboardEnabled) {
        clipboardWatcher.start()
      } else {
        clipboardWatcher.stop()
      }
    }
    if (settings.theme) {
      store.set('theme', settings.theme)
    }
    return { success: true }
  })

  // 窗口控制
  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize()
  })

  ipcMain.on('close-window', () => {
    mainWindow?.hide()
  })
}

app.whenReady().then(() => {
  // 注册自定义协议，允许加载本地文件
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    callback({ path: filePath })
  })

  createWindow()
  setupIPC()
  initWatchers()
})

app.on('window-all-closed', () => {
  fileWatcher.stop()
  clipboardWatcher.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  } else {
    mainWindow.show()
  }
})


