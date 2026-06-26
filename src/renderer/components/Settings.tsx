import React, { useState, useEffect, useRef, useCallback } from 'react'

interface SettingsProps {
  onClose: () => void
}

interface SettingsData {
  watchPath: string
  maxFiles: number
  clipboardEnabled: boolean
  theme: 'dark' | 'light' | 'purple' | 'blue' | 'green' | 'orange'
}

// 主题配置
const themes = [
  { id: 'dark', name: '深色', color: '#1a1a2e' },
  { id: 'light', name: '浅色', color: '#f5f5f7' },
  { id: 'purple', name: '紫色', color: '#7c3aed' },
  { id: 'blue', name: '蓝色', color: '#3b82f6' },
  { id: 'green', name: '绿色', color: '#10b981' },
  { id: 'orange', name: '橙色', color: '#f97316' },
]

export function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    watchPath: '',
    maxFiles: 50,
    clipboardEnabled: true,
    theme: 'dark'
  })
  const [loading, setLoading] = useState(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 加载设置
  useEffect(() => {
    window.electronAPI.getSettings().then((data) => {
      setSettings(data)
      setLoading(false)
    })
  }, [])

  // 防抖保存设置
  const saveSettings = useCallback((key: string, value: string | boolean) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      window.electronAPI.updateSettings({ [key]: value })
    }, 300)
  }, [])

  // 更新设置（本地状态立即更新，保存延迟）
  const handleUpdate = useCallback((key: keyof SettingsData, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    
    // 如果是主题变更，立即应用
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value as string)
    }
    
    // 防抖保存
    saveSettings(key, value)
  }, [saveSettings])

  // 立即更新（用于开关类设置）
  const handleImmediateUpdate = useCallback((key: keyof SettingsData, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value as string)
    }
    
    window.electronAPI.updateSettings({ [key]: value })
  }, [])

  // 初始化时应用主题
  useEffect(() => {
    if (settings.theme) {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
  }, [settings.theme])

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="settings-panel">
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div className="settings-panel">
      {/* 固定的头部 */}
      <div className="settings-header">
        <div className="settings-title">⚙️ 设置</div>
        <button className="settings-close" onClick={onClose}>✕</button>
      </div>

      {/* 可滚动的内容区 */}
      <div className="settings-content">
        <div className="settings-item">
          <label className="settings-label">主题色</label>
          <div className="theme-selector">
            {themes.map(theme => (
              <div
                key={theme.id}
                className={`theme-option ${settings.theme === theme.id ? 'active' : ''}`}
                onClick={() => handleImmediateUpdate('theme', theme.id)}
                title={theme.name}
              >
                <div 
                  className="theme-color" 
                  style={{ background: theme.color }}
                />
                <span className="theme-name">{theme.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-item">
          <label className="settings-label">监听文件夹路径</label>
          <input
            type="text"
            className="settings-input"
            value={settings.watchPath}
            onChange={(e) => handleUpdate('watchPath', e.target.value)}
            placeholder="默认监听桌面"
          />
        </div>

        <div className="settings-item">
          <div className="settings-toggle">
            <label className="settings-label" style={{ marginBottom: 0 }}>
              监听剪贴板
            </label>
            <div 
              className={`toggle-switch ${settings.clipboardEnabled ? 'active' : ''}`}
              onClick={() => handleImmediateUpdate('clipboardEnabled', !settings.clipboardEnabled)}
            />
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)', 
            marginTop: '6px' 
          }}>
            启用后会自动捕获复制到剪贴板的图片
          </div>
        </div>

        <div className="settings-item">
          <label className="settings-label">最大保留文件数</label>
          <input
            type="number"
            className="settings-input"
            value={settings.maxFiles}
            onChange={(e) => handleUpdate('maxFiles', e.target.value)}
            min={10}
            max={100}
          />
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--text-muted)', 
            marginTop: '6px' 
          }}>
            超过此数量后会自动移除最旧的文件（10-100）
          </div>
        </div>

        <div className="settings-tips">
          <strong>使用提示：</strong><br />
          • 直接拖拽文件卡片到其他应用<br />
          • 双击卡片预览大图<br />
          • 点击 📋 按钮复制到剪贴板<br />
          • 右键可新建文件夹分类
        </div>
      </div>
    </div>
  )
}


