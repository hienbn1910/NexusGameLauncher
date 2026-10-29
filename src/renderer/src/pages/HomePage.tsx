import { useMemo, useState } from 'react'
import { FeaturedBanner } from '../components/FeaturedBanner'
import { GamePoster } from '../components/GamePoster'
import { ClockIcon, LayersIcon, PlusIcon, ShuffleIcon, StarIcon } from '../components/Icons'
import { NewsSection } from '../components/NewsSection'
import { PickGameModal } from '../components/PickGameModal'
import { RunningCard } from '../components/RunningCard'
import { Shelf } from '../components/Shelf'
import { StatsPanel } from '../components/StatsPanel'
import { useArtColor } from '../hooks/useArtColor'
import { useLauncher } from '../hooks/useLauncher'
import { useNow } from '../hooks/useNow'
import { formatRelative } from '../utils/gameArt'

const DAY_MS = 86_400_000
const STALE_DAYS = 30
const NEW_DAYS = 14
const MAX_ROTATION = 6
const MAX_SHELF = 14
// Tin cập nhật trong khoảng này thì gắn nhãn "Có cập nhật" lên ảnh bìa
const UPDATE_BADGE_DAYS = 7

interface HomePageProps {
  games: Game[]
  featured: Game | null
  stats: PlayStats | null
  onFeature: (game: Game) => void
  onOpenSettings: () => void
  onSelectGame: (game: Game) => void
  onAddGame: () => void
  onEditGame: (game: Game) => void
  onToggleFavorite: (game: Game) => void
}

const byLastPlayed = (a: Game, b: Game): number =>
  (b.last_played ?? '').localeCompare(a.last_played ?? '')

export function HomePage({
  games,
  featured,
  stats,
  onFeature,
  onOpenSettings,
  onSelectGame,
  onAddGame,
  onEditGame,
  onToggleFavorite
}: HomePageProps): React.JSX.Element {
  const { runningIds } = useLauncher()
  const [showPicker, setShowPicker] = useState(false)
  // Tin của game trong thư viện (do NewsSection tải) để gắn nhãn "Có cập nhật"
  const [news, setNews] = useState<NewsItem[]>([])
  // Cập nhật chữ "x phút trước" mỗi phút
  const now = useNow(60_000)
  const ambient = useArtColor(featured)

  const recent = useMemo(() => games.filter((g) => g.last_played).sort(byLastPlayed), [games])

  // Game xoay vòng trên banner: chơi gần đây + yêu thích, thiếu thì thêm game khác
  const rotation = useMemo(() => {
    const picked = new Map<string, Game>()
    for (const g of [
      ...recent.slice(0, 3),
      ...games.filter((g) => g.is_favorite === 1),
      ...recent,
      ...games
    ]) {
      if (picked.size >= MAX_ROTATION) break
      picked.set(g.id, g)
    }
    const list = [...picked.values()]
    // Game đang chọn (vd bấm từ sidebar) luôn có trong vòng xoay
    if (featured && !picked.has(featured.id)) list.unshift(featured)
    return list.slice(0, MAX_ROTATION)
  }, [games, recent, featured])

  const shelves = useMemo(() => {
    const favorites = games.filter((g) => g.is_favorite === 1)
    const stale = recent
      .filter((g) => now - new Date(g.last_played!).getTime() > STALE_DAYS * DAY_MS)
      .reverse()
    const unplayed = games.filter((g) => !g.last_played)
    const added = games
      .filter((g) => g.created_at && now - new Date(g.created_at).getTime() < NEW_DAYS * DAY_MS)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    // Thể loại có từ 3 game trở lên
    const genres = new Map<string, Game[]>()
    for (const g of games) {
      if (g.genre) genres.set(g.genre, [...(genres.get(g.genre) ?? []), g])
    }
    const genreShelves = [...genres].filter(([, list]) => list.length >= 3)

    return { favorites, stale, unplayed, added, genreShelves }
  }, [games, recent, now])

  // Game vừa có bản cập nhật
  const updatedIds = useMemo(
    () =>
      new Set(
        news
          .filter((n) => n.gameId && n.isPatch && now - n.date < UPDATE_BADGE_DAYS * DAY_MS)
          .map((n) => n.gameId)
      ),
    [news, now]
  )

  if (games.length === 0) {
    return (
      <div className="empty-state">
        <LayersIcon width={48} height={48} />
        <h2>Chưa có game nào</h2>
        <p>Thêm game vào thư viện để bắt đầu.</p>
        <button className="btn btn-primary" onClick={onAddGame}>
          <PlusIcon width={16} height={16} /> Thêm game
        </button>
      </div>
    )
  }

  const running = games.filter((g) => runningIds.has(g.id))
  const continueGames = recent.filter((g) => !runningIds.has(g.id)).slice(0, MAX_SHELF)

  const poster = (game: Game, caption: string): React.JSX.Element => (
    <GamePoster
      key={game.id}
      game={game}
      caption={caption}
      badge={updatedIds.has(game.id) ? 'Có cập nhật' : undefined}
      onSelect={onSelectGame}
      onEdit={onEditGame}
      onToggleFavorite={onToggleFavorite}
    />
  )

  return (
    <div
      className="home"
      style={ambient ? ({ '--ambient': `rgb(${ambient})` } as React.CSSProperties) : undefined}
    >
      {/* Lớp màu phía sau, đổi theo ảnh của game đang nổi bật */}
      <div className="home-ambient" aria-hidden />

      {featured && (
        <FeaturedBanner
          game={featured}
          rotation={rotation}
          onFeature={onFeature}
          onEdit={onEditGame}
          onOpen={onSelectGame}
        />
      )}

      <StatsPanel stats={stats} games={games} onSelectGame={onSelectGame} />

      <Shelf
        title="Tiếp tục chơi"
        icon={ClockIcon}
        action={
          <button className="chip chip-accent" onClick={() => setShowPicker(true)}>
            <ShuffleIcon /> Hôm nay chơi gì?
          </button>
        }
      >
        {running.map((g) => (
          <RunningCard
            key={g.id}
            game={g}
            startedAt={runningIds.get(g.id) ?? now}
            onSelect={onSelectGame}
          />
        ))}
        {continueGames.map((g) => poster(g, formatRelative(g.last_played, now)))}
        {running.length === 0 && continueGames.length === 0 && (
          <p className="shelf-empty">
            Chưa chơi game nào. Bấm “Hôm nay chơi gì?” để chọn ngẫu nhiên!
          </p>
        )}
      </Shelf>

      {shelves.favorites.length > 0 && (
        <Shelf title="Yêu thích" icon={StarIcon} count={shelves.favorites.length}>
          {shelves.favorites.map((g) => poster(g, formatRelative(g.last_played, now)))}
        </Shelf>
      )}

      <NewsSection games={games} onLibraryNews={setNews} onOpenSettings={onOpenSettings} />

      {shelves.stale.length > 0 && (
        <Shelf title="Lâu rồi chưa chơi" count={shelves.stale.length}>
          {shelves.stale.map((g) => poster(g, `Lần cuối ${formatRelative(g.last_played, now)}`))}
        </Shelf>
      )}

      {shelves.unplayed.length > 0 && (
        <Shelf title="Chưa từng chơi" count={shelves.unplayed.length}>
          {shelves.unplayed.map((g) => poster(g, g.genre ?? 'Chưa phân loại'))}
        </Shelf>
      )}

      {shelves.added.length > 0 && (
        <Shelf title="Mới thêm gần đây" count={shelves.added.length}>
          {shelves.added.map((g) =>
            poster(g, `Thêm ${formatRelative(g.created_at, now).toLowerCase()}`)
          )}
        </Shelf>
      )}

      {shelves.genreShelves.map(([genre, list]) => (
        <Shelf key={genre} title={genre} count={list.length}>
          {list.map((g) => poster(g, formatRelative(g.last_played, now)))}
        </Shelf>
      ))}

      {showPicker && (
        <PickGameModal
          games={games}
          onClose={() => setShowPicker(false)}
          onSelect={(g) => {
            setShowPicker(false)
            onSelectGame(g)
          }}
        />
      )}
    </div>
  )
}
