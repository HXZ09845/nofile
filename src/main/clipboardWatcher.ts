import { clipboard, nativeImage, app } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { FileItem } from './fileWatcher'

class ClipboardWatcher {
  private intervalId: NodeJS.Timeout | null = null
  private lastImageHash: string = ''
  private callback: ((file: FileItem) => void) | null = null
  private enabled: boolean = true
  private tempDir: string = ''

  constructor() {
    // tempDir 会在 start() 时初始化
  }

  // 初始化临时目录路径（需要在 app.whenReady 之后调用）
  private initTempDir(): void {
    if (!this.tempDir) {
      this.tempDir = join(app.getPath('temp'), 'filedock-clipboard')
    }
  }

  // 设置图片捕获回调
  onImageCaptured(callback: (file: FileItem) => void): void {
    this.callback = callback
  }

  // 是否启用
  isEnabled(): boolean {
    return this.enabled
  }

  // 确保临时目录存在
  private ensureTempDir(): void {
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true })
    }
  }

  // 计算图片哈希（简单版本，使用 dataURL 长度和部分内容）
  private getImageHash(image: Electron.NativeImage): string {
    if (image.isEmpty()) return ''
    const buffer = image.toPNG()
    // 使用 buffer 长度和前100字节作为简单哈希
    const prefix = buffer.slice(0, 100).toString('base64')
    return `${buffer.length}-${prefix}`
  }

  // 保存图片到临时文件
  private saveImageToTemp(image: Electron.NativeImage): string | null {
    try {
      this.ensureTempDir()
      const fileName = `clipboard-${Date.now()}-${uuidv4().slice(0, 8)}.png`
      const filePath = join(this.tempDir, fileName)
      const buffer = image.toPNG()
      writeFileSync(filePath, buffer)
      return filePath
    } catch (error) {
      console.error('[ClipboardWatcher] 保存图片失败:', error)
      return null
    }
  }

  // 检查剪贴板
  private checkClipboard(): void {
    try {
      const image = clipboard.readImage()
      
      if (image.isEmpty()) {
        return
      }

      const currentHash = this.getImageHash(image)
      
      // 如果是新图片
      if (currentHash !== this.lastImageHash) {
        this.lastImageHash = currentHash
        
        // 保存到临时文件
        const filePath = this.saveImageToTemp(image)
        if (!filePath) return

        const size = image.getSize()
        const fileItem: FileItem = {
          id: uuidv4(),
          path: filePath,
          name: `剪贴板图片 ${new Date().toLocaleTimeString()}`,
          type: 'image',
          source: 'clipboard',
          thumbnail: filePath,
          createdAt: Date.now(),
          size: size.width * size.height * 4 // 估算大小
        }

        console.log('[ClipboardWatcher] 捕获剪贴板图片:', fileItem.name)
        
        if (this.callback) {
          this.callback(fileItem)
        }
      }
    } catch (error) {
      console.error('[ClipboardWatcher] 检查剪贴板错误:', error)
    }
  }

  // 启动监听
  start(): void {
    if (this.intervalId) {
      this.stop()
    }

    // 确保 tempDir 已初始化
    this.initTempDir()

    this.enabled = true
    console.log('[ClipboardWatcher] 开始监听剪贴板')

    // 初始化当前剪贴板状态，避免启动时误触发
    const currentImage = clipboard.readImage()
    if (!currentImage.isEmpty()) {
      this.lastImageHash = this.getImageHash(currentImage)
    }

    // 每 500ms 检查一次剪贴板
    this.intervalId = setInterval(() => {
      this.checkClipboard()
    }, 500)
  }

  // 停止监听
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.enabled = false
    console.log('[ClipboardWatcher] 已停止监听')
  }
}

export const clipboardWatcher = new ClipboardWatcher()


