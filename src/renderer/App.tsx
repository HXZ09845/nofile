import React, { useState, useEffect, useCallback } from 'react'
import { FileCard } from './components/FileCard'
import { Settings } from './components/Settings'
import { Preview } from './components/Preview'
import { DropZone } from './components/DropZone'
import { ContextMenu } from './components/ContextMenu'
import logoImg from './assets/logo.png'

// 虚拟文件夹（工具内部使用）
interface VirtualFolder {
  id: string
  name: string
  createdAt: number
}

// 文件项接口
interface FileItem {
  id: string
  path: string
  name: string
  type: 'image' | 'video' | 'audio' | 'document' | 'file'
  source: 'file' | 'clipboard' | 'drop'
  thumbnail: string
  createdAt: number
  size: number
  folderId?: string // 所属文件夹ID（可选）
}

// 根据文件扩展名判断类型
function getFileTypeFromName(fileName: string): 'image' | 'video' | 'audio' | 'document' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'svg', 'ico']
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv']
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'zip', 'rar', '7z']
  
  if (imageExts.includes(ext)) return 'image'
  if (videoExts.includes(ext)) return 'video'
  if (audioExts.includes(ext)) return 'audio'
  if (docExts.includes(ext)) return 'document'
  return 'file'
}

// 最大保留文件数
const MAX_FILES = 100

function App() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isDraggingInternal, setIsDraggingInternal] = useState(false) // 标记是否正在从内部拖拽
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list') // 视图模式
  const [deletedFiles, setDeletedFiles] = useState<FileItem[]>([]) // 已删除文件（用于撤回）
  const [showUndo, setShowUndo] = useState(false) // 显示撤回提示
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string; folderId?: string } | null>(null)
  const [virtualFolders, setVirtualFolders] = useState<VirtualFolder[]>([]) // 虚拟文件夹列表
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFileForMove, setSelectedFileForMove] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null) // 当前所在文件夹
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null) // 正在拖拽的文件ID
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null) // 拖拽目标文件夹

  // 显示 Toast 通知
  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 应用启动时加载并应用保存的主题
  useEffect(() => {
    window.electronAPI.getSettings().then((settings: any) => {
      if (settings?.theme) {
        document.documentElement.setAttribute('data-theme', settings.theme)
      }
    }).catch(() => {
      // 忽略错误，使用默认主题
    })
  }, [])

  // 监听文件添加事件
  useEffect(() => {
    window.electronAPI.onFileAdded((file: FileItem) => {
      setFiles(prev => {
        // 添加到列表开头
        const newFiles = [file, ...prev]
        // 限制最大数量
        if (newFiles.length > MAX_FILES) {
          return newFiles.slice(0, MAX_FILES)
        }
        return newFiles
      })
    })

    return () => {
      window.electronAPI.removeFileAddedListener()
    }
  }, [])

  // 监听键盘快捷键 (Cmd+Z / Ctrl+Z 撤回)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (deletedFiles.length > 0) {
          const [lastDeleted, ...rest] = deletedFiles
          setFiles(prev => [lastDeleted, ...prev])
          setDeletedFiles(rest)
          showToast('已撤回删除')
          if (rest.length === 0) {
            setShowUndo(false)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deletedFiles, showToast])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, fileId: string) => {
    e.preventDefault()
    setSelectedFileForMove(fileId)
    setContextMenu({ x: e.clientX, y: e.clientY, fileId })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setSelectedFileForMove(null)
  }, [])

  // 新建虚拟文件夹
  const handleCreateFolder = useCallback(() => {
    closeContextMenu()
    setNewFolderName('')
    setShowFolderDialog(true)
  }, [closeContextMenu])

  const confirmCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) {
      showToast('请输入文件夹名称')
      return
    }
    // 检查是否已存在同名文件夹
    if (virtualFolders.some(f => f.name === newFolderName.trim())) {
      showToast('文件夹名称已存在')
      return
    }
    // 创建虚拟文件夹
    const newFolder: VirtualFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newFolderName.trim(),
      createdAt: Date.now()
    }
    setVirtualFolders(prev => [...prev, newFolder])
    showToast(`已创建文件夹: ${newFolderName}`)
    setShowFolderDialog(false)
    setNewFolderName('')
  }, [newFolderName, showToast, virtualFolders])

  // 移动文件到虚拟文件夹
  const handleMoveToFolder = useCallback((folderId: string) => {
    if (!selectedFileForMove) return
    
    if (folderId === '') {
      // 移出到根目录
      setFiles(prev => prev.map(f => 
        f.id === selectedFileForMove ? { ...f, folderId: undefined } : f
      ))
      showToast('已移动到根目录')
    } else {
      const folder = virtualFolders.find(f => f.id === folderId)
      if (!folder) return

      // 更新文件的 folderId
      setFiles(prev => prev.map(f => 
        f.id === selectedFileForMove ? { ...f, folderId } : f
      ))
      showToast(`已移动到: ${folder.name}`)
    }
    closeContextMenu()
  }, [selectedFileForMove, virtualFolders, showToast, closeContextMenu])

  // 进入文件夹
  const enterFolder = useCallback((folderId: string) => {
    setCurrentFolderId(folderId)
  }, [])

  // 返回上级（根目录）
  const goBack = useCallback(() => {
    setCurrentFolderId(null)
  }, [])

  // 删除虚拟文件夹
  const deleteFolder = useCallback((folderId: string) => {
    // 将文件夹内的文件移回根目录
    setFiles(prev => prev.map(f => 
      f.folderId === folderId ? { ...f, folderId: undefined } : f
    ))
    setVirtualFolders(prev => prev.filter(f => f.id !== folderId))
    if (currentFolderId === folderId) {
      setCurrentFolderId(null)
    }
    showToast('文件夹已删除')
  }, [currentFolderId, showToast])

  // 获取当前显示的文件（根据当前文件夹过滤）
  const displayedFiles = currentFolderId 
    ? files.filter(f => f.folderId === currentFolderId)
    : files.filter(f => !f.folderId)

  // 获取当前文件夹信息
  const currentFolder = currentFolderId 
    ? virtualFolders.find(f => f.id === currentFolderId) 
    : null

  // 处理拖拽开始（从暂存栏拖出文件）
  const handleDragStart = useCallback((file: FileItem) => {
    console.log('[App] 拖拽开始:', file.name, file.path)
    setIsDraggingInternal(true)
    setDraggedFileId(file.id)
    // 调用 Electron 原生拖拽 API
    window.electronAPI.startDrag(file.path)
  }, [])

  // 处理文件拖拽到文件夹
  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedFileId) {
      setDropTargetFolderId(folderId)
    }
  }, [draggedFileId])

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetFolderId(null)
  }, [])

  const handleFolderDrop = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetFolderId(null)
    
    if (draggedFileId) {
      // 移动文件到目标文件夹
      const folder = virtualFolders.find(f => f.id === folderId)
      setFiles(prev => prev.map(f => 
        f.id === draggedFileId ? { ...f, folderId } : f
      ))
      if (folder) {
        showToast(`已移动到: ${folder.name}`)
      }
      setDraggedFileId(null)
    }
  }, [draggedFileId, virtualFolders, showToast])

  // 处理拖拽结束（从暂存栏拖出文件结束）
  const handleDragEnd = useCallback(() => {
    console.log('[App] 拖拽结束')
    setIsDraggingInternal(false)
    setDraggedFileId(null)
    setDropTargetFolderId(null)
  }, [])

  // 处理复制
  const handleCopy = useCallback(async (file: FileItem) => {
    const result = await window.electronAPI.copyFile(file.path)
    if (result.success) {
      showToast('已复制到剪贴板')
    } else {
      showToast('复制失败: ' + result.error)
    }
  }, [showToast])

  // 处理删除（支持撤回）
  const handleDelete = useCallback((fileId: string) => {
    setFiles(prev => {
      const fileToDelete = prev.find(f => f.id === fileId)
      if (fileToDelete) {
        // 保存到已删除列表
        setDeletedFiles(deleted => [fileToDelete, ...deleted].slice(0, 10)) // 最多保留10个
        setShowUndo(true)
        // 5秒后隐藏撤回提示
        setTimeout(() => setShowUndo(false), 5000)
      }
      return prev.filter(f => f.id !== fileId)
    })
  }, [])

  // 撤回删除
  const handleUndo = useCallback(() => {
    if (deletedFiles.length > 0) {
      const [lastDeleted, ...rest] = deletedFiles
      setFiles(prev => [lastDeleted, ...prev])
      setDeletedFiles(rest)
      showToast('已撤回删除')
      if (rest.length === 0) {
        setShowUndo(false)
      }
    }
  }, [deletedFiles, showToast])

  // 移出文件夹
  const handleMoveOutOfFolder = useCallback((fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, folderId: undefined } : f
    ))
    showToast('已移出文件夹')
  }, [showToast])

  // 处理预览（所有文件都可以预览）
  const handlePreview = useCallback((file: FileItem) => {
    setPreviewFile(file)
  }, [])

  // 处理重命名
  const handleRename = useCallback((fileId: string, newPath: string, newName: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, path: newPath, name: newName, thumbnail: newPath }
      }
      return f
    }))
    showToast('重命名成功')
  }, [showToast])

  // 打开文件（使用系统默认程序）
  const handleOpen = useCallback(async (file: FileItem) => {
    const result = await window.electronAPI.openFile(file.path)
    if (!result.success) {
      showToast('打开失败: ' + result.error)
    }
  }, [showToast])

  // 在 Finder 中显示
  const handleShowInFolder = useCallback(async (file: FileItem) => {
    await window.electronAPI.showInFolder(file.path)
  }, [])

  // 清空所有文件
  const handleClearAll = useCallback(() => {
    setFiles([])
    showToast('已清空暂存区')
  }, [showToast])

  // 处理文件拖入
  const handleFileDrop = useCallback((droppedFiles: FileItem[]) => {
    setFiles(prev => {
      const newFiles = [...droppedFiles, ...prev]
      if (newFiles.length > MAX_FILES) {
        return newFiles.slice(0, MAX_FILES)
      }
      return newFiles
    })
    showToast(`已添加 ${droppedFiles.length} 个文件`)
  }, [showToast])

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有外部拖入的文件才显示高亮，内部拖拽不显示
    if (e.dataTransfer.types.includes('Files') && !isDraggingInternal) {
      setIsDragOver(true)
    }
  }, [isDraggingInternal])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 只有当离开整个容器时才取消高亮
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    // 如果是内部拖拽（从暂存栏拖出），忽略 drop 事件
    if (isDraggingInternal) {
      return
    }

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length === 0) return

    // 转换为 FileItem
    const fileItems: FileItem[] = droppedFiles.map(file => {
      const fileType = getFileTypeFromName(file.name)
      return {
        id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        path: (file as any).path || '', // Electron 会提供 path 属性
        name: file.name,
        type: fileType,
        source: 'drop' as const,
        thumbnail: (file as any).path || '',
        createdAt: Date.now(),
        size: file.size
      }
    }).filter(f => f.path) // 过滤掉没有路径的文件

    // 过滤掉已存在的文件（根据路径判断）
    const existingPaths = new Set(files.map(f => f.path))
    const newFileItems = fileItems.filter(f => !existingPaths.has(f.path))

    if (newFileItems.length > 0) {
      handleFileDrop(newFileItems)
    }
  }, [handleFileDrop, isDraggingInternal, files])

  // 空白区域右键菜单（只显示新建文件夹）
  const handleContainerContextMenu = useCallback((e: React.MouseEvent) => {
    // 检查是否点击在文件卡片上（如果是则由 FileCard 处理）
    const target = e.target as HTMLElement
    if (target.closest('.card-list') || target.closest('.card-grid') || target.closest('.card-compact')) {
      return // 让 FileCard 的右键菜单处理
    }
    
    e.preventDefault()
    setSelectedFileForMove(null) // 没有选中的文件
    setContextMenu({ x: e.clientX, y: e.clientY, fileId: '' })
  }, [])

  return (
    <div 
      className={`dock-container ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleContainerContextMenu}
    >
      {/* 标题栏 */}
      <div className="dock-header">
        <div className="dock-title">
          <img src={logoImg} alt="NoFile" className="dock-logo" />
          <span>NoFile</span>
        </div>
        <div className="dock-controls">
          <button 
            className="dock-control-btn minimize"
            onClick={() => window.electronAPI.minimizeWindow()}
            title="最小化"
          />
          <button 
            className="dock-control-btn close"
            onClick={() => window.electronAPI.closeWindow()}
            title="隐藏"
          />
        </div>
      </div>

      {/* 拖拽提示遮罩 */}
      {isDragOver && <DropZone />}

      {/* 视图切换按钮 */}
      <div className="view-switcher">
        <button 
          className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          title="列表视图"
        >
          ☰
        </button>
        <button 
          className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode('grid')}
          title="网格视图"
        >
          ▦
        </button>
        <button 
          className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
          onClick={() => setViewMode('compact')}
          title="紧凑视图"
        >
          ≡
        </button>
      </div>

      {/* 文件夹导航栏 */}
      {currentFolder && (
        <div className="folder-nav">
          <button className="folder-back-btn" onClick={goBack} title="返回">
            ← 返回
          </button>
          <span className="folder-current-name">📁 {currentFolder.name}</span>
          <button 
            className="folder-delete-btn" 
            onClick={() => deleteFolder(currentFolder.id)}
            title="删除文件夹"
          >
            🗑️
          </button>
        </div>
      )}

      {/* 文件列表 */}
      <div className={`dock-content view-${viewMode}`}>
        {/* 显示虚拟文件夹（仅在根目录时） */}
        {!currentFolderId && virtualFolders.map(folder => (
          <div 
            key={folder.id}
            className={`virtual-folder-card ${dropTargetFolderId === folder.id ? 'drop-target' : ''}`}
            onDoubleClick={() => enterFolder(folder.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation() // 阻止冒泡到容器
              setSelectedFileForMove(null)
              setContextMenu({ x: e.clientX, y: e.clientY, fileId: '', folderId: folder.id })
            }}
            onDragOver={(e) => handleFolderDragOver(e, folder.id)}
            onDragLeave={handleFolderDragLeave}
            onDrop={(e) => handleFolderDrop(e, folder.id)}
          >
            <div className="folder-icon">{dropTargetFolderId === folder.id ? '📂' : '📁'}</div>
            <div className="folder-name">{folder.name}</div>
            <div className="folder-count">
              {files.filter(f => f.folderId === folder.id).length} 个文件
            </div>
          </div>
        ))}

        {/* 显示文件 */}
        {displayedFiles.length === 0 && virtualFolders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-title">暂无文件</div>
            <div className="empty-desc">
              截图会自动出现在这里<br />
              也可以<strong>拖拽文件</strong>到此处<br />
              <strong>右键</strong>可新建文件夹
            </div>
          </div>
        ) : displayedFiles.length === 0 && currentFolderId ? (
          <div className="empty-state">
            <div className="empty-icon">📂</div>
            <div className="empty-title">文件夹为空</div>
            <div className="empty-desc">
              右键文件选择"移动到文件夹"<br />
              将文件移入此处
            </div>
          </div>
        ) : (
          displayedFiles.map(file => (
            <FileCard
              key={file.id}
              file={file}
              viewMode={viewMode}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onOpen={handleOpen}
              onShowInFolder={handleShowInFolder}
              onRename={handleRename}
              onContextMenu={handleContextMenu}
              isInFolder={!!currentFolderId}
              onMoveOut={handleMoveOutOfFolder}
            />
          ))
        )}
      </div>

      {/* 底部状态栏 */}
      <div className="dock-footer">
        <div className="footer-status">
          <div className="status-dot" />
          <span>监听中 · {displayedFiles.length} 个文件{virtualFolders.length > 0 && !currentFolderId ? ` · ${virtualFolders.length} 个文件夹` : ''}</span>
        </div>
        <div className="footer-actions">
          {files.length > 0 && (
            <button className="footer-btn" onClick={handleClearAll}>
              清空
            </button>
          )}
          <button className="footer-btn" onClick={() => setShowSettings(true)}>
            设置
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewFile && (
        <Preview 
          file={previewFile} 
          onClose={() => setPreviewFile(null)} 
          onOpen={() => {
            handleOpen(previewFile)
            setPreviewFile(null)
          }}
        />
      )}

      {/* Toast 通知 */}
      {toast && <div className="toast">{toast}</div>}

      {/* 撤回删除提示 */}
      {showUndo && deletedFiles.length > 0 && (
        <div className="undo-toast">
          <span>已删除文件</span>
          <button onClick={handleUndo}>撤回 (Ctrl+Z)</button>
        </div>
      )}

      {/* 调整大小手柄 */}
      <div className="resize-handle" title="拖拽调整窗口大小" />

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onCreateFolder={handleCreateFolder}
          onMoveToFolder={handleMoveToFolder}
          onDeleteFolder={deleteFolder}
          onOpenFolder={enterFolder}
          folders={virtualFolders}
          hasSelectedFile={!!selectedFileForMove}
          currentFolderId={currentFolderId}
          targetFolderId={contextMenu.folderId}
        />
      )}

      {/* 新建文件夹弹窗 */}
      {showFolderDialog && (
        <div className="folder-dialog-overlay" onClick={() => setShowFolderDialog(false)}>
          <div className="folder-dialog" onClick={e => e.stopPropagation()}>
            <div className="folder-dialog-title">📁 新建文件夹</div>
            <input
              type="text"
              className="folder-dialog-input"
              placeholder="输入文件夹名称..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmCreateFolder()
                if (e.key === 'Escape') setShowFolderDialog(false)
              }}
              autoFocus
            />
            <div className="folder-dialog-actions">
              <button 
                className="folder-dialog-btn secondary"
                onClick={() => setShowFolderDialog(false)}
              >
                取消
              </button>
              <button 
                className="folder-dialog-btn primary"
                onClick={confirmCreateFolder}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App


