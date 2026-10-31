import { useEffect, useState } from 'react'
import { FolderIcon, XIcon } from './Icons'

interface WatchDirFieldProps {
  gameId?: string
  mode: 'file' | 'steam'
  value: string
  onChange: (dir: string) => void
}

// Thư mục game để tính giờ chơi: mọi exe trong thư mục đều tính là đang chơi.
// Thư mục cài game luôn được dùng tự động; ô này để thêm thư mục khi game nằm ở chỗ khác launcher
export function WatchDirField({
  gameId,
  mode,
  value,
  onChange
}: WatchDirFieldProps): React.JSX.Element {
  const [autoDir, setAutoDir] = useState<{ id: string; path: string | null } | null>(null)
  // Lỗi của đúng giá trị đang nhập (đổi giá trị thì lỗi cũ tự ẩn)
  const [error, setError] = useState<{ dir: string; message: string } | null>(null)

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    window.electronAPI.games.getInstallInfo(gameId, false).then((info) => {
      if (!cancelled) setAutoDir({ id: gameId, path: info.path })
    })
    return () => {
      cancelled = true
    }
  }, [gameId])

  const pick = async (): Promise<void> => {
    const picked = await window.electronAPI.games.selectWatchDir()
    if (!picked) return
    onChange(picked.path)
    setError(picked.error ? { dir: picked.path, message: picked.error } : null)
  }

  const known = autoDir?.id === gameId ? autoDir : null
  const autoText = known
    ? (known.path ?? 'chưa tìm thấy thư mục cài game')
    : mode === 'steam'
      ? 'thư mục cài game trong Steam'
      : 'thư mục chứa file chạy game'
  const shownError = error?.dir === value ? error.message : null

  return (
    <div className="field">
      <span className="field-label">
        Thư mục game <span className="field-optional">(không bắt buộc)</span>
      </span>
      {/* Chỉ chọn qua hộp thoại (đường dẫn gõ tay dễ sai), giống ô file chạy game */}
      <div className="file-picker">
        <span className={`file-path ${value ? '' : 'placeholder'}`} title={value}>
          {value || 'Chưa chọn (dùng thư mục tự động)'}
        </span>
        {value && (
          <button
            type="button"
            className="icon-button"
            title="Bỏ thư mục này"
            onClick={() => {
              onChange('')
              setError(null)
            }}
          >
            <XIcon width={16} height={16} />
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={pick}>
          <FolderIcon width={16} height={16} />
          {value ? 'Đổi thư mục' : 'Chọn thư mục'}
        </button>
      </div>
      {shownError ? (
        <span className="field-hint steam-miss">{shownError}</span>
      ) : (
        <span className="field-hint">
          Mọi exe trong thư mục game đều được tính giờ chơi. Tự động dùng: {autoText}. Chỉ chọn khi
          game nằm ở thư mục khác với launcher.
        </span>
      )}
    </div>
  )
}
