import React from 'react'

export function DropZone() {
  return (
    <div className="drop-zone-overlay">
      <div className="drop-zone-content">
        <div className="drop-zone-icon">📥</div>
        <div className="drop-zone-text">释放以添加文件</div>
      </div>
    </div>
  )
}

