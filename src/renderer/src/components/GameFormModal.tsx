import { useEffect, useState } from 'react'
import { GENRES } from '../constants/genres'
import { FolderIcon, PlusIcon, SaveIcon, StarIcon, TrashIcon, XIcon } from './Icons'

interface GameFormModalProps {
  // Có game => chế độ sửa, không có => chế độ thêm
  game?: Game
  onClose: () => void
  onSaved: (game: Game) => void
  onDeleted?: (id: string) => void
}

// Lấy tên file (bỏ đuôi) để gợi ý tên game
function fileNameWithoutExt(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.[^.]+$/, '')
}

export function GameFormModal({
  game,
  onClose,
  onSaved,
  onDeleted
}: GameFormModalProps): React.JSX.Element {
  const isEdit = !!game
  const [title, setTitle] = useState(game?.title ?? '')
  const [exePath, setExePath] = useState(game?.exe_path ?? '')
  const [genre, setGenre] = useState(game?.genre ?? '')
  const [favorite, setFavorite] = useState(game?.is_favorite === 1)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Esc: đang hỏi xác nhận xoá thì quay lại form, không thì đóng modal
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (confirmDelete) setConfirmDelete(false)
      else onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, confirmDelete])

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
      let saved: Game | undefined
      if (game) {
        saved = await window.electronAPI.games.update(game.id, {
          title: title.trim(),
          exe_path: exePath,
          genre,
          is_favorite: favorite
        })
      } else {
        saved = await window.electronAPI.games.create({
          title: title.trim(),
          exe_path: exePath,
          genre: genre || undefined
        })
        if (favorite) {
          saved = await window.electronAPI.games.update(saved.id, { is_favorite: true })
        }
      }
      if (!saved) throw new Error('Game không còn tồn tại')
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu game')
      setSubmitting(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!game) return
    setSubmitting(true)
    try {
      await window.electronAPI.games.delete(game.id)
      onDeleted?.(game.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xoá game')
      setConfirmDelete(false)
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>{isEdit ? 'Sửa game' : 'Thêm game'}</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        {confirmDelete ? (
          <>
            <div className="modal-body confirm-body">
              <span className="confirm-icon">
                <TrashIcon width={24} height={24} />
              </span>
              <p>
                Xoá <strong>{game?.title}</strong> khỏi thư viện?
              </p>
              <p className="confirm-note">
                Chỉ xoá khỏi launcher, file game trên máy vẫn được giữ nguyên.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                autoFocus
                onClick={() => setConfirmDelete(false)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={submitting}
                onClick={handleDelete}
              >
                <TrashIcon width={16} height={16} />
                {submitting ? 'Đang xoá...' : 'Xoá game'}
              </button>
            </div>
          </>
        ) : (
          <>
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
                    {exePath ? 'Đổi file' : 'Chọn file'}
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
                  {/* Giữ thể loại cũ nếu không còn trong danh sách */}
                  {genre && !GENRES.includes(genre) && <option value={genre}>{genre}</option>}
                </select>
              </label>

              <button
                type="button"
                className={`favorite-toggle ${favorite ? 'active' : ''}`}
                onClick={() => setFavorite((v) => !v)}
              >
                <StarIcon width={16} height={16} />
                {favorite ? 'Đã thêm vào yêu thích' : 'Thêm vào yêu thích'}
              </button>

              {error && <p className="form-error">{error}</p>}
            </div>

            <div className="modal-footer">
              {isEdit && (
                <button
                  type="button"
                  className="btn btn-danger-ghost footer-left"
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon width={16} height={16} />
                  Xoá
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Huỷ
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {isEdit ? <SaveIcon width={16} height={16} /> : <PlusIcon width={16} height={16} />}
                {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm game'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
