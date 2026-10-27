import { useEffect, useState } from 'react'
import { FolderIcon, PlusIcon, XIcon } from './Icons'

const GENRES = ['Hành động', 'Nhập vai', 'FPS', 'MOBA', 'Thể thao', 'Khác']

interface AddGameModalProps {
  onClose: () => void
  onCreated: (game: Game) => void
}

// Lấy tên file (bỏ đuôi) để gợi ý tên game
function fileNameWithoutExt(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.[^.]+$/, '')
}

export function AddGameModal({ onClose, onCreated }: AddGameModalProps): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [exePath, setExePath] = useState('')
  const [genre, setGenre] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Esc để đóng
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const pickExe = async (): Promise<void> => {
    const path = await window.electronAPI.games.selectExe()
    if (!path) return
    setExePath(path)
    if (!title.trim()) setTitle(fileNameWithoutExt(path))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return setError('Vui lòng nhập tên game')
    if (!exePath) return setError('Vui lòng chọn file chạy game')

    setSubmitting(true)
    try {
      const game = await window.electronAPI.games.create({
        title: title.trim(),
        exe_path: exePath,
        genre: genre || undefined
      })
      onCreated(game)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thêm game')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>Thêm game</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <label className="field">
            <span className="field-label">Tên game</span>
            <input
              className="input"
              autoFocus
              placeholder="Vd: Hollow Knight"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="field">
            <span className="field-label">File chạy game</span>
            <div className="file-picker">
              <span className={`file-path ${exePath ? '' : 'placeholder'}`} title={exePath}>
                {exePath || 'Chưa chọn file'}
              </span>
              <button type="button" className="btn btn-secondary" onClick={pickExe}>
                <FolderIcon width={16} height={16} />
                Chọn file
              </button>
            </div>
          </div>

          <label className="field">
            <span className="field-label">
              Thể loại <span className="field-optional">(không bắt buộc)</span>
            </span>
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">— Chọn thể loại —</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Huỷ
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <PlusIcon width={16} height={16} />
            {submitting ? 'Đang thêm...' : 'Thêm game'}
          </button>
        </div>
      </form>
    </div>
  )
}
