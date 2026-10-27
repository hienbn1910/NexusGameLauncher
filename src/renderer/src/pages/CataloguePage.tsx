import { useEffect, useMemo, useRef, useState } from 'react'
import { GameCard } from '../components/GameCard'
import { PlusIcon, SearchIcon, StarIcon, XIcon } from '../components/Icons'
import { GENRES } from '../constants/genres'
import { useFocusShortcut } from '../hooks/useFocusShortcut'

type SortKey = 'title' | 'recent' | 'playtime'

interface CataloguePageProps {
  games: Game[]
  search: string
  onSearchChange: (value: string) => void
  onSelectGame: (game: Game) => void
  onAddGame: () => void
  onEditGame: (game: Game) => void
  onToggleFavorite: (game: Game) => void
}

// Giá trị đặc biệt cho game chưa có thể loại
const NO_GENRE = '__none__'

export function CataloguePage({
  games,
  search,
  onSearchChange,
  onSelectGame,
  onAddGame,
  onEditGame,
  onToggleFavorite
}: CataloguePageProps): React.JSX.Element {
  const [genre, setGenre] = useState<string | null>(null)
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('title')
  const searchRef = useRef<HTMLInputElement>(null)
  useFocusShortcut(searchRef)

  // Khi chuyển từ ô tìm kiếm ở topbar sang, giữ con trỏ trong ô tìm kiếm để gõ tiếp
  useEffect(() => {
    if (search) searchRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Thể loại hiển thị = danh sách cố định + thể loại cũ còn sót trong DB
  const genreOptions = useMemo(() => {
    const extra = games.map((g) => g.genre).filter((g): g is string => !!g && !GENRES.includes(g))
    return [...GENRES, ...new Set(extra)]
  }, [games])

  const genreCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of games) {
      const key = g.genre || NO_GENRE
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [games])

  const filteredGames = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const result = games.filter((g) => {
      if (keyword && !g.title.toLowerCase().includes(keyword)) return false
      if (favoriteOnly && g.is_favorite !== 1) return false
      if (genre === NO_GENRE && g.genre) return false
      if (genre && genre !== NO_GENRE && g.genre !== genre) return false
      return true
    })

    return result.sort((a, b) => {
      if (sort === 'recent') return (b.last_played ?? '').localeCompare(a.last_played ?? '')
      if (sort === 'playtime') return b.total_playtime - a.total_playtime
      return a.title.localeCompare(b.title)
    })
  }, [games, search, genre, favoriteOnly, sort])

  const hasFilter = !!search || !!genre || favoriteOnly

  const clearFilters = (): void => {
    onSearchChange('')
    setGenre(null)
    setFavoriteOnly(false)
  }

  return (
    <div className="catalogue">
      <div className="filter-bar">
        <label className="filter-search">
          <SearchIcon width={16} height={16} />
          <input
            ref={searchRef}
            placeholder="Tìm theo tên game..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {search && (
            <button className="filter-clear-input" onClick={() => onSearchChange('')}>
              <XIcon width={14} height={14} />
            </button>
          )}
          <kbd>Ctrl K</kbd>
        </label>

        <button
          className={`chip chip-outline ${favoriteOnly ? 'active-favorite' : ''}`}
          onClick={() => setFavoriteOnly((v) => !v)}
        >
          <StarIcon />
          Yêu thích
        </button>

        <select
          className="input sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="title">Tên A → Z</option>
          <option value="recent">Chơi gần đây</option>
          <option value="playtime">Thời gian chơi</option>
        </select>

        <button className="btn btn-primary btn-sm" onClick={onAddGame}>
          <PlusIcon width={16} height={16} /> Thêm game
        </button>
      </div>

      <div className="genre-filter">
        <button
          className={`genre-pill ${genre === null ? 'active' : ''}`}
          onClick={() => setGenre(null)}
        >
          Tất cả <span>{games.length}</span>
        </button>
        {genreOptions.map((g) => (
          <button
            key={g}
            className={`genre-pill ${genre === g ? 'active' : ''}`}
            onClick={() => setGenre(genre === g ? null : g)}
          >
            {g} <span>{genreCounts.get(g) ?? 0}</span>
          </button>
        ))}
        {genreCounts.has(NO_GENRE) && (
          <button
            className={`genre-pill ${genre === NO_GENRE ? 'active' : ''}`}
            onClick={() => setGenre(genre === NO_GENRE ? null : NO_GENRE)}
          >
            Chưa phân loại <span>{genreCounts.get(NO_GENRE)}</span>
          </button>
        )}
      </div>

      <div className="result-bar">
        <span>
          {filteredGames.length} / {games.length} game
        </span>
        {hasFilter && (
          <button className="link-button" onClick={clearFilters}>
            Xoá bộ lọc
          </button>
        )}
      </div>

      {filteredGames.length > 0 ? (
        <div className="game-grid">
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onSelect={onSelectGame}
              onEdit={onEditGame}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <SearchIcon width={40} height={40} />
          <h2>{games.length === 0 ? 'Thư viện đang trống' : 'Không tìm thấy game phù hợp'}</h2>
          <p>
            {games.length === 0
              ? 'Thêm game đầu tiên để bắt đầu.'
              : 'Thử đổi từ khoá hoặc bỏ bớt bộ lọc.'}
          </p>
        </div>
      )}
    </div>
  )
}
