import React, { useEffect, useState } from 'react'

interface FileItem {
  id: string
  path: string
  name: string
  type: 'image' | 'video' | 'audio' | 'document' | 'file'
  source: 'file' | 'clipboard' | 'drop'
  thumbnail: string
  createdAt: number
  size: number
}

interface PreviewProps {
  file: FileItem
  onClose: () => void
  onOpen: () => void
}

// 根据文件类型获取图标
function getFileIcon(type: string): string {
  switch (type) {
    case 'image': return '🖼️'
    case 'video': return '🎬'
    case 'audio': return '🎵'
    case 'document': return '📄'
    default: return '📁'
  }
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function Preview({ file, onClose, onOpen }: PreviewProps) {
  const [imageError, setImageError] = useState(false)

  // ESC 键关闭预览
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter') {
        onOpen()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onOpen])

  // 渲染预览内容
  const renderPreviewContent = () => {
    switch (file.type) {
      case 'image':
        if (imageError) {
          return (
            <div className="preview-placeholder">
              <div className="preview-icon">🖼️</div>
              <div className="preview-error">无法加载图片</div>
            </div>
          )
        }
        return (
          <img 
            src={`file://${file.path}`} 
            alt={file.name}
            onError={() => setImageError(true)}
          />
        )

      case 'video':
        return (
          <video 
            src={`file://${file.path}`}
            controls
            autoPlay={false}
            style={{ maxWidth: '100%', maxHeight: '70vh' }}
          >
            您的浏览器不支持视频播放
          </video>
        )

      case 'audio':
        return (
          <div className="preview-audio">
            <div className="preview-icon large">🎵</div>
            <div className="preview-audio-name">{file.name}</div>
            <audio 
              src={`file://${file.path}`}
              controls
              style={{ width: '100%', marginTop: '20px' }}
            >
              您的浏览器不支持音频播放
            </audio>
          </div>
        )

      case 'document':
        // PDF 可以使用 iframe 或 embed 预览
        if (file.name.toLowerCase().endsWith('.pdf')) {
          return (
            <embed
              src={`file://${file.path}`}
              type="application/pdf"
              width="100%"
              height="500px"
              style={{ borderRadius: '8px' }}
            />
          )
        }
        // 其他文档显示图标
        return (
          <div className="preview-placeholder">
            <div className="preview-icon large">{getFileIcon(file.type)}</div>
            <div className="preview-filename">{file.name}</div>
            <div className="preview-hint">双击或按 Enter 打开文件</div>
          </div>
        )

      default:
        return (
          <div className="preview-placeholder">
            <div className="preview-icon large">{getFileIcon(file.type)}</div>
            <div className="preview-filename">{file.name}</div>
            <div className="preview-hint">双击或按 Enter 打开文件</div>
          </div>
        )
    }
  }

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-container" onClick={e => e.stopPropagation()}>
        {/* 预览头部 */}
        <div className="preview-header">
          <div className="preview-title">
            <span className="preview-title-icon">{getFileIcon(file.type)}</span>
            <span className="preview-title-name" title={file.name}>{file.name}</span>
          </div>
          <button className="preview-close" onClick={onClose}>✕</button>
        </div>

        {/* 预览内容 */}
        <div className="preview-content" onDoubleClick={onOpen}>
          {renderPreviewContent()}
        </div>

        {/* 预览底部信息 */}
        <div className="preview-footer">
          <div className="preview-meta">
            <span>{formatSize(file.size)}</span>
            <span>•</span>
            <span>{file.type === 'image' ? '图片' : file.type === 'video' ? '视频' : file.type === 'audio' ? '音频' : '文档'}</span>
            <span>•</span>
            <span>{new Date(file.createdAt).toLocaleString()}</span>
          </div>
          <div className="preview-actions">
            <button className="preview-btn" onClick={onOpen}>
              ▶️ 打开
            </button>
            <button className="preview-btn secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
