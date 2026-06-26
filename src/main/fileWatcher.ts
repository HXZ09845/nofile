import chokidar, { FSWatcher } from 'chokidar'
import { app } from 'electron'
import { join, extname, basename } from 'path'
import { statSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

// 文件项接口
export interface FileItem {
  id: string
  path: string
  name: string
  type: 'image' | 'video' | 'audio' | 'document' | 'file'
  source: 'file' | 'clipboard'
  thumbnail: string
  createdAt: number
  size: number
}

// 支持的图片格式
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.ico']

// 支持的视频格式
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv']

// 支持的音频格式
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma']

// 支持的文档格式
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.zip', '.rar', '.7z', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.sql', '.yaml', '.yml', '.ini', '.conf', '.log']

// 所有支持的格式
const ALL_SUPPORTED_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS
]

// 忽略的文件模式
const IGNORED_PATTERNS = [
  /^\./,           // 隐藏文件
  /\.tmp$/,        // 临时文件
  /\.crdownload$/, // Chrome 下载中
  /\.part$/,       // 下载中
  /~$/,            // 备份文件
  /^Icon\r$/,      // macOS 图标文件
]

class FileWatcher {
  private watcher: FSWatcher | null = null
  private watchPaths: string[] = []
  private callback: ((file: FileItem) => void) | null = null

  constructor() {
    // watchPaths 会在 start() 时初始化
  }

  // 初始化监听路径（需要在 app.whenReady 之后调用）
  private initWatchPaths(): void {
    if (this.watchPaths.length === 0) {
      const home = app.getPath('home')
      this.watchPaths = [
        join(home, 'Desktop'),    // 桌面
        join(home, 'Downloads')   // 下载文件夹
      ]
    }
  }

  // 设置文件添加回调
  onFileAdded(callback: (file: FileItem) => void): void {
    this.callback = callback
  }

  // 获取当前监听路径
  getWatchPath(): string {
    this.initWatchPaths()
    return this.watchPaths.join(', ')
  }

  // 获取所有监听路径
  getWatchPaths(): string[] {
    this.initWatchPaths()
    return this.watchPaths
  }

  // 设置监听路径
  setWatchPath(path: string): void {
    this.watchPaths = [path]
    // 重启监听
    if (this.watcher) {
      this.stop()
      this.start()
    }
  }

  // 添加监听路径
  addWatchPath(path: string): void {
    if (!this.watchPaths.includes(path)) {
      this.watchPaths.push(path)
      // 重启监听
      if (this.watcher) {
        this.stop()
        this.start()
      }
    }
  }

  // 检查是否应该忽略文件
  private shouldIgnore(filePath: string): boolean {
    const fileName = basename(filePath)
    return IGNORED_PATTERNS.some(pattern => pattern.test(fileName))
  }

  // 获取文件类型
  private getFileType(filePath: string): 'image' | 'video' | 'audio' | 'document' | 'file' {
    const ext = extname(filePath).toLowerCase()
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
    if (DOCUMENT_EXTENSIONS.includes(ext)) return 'document'
    return 'file'
  }

  // 检查是否为支持的文件类型
  private isSupportedFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase()
    return ALL_SUPPORTED_EXTENSIONS.includes(ext)
  }

  // 创建文件项
  private createFileItem(filePath: string): FileItem | null {
    try {
      const stats = statSync(filePath)
      if (!stats.isFile()) return null

      const fileName = basename(filePath)
      const fileType = this.getFileType(filePath)

      return {
        id: uuidv4(),
        path: filePath,
        name: fileName,
        type: fileType,
        source: 'file',
        thumbnail: filePath, // 图片直接使用原路径作为缩略图
        createdAt: stats.birthtimeMs || Date.now(),
        size: stats.size
      }
    } catch {
      return null
    }
  }

  // 启动监听
  start(): void {
    if (this.watcher) {
      this.stop()
    }

    // 确保 watchPaths 已初始化
    this.initWatchPaths()

    console.log(`[FileWatcher] 开始监听: ${this.watchPaths.join(', ')}`)

    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true, // 忽略初始扫描
      depth: 0, // 只监听顶层目录
      usePolling: true, // 使用轮询模式，在 macOS 上更稳定
      interval: 300, // 轮询间隔
      awaitWriteFinish: {
        stabilityThreshold: 1000, // 等待文件写入完成
        pollInterval: 200
      }
    })

    // 监听 ready 事件，确认监听已启动
    this.watcher.on('ready', () => {
      console.log(`[FileWatcher] 监听器已就绪，正在监听: ${this.watchPaths.join(', ')}`)
    })

    // 监听所有事件用于调试
    this.watcher.on('all', (event: string, filePath: string) => {
      console.log(`[FileWatcher] 事件: ${event}, 路径: ${filePath}`)
    })

    this.watcher.on('add', (filePath: string) => {
      console.log(`[FileWatcher] 检测到新文件 (add 事件): ${filePath}`)
      
      if (this.shouldIgnore(filePath)) {
        console.log(`[FileWatcher] 忽略文件 (临时/隐藏): ${filePath}`)
        return
      }

      if (!this.isSupportedFile(filePath)) {
        console.log(`[FileWatcher] 忽略文件 (不支持的类型): ${filePath}`)
        return
      }

      const fileItem = this.createFileItem(filePath)
      if (fileItem && this.callback) {
        console.log(`[FileWatcher] 添加文件: ${fileItem.name} (类型: ${fileItem.type})`)
        this.callback(fileItem)
      }
    })

    this.watcher.on('error', (error: Error) => {
      console.error('[FileWatcher] 错误:', error)
    })
  }

  // 停止监听
  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
      console.log('[FileWatcher] 已停止监听')
    }
  }
}

export const fileWatcher = new FileWatcher()


