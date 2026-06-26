import React, { useState, useEffect } from 'react'

interface VirtualFolder {
  id: string
  name: string
  createdAt: number
}

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  onCreateFolder: () => void
  onMoveToFolder: (folderId: string) => void
  onDeleteFolder: (folderId: string) => void
  onOpenFolder: (folderId: string) => void
  folders: VirtualFolder[]
  hasSelectedFile: boolean // 是否有选中的文件
  currentFolderId: string | null // 当前所在文件夹
  targetFolderId?: string // 右键点击的文件夹ID
}

export function ContextMenu({ x, y, onClose, onCreateFolder, onMoveToFolder, onDeleteFolder, onOpenFolder, folders, hasSelectedFile, currentFolderId, targetFolderId }: ContextMenuProps) {
  const [showFolders, setShowFolders] = useState(false)

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClick = () => onClose()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [onClose])

  // 调整位置避免超出屏幕
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 3000
  }

  return (
    <div className="context-menu" style={menuStyle} onClick={e => e.stopPropagation()}>
      {/* 文件夹右键菜单 */}
      {targetFolderId ? (
        <>
          <div 
            className="context-menu-item"
            onClick={() => {
              onOpenFolder(targetFolderId)
              onClose()
            }}
          >
            <span className="context-menu-icon">📂</span>
            <span>打开文件夹</span>
          </div>
          <div className="context-menu-divider" />
          <div 
            className="context-menu-item danger"
            onClick={() => {
              onDeleteFolder(targetFolderId)
              onClose() // 关闭右键菜单
            }}
          >
            <span className="context-menu-icon">🗑️</span>
            <span>删除文件夹</span>
          </div>
        </>
      ) : (
        <>
          <div className="context-menu-item" onClick={onCreateFolder}>
            <span className="context-menu-icon">📁</span>
            <span>新建文件夹</span>
          </div>
          
          {hasSelectedFile && (
            <>
              <div className="context-menu-divider" />
              
              <div 
                className="context-menu-item has-submenu"
                onMouseEnter={() => setShowFolders(true)}
                onMouseLeave={() => setShowFolders(false)}
              >
                <span className="context-menu-icon">📂</span>
                <span>移动到文件夹</span>
                <span className="context-menu-arrow">▶</span>
                
                {showFolders && (
                  <div className="context-submenu">
                    {/* 如果当前在文件夹内，显示"移出文件夹"选项 */}
                    {currentFolderId && (
                      <div 
                        className="context-menu-item"
                        onClick={() => onMoveToFolder('')}
                      >
                        <span className="context-menu-icon">📤</span>
                        <span>移出到根目录</span>
                      </div>
                    )}
                    {folders.length === 0 ? (
                      <div className="context-menu-item disabled">
                        <span className="context-menu-icon">📭</span>
                        <span>暂无文件夹，请先创建</span>
                      </div>
                    ) : (
                      folders
                        .filter(f => f.id !== currentFolderId) // 排除当前文件夹
                        .map(folder => (
                          <div 
                            key={folder.id}
                            className="context-menu-item"
                            onClick={() => onMoveToFolder(folder.id)}
                          >
                            <span className="context-menu-icon">📁</span>
                            <span>{folder.name}</span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

