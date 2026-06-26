import React, { useState, useEffect } from 'react'

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

interface FileCardProps {
  file: FileItem
  viewMode: 'list' | 'grid' | 'compact'
  onDragStart: (file: FileItem) => void
  onDragEnd: () => void
  onCopy: (file: FileItem) => void
  onDelete: (fileId: string) => void
  onPreview: (file: FileItem) => void
  onOpen: (file: FileItem) => void
  onShowInFolder: (file: FileItem) => void
  onRename: (fileId: string, newPath: string, newName: string) => void
  onContextMenu: (e: React.MouseEvent, fileId: string) => void
  isInFolder?: boolean // 是否在文件夹内
  onMoveOut?: (fileId: string) => void // 移出文件夹
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function FileCard({ file, viewMode, onDragStart, onDragEnd, onCopy, onDelete, onPreview, onOpen, onShowInFolder, onRename, onContextMenu, isInFolder, onMoveOut }: FileCardProps) {
  const [thumbnailData, setThumbnailData] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(file.name)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 加载缩略图
  useEffect(() => {
    if (file.type === 'image') {
      window.electronAPI.getFileThumbnail(file.path).then(result => {
        if (result.success && result.data) {
          setThumbnailData(result.data)
        } else {
          setImageError(true)
        }
      }).catch(() => {
        setImageError(true)
      })
    }
  }, [file.path, file.type])

  // 双击预览文件
  const handleDoubleClick = () => {
    if (!isRenaming) {
      onPreview(file)
    }
  }

  // 开始重命名
  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNewName(file.name)
    setIsRenaming(true)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        // 选中文件名（不包括扩展名）
        const dotIndex = file.name.lastIndexOf('.')
        if (dotIndex > 0) {
          inputRef.current.setSelectionRange(0, dotIndex)
        } else {
          inputRef.current.select()
        }
      }
    }, 50)
  }

  // 确认重命名
  const confirmRename = async () => {
    if (newName.trim() && newName !== file.name) {
      const result = await window.electronAPI.renameFile(file.path, newName.trim())
      if (result.success && result.newPath && result.newName) {
        onRename(file.id, result.newPath, result.newName)
      }
    }
    setIsRenaming(false)
  }

  // 取消重命名
  const cancelRename = () => {
    setNewName(file.name)
    setIsRenaming(false)
  }

  // 处理重命名输入框按键
  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmRename()
    } else if (e.key === 'Escape') {
      cancelRename()
    }
  }

  // 处理拖拽
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    
    const startX = e.clientX
    const startY = e.clientY
    let hasMoved = false
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX)
      const deltaY = Math.abs(moveEvent.clientY - startY)
      
      if (!hasMoved && (deltaX > 5 || deltaY > 5)) {
        hasMoved = true
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        onDragStart(file)
      }
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      onDragEnd()
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // 渲染缩略图/预览
  const renderThumbnail = (size: 'small' | 'medium' | 'large' = 'medium') => {
    const showPlaceholder = () => (
      <div className={`thumbnail-placeholder ${size}`}>
        <span className="placeholder-icon">{getFileIcon(file.type)}</span>
      </div>
    )

    if (file.type === 'image' && thumbnailData && !imageError) {
      return <img src={thumbnailData} alt={file.name} draggable={false} />
    }
    if (file.type === 'video' && !videoError) {
      return (
        <video 
          src={`local-file://${encodeURIComponent(file.path)}`}
          muted
          preload="metadata"
          draggable={false}
          onError={() => setVideoError(true)}
          onLoadedMetadata={(e) => {
            const video = e.target as HTMLVideoElement
            video.currentTime = 1
          }}
        />
      )
    }
    return showPlaceholder()
  }

  const sourceClass = file.source === 'clipboard' ? 'from-clipboard' : file.source === 'drop' ? 'from-drop' : ''

  // ========== 网格视图 ==========
  if (viewMode === 'grid') {
    return (
      <div 
        className={`card-grid ${sourceClass}`}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleDragMouseDown}
        onContextMenu={(e) => onContextMenu(e, file.id)}
        title={`${file.name}\n${formatSize(file.size)}`}
      >
        <div className="card-grid-preview">
          {renderThumbnail('large')}
          <div className="card-grid-overlay">
            {isInFolder && onMoveOut && (
              <button onClick={(e) => { e.stopPropagation(); onMoveOut(file.id) }} title="移出文件夹">↩️</button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onOpen(file) }} title="打开">▶️</button>
            <button onClick={(e) => { e.stopPropagation(); onCopy(file) }} title="复制">📋</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(file.id) }} title="删除">✕</button>
          </div>
        </div>
        <div className="card-grid-info">
          <div className="card-grid-name">{file.name}</div>
          <div className="card-grid-meta">{formatSize(file.size)}</div>
        </div>
      </div>
    )
  }

  // ========== 紧凑视图 ==========
  if (viewMode === 'compact') {
    return (
      <div 
        className={`card-compact ${sourceClass}`}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleDragMouseDown}
        onContextMenu={(e) => onContextMenu(e, file.id)}
      >
        <div className="card-compact-preview">
          {renderThumbnail('small')}
        </div>
        <div className="card-compact-info">
          <div className="card-compact-name" title={file.name}>{file.name}</div>
          <div className="card-compact-meta">{formatSize(file.size)}</div>
        </div>
        <div className="card-compact-actions">
          {isInFolder && onMoveOut && (
            <button onClick={(e) => { e.stopPropagation(); onMoveOut(file.id) }}>↩️</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onOpen(file) }}>▶️</button>
          <button onClick={(e) => { e.stopPropagation(); onCopy(file) }}>📋</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(file.id) }}>✕</button>
        </div>
      </div>
    )
  }

  // ========== 列表视图（默认） ==========
  return (
    <div 
      className={`card-list ${sourceClass}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleDragMouseDown}
      onContextMenu={(e) => onContextMenu(e, file.id)}
    >
      <div className="card-list-preview">
        {renderThumbnail('medium')}
      </div>
      <div className="card-list-info">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            className="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={confirmRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="card-list-name" title={`${file.name}\n点击重命名`}>{file.name}</div>
        )}
        <div className="card-list-meta">
          <span className="meta-source">
            {file.source === 'clipboard' ? '📋' : file.source === 'drop' ? '📥' : '📁'}
          </span>
          <span>{formatSize(file.size)}</span>
        </div>
      </div>
      <div className="card-list-actions">
        {isInFolder && onMoveOut && (
          <button onClick={(e) => { e.stopPropagation(); onMoveOut(file.id) }} title="移出文件夹">↩️</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onOpen(file) }} title="打开">▶️</button>
        <button onClick={startRename} title="重命名">✏️</button>
        <button onClick={(e) => { e.stopPropagation(); onShowInFolder(file) }} title="定位">📂</button>
        <button onClick={(e) => { e.stopPropagation(); onCopy(file) }} title="复制">📋</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(file.id) }} title="删除">✕</button>
      </div>
    </div>
  )
}
