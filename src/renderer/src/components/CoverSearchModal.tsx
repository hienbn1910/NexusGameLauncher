import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ApiKeyForm } from './ApiKeyForm'
import { SaveIcon, SearchIcon, XIcon } from './Icons'

interface CoverSearchModalProps {
  initialQuery: string
  steamAppId?: string | null
  initialKind?: SgdbImageKind
  onClose: () => void
  // Ảnh đã tải về file tạm, form sẽ dùng như ảnh chọn từ máy
  // target: ảnh dọc => poster, ảnh ngang/banner => cover
  onSelect: (path: string, preview: string, target: CoverKind) => void
}

const KIND_LABEL: Record<SgdbImageKind, string> = {
  poster: 'Ảnh dọc',
  grid: 'Ảnh ngang',
  hero: 'Ảnh banner'
}

const KINDS: SgdbImageKind[] = ['poster', 'grid', 'hero']

export function CoverSearchModal({
  initialQuery,
  steamAppId,
  initialKind = 'grid',
  onClose,
  onSelect
}: CoverSearchModalProps): React.JSX.Element {
  const api = window.electronAPI.steamGridDb
  const [configured, setConfigured] = useState<boolean | null>(null)

  // Bước 1: tìm & chọn game
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SgdbGame[]>([])
  const [steamMatch, setSteamMatch] = useState<SgdbGame | null>(null)
  const [searching, setSearching] = useState(false)

  // Bước 2: chọn ảnh
  const [selectedGame, setSelectedGame] = useState<SgdbGame | null>(null)
  const [kind, setKind] = useState<SgdbImageKind>(initialKind)
  const [images, setImages] = useState<SgdbImage[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingImages, setLoadingImages] = useState(false)
  const [selectedImage, setSelectedImage] = useState<SgdbImage | null>(null)
  const [downloading, setDownloading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  // Esc chỉ đóng hộp thoại này, không đóng luôn form game bên dưới
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  const search = useCallback(
    async (term: string): Promise<void> => {
      if (!term.trim()) return
      setSearching(true)
      setError(null)
      const result = await api.search(term)
      setSearching(false)
      if (result.ok) setResults(result.data)
      else setError(result.error)
    },
    [api]
  )

  // Đã có API key: khớp theo Steam App ID (nếu có) và tìm theo tên game
  const loadInitial = useCallback(async (): Promise<void> => {
    setConfigured(true)
    if (steamAppId) {
      const result = await api.getBySteamAppId(steamAppId)
      if (result.ok && result.data) setSteamMatch(result.data)
    }
    await search(initialQuery)
  }, [api, steamAppId, initialQuery, search])

  useEffect(() => {
    api.isConfigured().then((ok) => {
      if (ok) void loadInitial()
      else setConfigured(false)
    })
  }, [api, loadInitial])

  const loadImages = async (
    game: SgdbGame,
    imageKind: SgdbImageKind,
    pageIndex: number
  ): Promise<void> => {
    setLoadingImages(true)
    setError(null)
    const result = await api.getImages(game.id, imageKind, pageIndex)
    setLoadingImages(false)
    if (!result.ok) return setError(result.error)

    setImages((prev) => (pageIndex === 0 ? result.data : [...prev, ...result.data]))
    setPage(pageIndex)
    setHasMore(result.data.length > 0)
  }

  const chooseGame = (game: SgdbGame): void => {
    setSelectedGame(game)
    setSelectedImage(null)
    setImages([])
    void loadImages(game, kind, 0)
  }

  const changeKind = (next: SgdbImageKind): void => {
    if (next === kind || !selectedGame) return
    setKind(next)
    setSelectedImage(null)
    setImages([])
    void loadImages(selectedGame, next, 0)
  }

  const confirm = async (image: SgdbImage | null = selectedImage): Promise<void> => {
    if (!image || downloading) return
    setDownloading(true)
    setError(null)
    const result = await api.download(image.url)
    setDownloading(false)
    if (!result.ok) return setError(result.error)
    onSelect(result.data.path, result.data.preview, kind === 'poster' ? 'poster' : 'cover')
  }

  // Kết quả khớp Steam App ID đứng đầu, bỏ trùng trong danh sách tìm theo tên
  const gameList = steamMatch
    ? [steamMatch, ...results.filter((g) => g.id !== steamMatch.id)]
    : results

  const renderGameStep = (): React.JSX.Element => (
    <>
      <form
        className="sgdb-search"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation() // Không để submit lan ra form game bên ngoài (React portal)
          void search(query)
        }}
      >
        <label className="filter-search">
          <SearchIcon width={16} height={16} />
          <input
            autoFocus
            placeholder="Tên game trên SteamGridDB..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-secondary" disabled={searching}>
          {searching ? 'Đang tìm...' : 'Tìm'}
        </button>
      </form>

      <p className="sgdb-step-hint">Bước 1/2 · Chọn đúng game của bạn</p>

      <ul className="sgdb-game-list">
        {gameList.map((g) => (
          <li key={g.id}>
            <button type="button" className="sgdb-game-item" onClick={() => chooseGame(g)}>
              <span className="sgdb-game-name">{g.name}</span>
              {g.year && <span className="sgdb-game-year">{g.year}</span>}
              {steamMatch?.id === g.id && <span className="tag tag-accent">Khớp Steam App ID</span>}
              {g.verified && <span className="tag">Đã xác minh</span>}
            </button>
          </li>
        ))}
        {!searching && gameList.length === 0 && (
          <li className="sgdb-empty">Không tìm thấy game nào. Thử đổi từ khoá (tên tiếng Anh).</li>
        )}
      </ul>
    </>
  )

  const renderImageStep = (game: SgdbGame): React.JSX.Element => (
    <>
      <div className="sgdb-image-toolbar">
        <button type="button" className="link-button" onClick={() => setSelectedGame(null)}>
          ← Đổi game
        </button>
        <strong className="sgdb-selected-game">{game.name}</strong>
        <div className="segmented">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={kind === k ? 'active' : ''}
              onClick={() => changeKind(k)}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <p className="sgdb-step-hint">Bước 2/2 · Chọn ảnh bìa rồi bấm “Dùng ảnh này”</p>

      <div className={`sgdb-image-grid kind-${kind}`}>
        {images.map((img) => (
          <button
            key={img.id}
            type="button"
            className={`sgdb-image ${selectedImage?.id === img.id ? 'selected' : ''}`}
            onClick={() => setSelectedImage(img)}
            onDoubleClick={() => {
              setSelectedImage(img)
              void confirm(img)
            }}
            title={`${img.width}×${img.height}${img.author ? ` · ${img.author}` : ''}`}
          >
            <img src={img.thumb} alt="" loading="lazy" draggable={false} />
          </button>
        ))}
      </div>

      {loadingImages && <p className="sgdb-empty">Đang tải ảnh...</p>}
      {!loadingImages && images.length === 0 && (
        <p className="sgdb-empty">
          Game này chưa có {KIND_LABEL[kind].toLowerCase()}. Thử loại ảnh khác.
        </p>
      )}
      {!loadingImages && hasMore && images.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost btn-sm sgdb-load-more"
          onClick={() => loadImages(game, kind, page + 1)}
        >
          Tải thêm
        </button>
      )}
    </>
  )

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tìm ảnh bìa · SteamGridDB</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          {configured === false && (
            <>
              <p>Cần SteamGridDB API key để tìm ảnh bìa.</p>
              <ApiKeyForm onSaved={loadInitial} />
            </>
          )}
          {configured && (selectedGame ? renderImageStep(selectedGame) : renderGameStep())}
          {error && <p className="form-error">{error}</p>}
        </div>

        {configured && selectedGame && (
          <div className="modal-footer">
            {selectedImage && (
              <span className="sgdb-selected-info footer-left">
                {selectedImage.width}×{selectedImage.height}
                {selectedImage.author && ` · tác giả ${selectedImage.author}`}
              </span>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Huỷ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedImage || downloading}
              onClick={() => confirm()}
            >
              <SaveIcon width={16} height={16} />
              {downloading ? 'Đang tải ảnh...' : 'Dùng ảnh này'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
