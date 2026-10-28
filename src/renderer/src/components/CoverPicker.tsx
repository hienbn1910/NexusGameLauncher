import { useState } from 'react'
import { ImageIcon, TrashIcon } from './Icons'

interface CoverPickerProps {
  preview: string | null
  // Nền khi chưa có ảnh (gradient theo tên game)
  placeholder: string
  hint: string
  className?: string
  onPick: () => void
  onDropFile: (path: string) => void
  onRemove: () => void
}

// Khung chọn ảnh: bấm để mở dialog hoặc kéo-thả file ảnh vào
export function CoverPicker({
  preview,
  placeholder,
  hint,
  className = '',
  onPick,
  onDropFile,
  onRemove
}: CoverPickerProps): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) onDropFile(window.electronAPI.games.getPathForFile(file))
  }

  return (
    <div
      className={`cover-picker ${className} ${dragOver ? 'drag-over' : ''} ${preview ? 'has-image' : ''}`}
      style={preview ? { backgroundImage: `url("${preview}")` } : { background: placeholder }}
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {!preview && (
        <span className="cover-picker-hint">
          <ImageIcon width={22} height={22} />
          {hint}
        </span>
      )}
      {preview && (
        <div className="cover-picker-actions">
          <button type="button" className="btn btn-glass btn-xs" title="Đổi ảnh">
            <ImageIcon width={14} height={14} /> <span>Đổi</span>
          </button>
          <button
            type="button"
            className="btn btn-glass btn-xs"
            title="Xoá ảnh"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <TrashIcon width={14} height={14} /> <span>Xoá</span>
          </button>
        </div>
      )}
    </div>
  )
}
