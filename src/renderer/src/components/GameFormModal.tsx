import { useCallback, useEffect, useRef, useState } from 'react'
import { GENRES } from '../constants/genres'
import { coverUrl, gameGradient, posterUrl } from '../utils/gameArt'
import { CoverPicker } from './CoverPicker'
import { CoverSearchModal } from './CoverSearchModal'
import { FolderIcon, PlusIcon, SaveIcon, SearchIcon, StarIcon, TrashIcon, XIcon } from './Icons'
import { TitleAutocomplete } from './TitleAutocomplete'
import { WatchDirField } from './WatchDirField'

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
  // Lời nhắn ở đầu form (vd game chưa liên kết: hãy chọn file chạy)
  notice?: string
}

type LaunchMode = 'file' | 'steam'

type SteamLookup =
  | { title: string; status: 'searching' | 'notfound' }
  | { title: string; status: 'found'; match: SteamAppMatch }

// Game đã chọn trên SteamGridDB; chỉ còn hiệu lực khi tên game vẫn đúng tên đã chọn
interface SgdbPick {
  id: number
  name: string
}

// App ID Steam lấy từ game đã chọn trên SteamGridDB (sgdbId = game lúc lấy)
type SgdbSteam =
  | { sgdbId: number; status: 'loading' | 'none' }
  | { sgdbId: number; status: 'found'; appId: string }

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

export function GameFormModal({
  game,
  onClose,
  onSaved,
  onDeleted,
  startWithDelete = false,
  notice
}: GameFormModalProps): React.JSX.Element {
  const isEdit = !!game
  const [title, setTitle] = useState(game?.title ?? '')
  const initialPath = game?.exe_path ?? ''
  const [mode, setMode] = useState<LaunchMode>(isSteamUri(initialPath) ? 'steam' : 'file')
  const [exePath, setExePath] = useState(isSteamUri(initialPath) ? '' : initialPath)
  // App ID đang lưu (sửa game Steam); không cho gõ tay, đổi bằng cách chọn tên game từ gợi ý
  const initialAppId = isSteamUri(initialPath) ? (initialPath.match(/(\d+)$/)?.[1] ?? '') : ''
  const [genre, setGenre] = useState(game?.genre ?? '')
  // Thư mục game để tính giờ chơi (để trống = thư mục cài game)
  const [watchDir, setWatchDir] = useState(game?.watch_dirs?.split('\n')[0] ?? '')
  const [favorite, setFavorite] = useState(game?.is_favorite === 1)
  // Gợi ý tên game; titleTouched = người dùng đã tự gõ tên thì không ghi đè nữa
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([])
  const [titleTouched, setTitleTouched] = useState(isEdit)
  const [sgdbPick, setSgdbPick] = useState<SgdbPick | null>(
    game?.sgdb_id ? { id: game.sgdb_id, name: game.title } : null
  )
  // Tên tự điền từ exe gần giống một game trên SteamGridDB => hỏi "Có phải: ...?"
  const [exeGuess, setExeGuess] = useState<{ forTitle: string; game: SgdbGame } | null>(null)
  const [sgdbSteam, setSgdbSteam] = useState<SgdbSteam | null>(null)
  // Ảnh bìa ngang (cover) và dọc (poster), chỉ lưu khi bấm Lưu
  const [images, setImages] = useState<Record<CoverKind, ImageSlot>>({
    cover: { preview: game ? coverUrl(game) : null, source: null, removed: false },
    poster: { preview: game ? posterUrl(game) : null, source: null, removed: false }
  })
  // Loại ảnh mở sẵn khi tìm online (null = đóng hộp thoại tìm)
  const [coverSearchKind, setCoverSearchKind] = useState<SgdbImageKind | null>(null)
  // Tự tìm Steam App ID theo tên game khi chưa có App ID (title = tên lúc tìm)
  const [steamLookup, setSteamLookup] = useState<SteamLookup | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(startWithDelete && !!game)
  const [error, setError] = useState<string | null>(null)

  const closeCoverSearch = useCallback(() => setCoverSearchKind(null), [])

  // Có lỗi => cuộn thân form lên đầu để thấy thông báo
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])

  const trimmedTitle = title.trim()
  // Sửa tên khác tên đã chọn => bỏ liên kết SteamGridDB
  const linkedSgdb = sgdbPick && sgdbPick.name === trimmedTitle ? sgdbPick : null
  const linkedSteam = linkedSgdb && sgdbSteam?.sgdbId === linkedSgdb.id ? sgdbSteam : null
  const sgdbSteamHint = mode === 'steam' ? linkedSteam : null
  // App ID chắc chắn: của game đã chọn trên SteamGridDB, không thì App ID đang lưu
  const fixedAppId = linkedSteam?.status === 'found' ? linkedSteam.appId : initialAppId
  // Chưa có App ID => tự tìm trên Steam theo tên game
  const autoSteam = mode === 'steam' && !fixedAppId && linkedSteam?.status !== 'loading'
  const guess = exeGuess && exeGuess.forTitle === title && !linkedSgdb ? exeGuess.game : null
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

  // App ID đang dùng: lấy từ SteamGridDB / đang lưu, hoặc kết quả tự tìm theo tên
  const steamAppId =
    mode !== 'steam' ? null : fixedAppId || (lookup?.status === 'found' ? lookup.match.appId : null)

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

  // Chế độ Steam: lấy App ID của game đã chọn trên SteamGridDB
  const fillSteamFromSgdb = async (pick: SgdbPick): Promise<void> => {
    if (sgdbSteam?.sgdbId === pick.id) return // Đã lấy rồi
    setSgdbSteam({ sgdbId: pick.id, status: 'loading' })
    const result = await window.electronAPI.steamGridDb.getSteamAppId(pick.id)
    const appId = result.ok ? result.data : null
    // Chọn game khác trong lúc chờ => bỏ kết quả cũ
    setSgdbSteam((prev) =>
      prev?.sgdbId !== pick.id
        ? prev
        : appId
          ? { sgdbId: pick.id, status: 'found', appId }
          : { sgdbId: pick.id, status: 'none' }
    )
  }

  const pickSgdb = (found: SgdbGame): void => {
    const pick = { id: found.id, name: found.name }
    setTitle(found.name)
    setTitleTouched(true)
    setSgdbPick(pick)
    setExeGuess(null)
    if (mode === 'steam') void fillSteamFromSgdb(pick)
  }

  const changeMode = (next: LaunchMode): void => {
    setMode(next)
    if (next === 'steam' && linkedSgdb) void fillSteamFromSgdb(linkedSgdb)
  }

  const pickExe = async (): Promise<void> => {
    const path = await window.electronAPI.games.selectExe()
    if (!path) return
    setExePath(path)
    setError(null)

    const { suggestions: found } = await window.electronAPI.games.inspectExe(path)
    setSuggestions(found)
    if (titleTouched && title.trim()) return

    const autoTitle = found[0]?.name ?? fileNameWithoutExt(path)
    setTitle(autoTitle)
    // Tìm tên vừa đoán trên SteamGridDB: trùng tên => liên kết luôn, gần giống => hỏi lại
    const result = await window.electronAPI.steamGridDb.search(autoTitle)
    const top = result.ok ? result.data[0] : undefined
    if (!top) return
    if (top.name.toLowerCase() === autoTitle.toLowerCase()) {
      setTitle((current) => (current === autoTitle ? top.name : current))
      setSgdbPick({ id: top.id, name: top.name })
    } else {
      setExeGuess({ forTitle: autoTitle, game: top })
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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return setError('Vui lòng nhập tên game')

    let launchPath = exePath
    if (mode === 'file' && !exePath) return setError('Vui lòng chọn file chạy game')

    setSubmitting(true)
    if (mode === 'steam') {
      // Bấm Lưu trước khi kịp tìm xong => tìm luôn
      const appId =
        steamAppId ?? (await window.electronAPI.games.findSteamApp(trimmedTitle))?.appId ?? null
      if (!appId) {
        setSubmitting(false)
        return setError(
          `Không tìm thấy "${trimmedTitle}" trên Steam. Hãy chọn đúng tên game trong danh sách gợi ý.`
        )
      }
      launchPath = `steam://rungameid/${appId}`
    }

    try {
      let saved: Game | undefined
      if (game) {
        saved = await window.electronAPI.games.update(game.id, {
          title: title.trim(),
          exe_path: launchPath,
          genre,
          watch_dirs: watchDir.trim() ? [watchDir.trim()] : [],
          sgdb_id: linkedSgdb?.id ?? null,
          is_favorite: favorite
        })
      } else {
        saved = await window.electronAPI.games.create({
          title: title.trim(),
          exe_path: launchPath,
          genre: genre || undefined,
          watch_dirs: watchDir.trim() ? [watchDir.trim()] : [],
          sgdb_id: linkedSgdb?.id ?? null
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
            <div className="modal-body" ref={bodyRef}>
              {/* Lỗi đặt trên cùng để dễ thấy (form dài, nút Lưu ở cuối) */}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {notice && <p className="form-notice">{notice}</p>}
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
                Ảnh dọc dùng cho lưới ảnh bìa trong Kho game. Chọn tên game từ gợi ý thì ô ảnh còn
                trống sẽ tự lấy ảnh từ SteamGridDB sau khi lưu.
              </span>

              <div className="field">
                <label className="field-label" htmlFor="game-title">
                  Tên game
                </label>
                <TitleAutocomplete
                  id="game-title"
                  autoFocus
                  placeholder="Vd: Hollow Knight"
                  value={title}
                  onChange={(value) => {
                    setTitle(value)
                    setTitleTouched(true)
                  }}
                  onPick={pickSgdb}
                />
                {guess && (
                  <div className="name-suggestions">
                    <span>Có phải:</span>
                    <button
                      type="button"
                      className="suggestion-chip"
                      title="Tên trên SteamGridDB"
                      onClick={() => pickSgdb(guess)}
                    >
                      {guess.name}
                      {guess.year && ` (${guess.year})`}?
                    </button>
                  </div>
                )}
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
                      onClick={() => changeMode('file')}
                    >
                      File trên máy
                    </button>
                    <button
                      type="button"
                      className={mode === 'steam' ? 'active' : ''}
                      onClick={() => changeMode('steam')}
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
                    <div className="file-picker">
                      <span className={`file-path ${steamAppId ? '' : 'placeholder'}`}>
                        {steamAppId
                          ? `Steam App ID ${steamAppId}`
                          : 'App ID được lấy khi bạn chọn tên game từ gợi ý'}
                      </span>
                      {/* Đổi game = chọn lại tên game trong danh sách gợi ý */}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          const input = document.getElementById('game-title')
                          if (input instanceof HTMLInputElement) {
                            input.focus()
                            input.select()
                          }
                        }}
                      >
                        <SearchIcon width={16} height={16} />
                        {steamAppId ? 'Đổi game' : 'Chọn game'}
                      </button>
                    </div>
                    {sgdbSteamHint?.status === 'loading' && (
                      <span className="field-hint">Đang lấy App ID từ SteamGridDB...</span>
                    )}
                    {sgdbSteamHint?.status === 'found' && (
                      <span className="field-hint steam-match">
                        ✓ App ID của <strong>{linkedSgdb?.name}</strong> lấy từ SteamGridDB
                      </span>
                    )}
                    {sgdbSteamHint?.status === 'none' && (
                      <span className="field-hint steam-miss">
                        SteamGridDB không ghi nhận “{linkedSgdb?.name}” trên Steam. Nếu game không
                        bán trên Steam, hãy chọn “File trên máy”.
                      </span>
                    )}
                    {/* Lấy App ID từ SteamGridDB thì không cần gợi ý tìm trên Steam bên dưới */}
                    {!sgdbSteamHint && lookup?.status === 'searching' && (
                      <span className="field-hint">Đang tìm “{lookup.title}” trên Steam...</span>
                    )}
                    {!sgdbSteamHint && lookup?.status === 'found' && (
                      <span className="field-hint steam-match">
                        ✓ Tự nhận diện: <strong>{lookup.match.name}</strong> · App ID{' '}
                        {lookup.match.appId}
                        {lookup.match.installed && ' · đã cài trên máy'}
                      </span>
                    )}
                    {!sgdbSteamHint && lookup?.status === 'notfound' && (
                      <span className="field-hint steam-miss">
                        Không tìm thấy “{lookup.title}” trên Steam. Hãy chọn đúng tên game trong
                        danh sách gợi ý.
                      </span>
                    )}
                  </>
                )}
              </div>

              <WatchDirField
                gameId={game?.id}
                mode={mode}
                value={watchDir}
                onChange={setWatchDir}
              />

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
            initialGame={linkedSgdb}
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
