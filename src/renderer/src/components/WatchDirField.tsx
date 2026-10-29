import { useEffect, useState } from 'react'
import { FolderIcon } from './Icons'

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

  const check = async (dir: string): Promise<void> => {
    const message = dir.trim() ? await window.electronAPI.games.validateWatchDir(dir.trim()) : null
    setError(message ? { dir, message } : null)
  }

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
      <div className="file-picker">
        <input
          className="file-picker-input"
          placeholder={known?.path ?? 'Vd: D:\\Games\\Ten Game'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => void check(e.target.value)}
        />
        <button type="button" className="btn btn-secondary" onClick={pick}>
          <FolderIcon width={16} height={16} />
          Chọn thư mục
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
