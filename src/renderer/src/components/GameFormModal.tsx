import { useCallback, useEffect, useState } from 'react'
import { GENRES } from '../constants/genres'
import { coverUrl, gameGradient, posterUrl } from '../utils/gameArt'
import { CoverPicker } from './CoverPicker'
import { CoverSearchModal } from './CoverSearchModal'
import { FolderIcon, PlusIcon, SaveIcon, SearchIcon, StarIcon, TrashIcon, XIcon } from './Icons'

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
  // Mở thẳng bước xác nhận xoá (từ menu chuột phải)
  startWithDelete?: boolean
}

type LaunchMode = 'file' | 'steam'

type SteamLookup =
  | { title: string; status: 'searching' | 'notfound' }
  | { title: string; status: 'found'; match: SteamAppMatch }

// source = ảnh mới chọn (chưa lưu), removed = muốn xoá ảnh hiện tại
interface ImageSlot {
  preview: string | null
  source: string | null
  removed: boolean
}

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
  onDeleted,
  startWithDelete = false
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
  // Ảnh bìa ngang (cover) và dọc (poster), chỉ lưu khi bấm Lưu
  const [images, setImages] = useState<Record<CoverKind, ImageSlot>>({
    cover: { preview: game ? coverUrl(game) : null, source: null, removed: false },
    poster: { preview: game ? posterUrl(game) : null, source: null, removed: false }
  })
  // Loại ảnh mở sẵn khi tìm online (null = đóng hộp thoại tìm)
  const [coverSearchKind, setCoverSearchKind] = useState<SgdbImageKind | null>(null)
  // Tự tìm Steam App ID theo tên game khi để trống ô App ID (title = tên lúc tìm)
  const [steamLookup, setSteamLookup] = useState<SteamLookup | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(startWithDelete && !!game)
  const [error, setError] = useState<string | null>(null)

  const closeCoverSearch = useCallback(() => setCoverSearchKind(null), [])

  const autoSteam = mode === 'steam' && !steamInput.trim()
  const trimmedTitle = title.trim()
  // Kết quả tìm chỉ dùng được nếu tên game chưa bị sửa sau lúc tìm
  const lookup = autoSteam && steamLookup?.title === trimmedTitle ? steamLookup : null

  // Gõ tên xong (nghỉ 500ms) thì tự tìm game trên Steam
  useEffect(() => {
    if (!autoSteam || !trimmedTitle) return
    let cancelled = false
    const timer = setTimeout(() => {
      setSteamLookup({ title: trimmedTitle, status: 'searching' })
      window.electronAPI.games.findSteamApp(trimmedTitle).then((match) => {
        if (cancelled) return
        setSteamLookup(
          match
            ? { title: trimmedTitle, status: 'found', match }
            : { title: trimmedTitle, status: 'notfound' }
        )
      })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [autoSteam, trimmedTitle])

  // App ID đang dùng: người dùng nhập, hoặc kết quả tự tìm
  const steamAppId =
    mode !== 'steam'
      ? null
      : steamInput.trim()
        ? (toSteamUri(steamInput)?.match(/(\d+)$/)?.[1] ?? null)
        : lookup?.status === 'found'
          ? lookup.match.appId
          : null

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

  const applyImage = (kind: CoverKind, path: string, preview: string): void => {
    setImages((prev) => ({ ...prev, [kind]: { preview, source: path, removed: false } }))
  }

  const pickImage = async (kind: CoverKind): Promise<void> => {
    const result = await window.electronAPI.games.selectCover()
    if (result) applyImage(kind, result.path, result.preview)
  }

  const dropImage = async (kind: CoverKind, path: string): Promise<void> => {
    const preview = await window.electronAPI.games.previewCover(path)
    if (preview) applyImage(kind, path, preview)
    else setError('File kéo vào không phải ảnh hợp lệ (png, jpg, webp, bmp)')
  }

  const removeImage = (kind: CoverKind): void => {
    setImages((prev) => ({ ...prev, [kind]: { preview: null, source: null, removed: true } }))
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
    if (mode === 'file' && !exePath) return setError('Vui lòng chọn file chạy game')

    setSubmitting(true)
    if (mode === 'steam') {
      let uri = toSteamUri(steamInput)
      if (!steamInput.trim()) {
        // Bấm Lưu trước khi kịp tìm xong => tìm luôn
        const match =
          lookup?.status === 'found'
            ? lookup.match
            : await window.electronAPI.games.findSteamApp(trimmedTitle)
        if (match) uri = `steam://rungameid/${match.appId}`
      }
      if (!uri) {
        setSubmitting(false)
        return setError(
          steamInput.trim()
            ? 'App ID không hợp lệ. Nhập số (vd: 730) hoặc URI dạng steam://...'
            : `Không tìm thấy "${trimmedTitle}" trên Steam. Kiểm tra lại tên game hoặc nhập App ID.`
        )
      }
      launchPath = uri
    }

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

      for (const kind of ['cover', 'poster'] as CoverKind[]) {
        const { source, removed } = images[kind]
        const current = kind === 'poster' ? saved.poster_path : saved.cover_path
        if (source) {
          saved = (await window.electronAPI.games.setCover(saved.id, source, kind)) ?? saved
        } else if (removed && current) {
          saved = (await window.electronAPI.games.setCover(saved.id, null, kind)) ?? saved
        }
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
              <div className="cover-row">
                <div className="cover-slot">
                  <CoverPicker
                    preview={images.cover.preview}
                    placeholder={gameGradient(title || 'game')}
                    hint="Ảnh bìa ngang · bấm hoặc kéo ảnh vào"
                    onPick={() => pickImage('cover')}
                    onDropFile={(path) => dropImage('cover', path)}
                    onRemove={() => removeImage('cover')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setCoverSearchKind('grid')}
                  >
                    <SearchIcon width={14} height={14} /> Tìm ảnh ngang online
                  </button>
                </div>
                <div className="cover-slot poster-slot">
                  <CoverPicker
                    className="poster"
                    preview={images.poster.preview}
                    placeholder={gameGradient(title || 'game')}
                    hint="Ảnh dọc 2:3"
                    onPick={() => pickImage('poster')}
                    onDropFile={(path) => dropImage('poster', path)}
                    onRemove={() => removeImage('poster')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setCoverSearchKind('poster')}
                  >
                    <SearchIcon width={14} height={14} /> Tìm online
                  </button>
                </div>
              </div>
              <span className="field-hint cover-row-hint">
                Ảnh dọc dùng cho lưới ảnh bìa trong Kho game. Ảnh online lấy từ SteamGridDB, bạn
                chọn và xác nhận trước khi dùng.
              </span>

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
                      placeholder="Để trống để tự tìm theo tên game, hoặc nhập App ID (vd: 730)"
                      value={steamInput}
                      onChange={(e) => setSteamInput(e.target.value)}
                    />
                    {lookup?.status === 'searching' && (
                      <span className="field-hint">Đang tìm “{lookup.title}” trên Steam...</span>
                    )}
                    {lookup?.status === 'found' && (
                      <span className="field-hint steam-match">
                        ✓ Tự nhận diện: <strong>{lookup.match.name}</strong> · App ID{' '}
                        {lookup.match.appId}
                        {lookup.match.installed && ' · đã cài trên máy'}
                      </span>
                    )}
                    {lookup?.status === 'notfound' && (
                      <span className="field-hint steam-miss">
                        Không tìm thấy “{lookup.title}” trên Steam. Kiểm tra lại tên (tên tiếng Anh
                        trên Steam) hoặc nhập App ID.
                      </span>
                    )}
                    {!lookup && (
                      <span className="field-hint">
                        App ID nằm trong link trang Steam của game: store.steampowered.com/app/
                        <strong>730</strong>/...
                      </span>
                    )}
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

        {coverSearchKind && (
          <CoverSearchModal
            initialQuery={title}
            initialKind={coverSearchKind}
            steamAppId={steamAppId}
            onClose={closeCoverSearch}
            onSelect={(path, preview, target) => {
              applyImage(target, path, preview)
              setCoverSearchKind(null)
            }}
          />
        )}
      </form>
    </div>
  )
}
