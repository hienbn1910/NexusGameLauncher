import { useCallback, useEffect, useState } from 'react'
import { GENRES } from '../constants/genres'
import { coverUrl, gameGradient } from '../utils/gameArt'
import { CoverSearchModal } from './CoverSearchModal'
import {
  FolderIcon,
  ImageIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
  XIcon
} from './Icons'

const SUGGESTION_LABEL: Record<NameSuggestion['source'], string> = {
  metadata: 'Từ thông tin exe',
  folder: 'Từ tên thư mục',
  file: 'Từ tên file'
}

interface GameFormModalProps {
  // Có game => chế độ sửa, không có => chế độ thêm
  game?: Game
  onClose: () => void
  onSaved: (game: Game) => void
  onDeleted?: (id: string) => void
}

type LaunchMode = 'file' | 'steam'

// Lấy tên file (bỏ đuôi) để gợi ý tên game
function fileNameWithoutExt(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.[^.]+$/, '')
}

const isSteamUri = (value: string): boolean => /^steam:\/\//i.test(value.trim())

// Chấp nhận App ID (vd 730) hoặc URI đầy đủ (vd steam://rungameid/730)
function toSteamUri(value: string): string | null {
  const v = value.trim()
  if (/^\d+$/.test(v)) return `steam://rungameid/${v}`
  if (isSteamUri(v)) return v
  return null
}

export function GameFormModal({
  game,
  onClose,
  onSaved,
  onDeleted
}: GameFormModalProps): React.JSX.Element {
  const isEdit = !!game
  const [title, setTitle] = useState(game?.title ?? '')
  const initialPath = game?.exe_path ?? ''
  const [mode, setMode] = useState<LaunchMode>(isSteamUri(initialPath) ? 'steam' : 'file')
  const [exePath, setExePath] = useState(isSteamUri(initialPath) ? '' : initialPath)
  const [steamInput, setSteamInput] = useState(isSteamUri(initialPath) ? initialPath : '')
  const [genre, setGenre] = useState(game?.genre ?? '')
  const [processName, setProcessName] = useState(game?.process_name ?? '')
  const [favorite, setFavorite] = useState(game?.is_favorite === 1)
  // Gợi ý tên game; titleTouched = người dùng đã tự gõ tên thì không ghi đè nữa
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([])
  const [titleTouched, setTitleTouched] = useState(isEdit)
  // Ảnh bìa: coverSource = ảnh mới chọn (chưa lưu), coverRemoved = muốn xoá ảnh hiện tại
  const [coverPreview, setCoverPreview] = useState<string | null>(game ? coverUrl(game) : null)
  const [coverSource, setCoverSource] = useState<string | null>(null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showCoverSearch, setShowCoverSearch] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeCoverSearch = useCallback(() => setShowCoverSearch(false), [])

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
    setError(null)

    const { suggestions: found } = await window.electronAPI.games.inspectExe(path)
    setSuggestions(found)
    if (!titleTouched || !title.trim()) {
      setTitle(found[0]?.name ?? fileNameWithoutExt(path))
    }
  }

  const applyCover = (path: string, preview: string): void => {
    setCoverSource(path)
    setCoverPreview(preview)
    setCoverRemoved(false)
  }

  const pickCover = async (): Promise<void> => {
    const result = await window.electronAPI.games.selectCover()
    if (result) applyCover(result.path, result.preview)
  }

  const handleCoverDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const path = window.electronAPI.games.getPathForFile(file)
    const preview = await window.electronAPI.games.previewCover(path)
    if (preview) applyCover(path, preview)
    else setError('File kéo vào không phải ảnh hợp lệ (png, jpg, webp, bmp)')
  }

  const removeCover = (): void => {
    setCoverSource(null)
    setCoverPreview(null)
    setCoverRemoved(true)
  }

  // Chọn file exe của game thật, chỉ lấy tên file (vd Game.exe)
  const pickProcess = async (): Promise<void> => {
    const path = await window.electronAPI.games.selectExe()
    if (!path) return
    setProcessName(path.split(/[\\/]/).pop() ?? '')
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return setError('Vui lòng nhập tên game')

    let launchPath = exePath
    if (mode === 'steam') {
      const uri = toSteamUri(steamInput)
      if (!uri) return setError('Nhập Steam App ID (vd: 730) hoặc URI dạng steam://...')
      launchPath = uri
    } else if (!exePath) {
      return setError('Vui lòng chọn file chạy game')
    }

    setSubmitting(true)
    try {
      let saved: Game | undefined
      if (game) {
        saved = await window.electronAPI.games.update(game.id, {
          title: title.trim(),
          exe_path: launchPath,
          genre,
          process_name: processName,
          is_favorite: favorite
        })
      } else {
        saved = await window.electronAPI.games.create({
          title: title.trim(),
          exe_path: launchPath,
          genre: genre || undefined,
          process_name: processName || undefined
        })
        if (favorite) {
          saved = await window.electronAPI.games.update(saved.id, { is_favorite: true })
        }
      }
      if (!saved) throw new Error('Game không còn tồn tại')

      if (coverSource) {
        saved = (await window.electronAPI.games.setCover(saved.id, coverSource)) ?? saved
      } else if (coverRemoved && saved.cover_path) {
        saved = (await window.electronAPI.games.setCover(saved.id, null)) ?? saved
      }
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
              <div
                className={`cover-picker ${dragOver ? 'drag-over' : ''} ${coverPreview ? 'has-image' : ''}`}
                style={
                  coverPreview
                    ? { backgroundImage: `url("${coverPreview}")` }
                    : { background: gameGradient(title || 'game') }
                }
                onClick={pickCover}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleCoverDrop}
              >
                {!coverPreview && (
                  <span className="cover-picker-hint">
                    <ImageIcon width={22} height={22} />
                    Bấm hoặc kéo ảnh vào để đặt ảnh bìa
                  </span>
                )}
                {coverPreview && (
                  <div className="cover-picker-actions">
                    <button type="button" className="btn btn-glass btn-xs">
                      <ImageIcon width={14} height={14} /> Đổi ảnh
                    </button>
                    <button
                      type="button"
                      className="btn btn-glass btn-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCover()
                      }}
                    >
                      <TrashIcon width={14} height={14} /> Xoá ảnh
                    </button>
                  </div>
                )}
              </div>

              <div className="cover-toolbar">
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setShowCoverSearch(true)}
                >
                  <SearchIcon width={14} height={14} /> Tìm ảnh online
                </button>
                <span className="field-hint">
                  Ảnh từ SteamGridDB, bạn chọn và xác nhận trước khi dùng
                </span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="game-title">
                  Tên game
                </label>
                <input
                  id="game-title"
                  className="input"
                  autoFocus
                  placeholder="Vd: Hollow Knight"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setTitleTouched(true)
                  }}
                />
                {suggestions.length > 0 && (
                  <div className="name-suggestions">
                    <span>Gợi ý:</span>
                    {suggestions.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        title={SUGGESTION_LABEL[s.source]}
                        className={`suggestion-chip ${s.name === title ? 'active' : ''}`}
                        onClick={() => {
                          setTitle(s.name)
                          setTitleTouched(true)
                        }}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <div className="field-label-row">
                  <span className="field-label">Cách mở game</span>
                  <div className="segmented">
                    <button
                      type="button"
                      className={mode === 'file' ? 'active' : ''}
                      onClick={() => setMode('file')}
                    >
                      File trên máy
                    </button>
                    <button
                      type="button"
                      className={mode === 'steam' ? 'active' : ''}
                      onClick={() => setMode('steam')}
                    >
                      Steam
                    </button>
                  </div>
                </div>

                {mode === 'file' ? (
                  <div className="file-picker">
                    <span className={`file-path ${exePath ? '' : 'placeholder'}`} title={exePath}>
                      {exePath || 'Chưa chọn file'}
                    </span>
                    <button type="button" className="btn btn-secondary" onClick={pickExe}>
                      <FolderIcon width={16} height={16} />
                      {exePath ? 'Đổi file' : 'Chọn file'}
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      className="input"
                      placeholder="App ID (vd: 730) hoặc steam://rungameid/730"
                      value={steamInput}
                      onChange={(e) => setSteamInput(e.target.value)}
                    />
                    <span className="field-hint">
                      App ID nằm trong link trang Steam của game: store.steampowered.com/app/
                      <strong>730</strong>/...
                    </span>
                  </>
                )}
              </div>

              <div className="field">
                <span className="field-label">
                  Tiến trình game <span className="field-optional">(không bắt buộc)</span>
                </span>
                <div className="file-picker">
                  <input
                    className="file-picker-input"
                    placeholder="Vd: Game.exe"
                    value={processName}
                    onChange={(e) => setProcessName(e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary" onClick={pickProcess}>
                    <FolderIcon width={16} height={16} />
                    Chọn exe
                  </button>
                </div>
                <span className="field-hint">
                  {mode === 'steam'
                    ? 'Điền exe của game để launcher tính được giờ chơi cho game Steam.'
                    : 'Điền khi file ở trên chỉ là launcher của game. Để trống thì tự theo dõi mọi exe trong thư mục game.'}
                </span>
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

        {showCoverSearch && (
          <CoverSearchModal
            initialQuery={title}
            steamAppId={
              mode === 'steam' ? (toSteamUri(steamInput)?.match(/(\d+)$/)?.[1] ?? null) : null
            }
            onClose={closeCoverSearch}
            onSelect={(path, preview) => {
              applyCover(path, preview)
              setShowCoverSearch(false)
            }}
          />
        )}
      </form>
    </div>
  )
}
