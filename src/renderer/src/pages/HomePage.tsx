import { useMemo, useState } from 'react'
import { FeaturedBanner } from '../components/FeaturedBanner'
import { GameCard } from '../components/GameCard'
import {
  ClockIcon,
  LayersIcon,
  PlusIcon,
  ShuffleIcon,
  StarIcon,
  type IconComponent
} from '../components/Icons'

type TabKey = 'recent' | 'favorite' | 'all'

const TABS: { key: TabKey; label: string; icon: IconComponent }[] = [
  { key: 'recent', label: 'Chơi gần đây', icon: ClockIcon },
  { key: 'favorite', label: 'Yêu thích', icon: StarIcon },
  { key: 'all', label: 'Tất cả', icon: LayersIcon }
]

interface HomePageProps {
  games: Game[]
  featured: Game | null
  onShuffle: () => void
  onSelectGame: (game: Game) => void
  onAddGame: () => void
}

export function HomePage({
  games,
  featured,
  onShuffle,
  onSelectGame,
  onAddGame
}: HomePageProps): React.JSX.Element {
  const [tab, setTab] = useState<TabKey>('recent')

  const visibleGames = useMemo(() => {
    switch (tab) {
      case 'recent':
        return games
          .filter((g) => g.last_played)
          .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))
      case 'favorite':
        return games.filter((g) => g.is_favorite === 1)
      default:
        return games
    }
  }, [games, tab])

  const activeTab = TABS.find((t) => t.key === tab)!

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

  return (
    <div className="home">
      {featured && <FeaturedBanner game={featured} onPlay={onSelectGame} />}

      <div className="tab-bar">
        <div className="tabs">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`chip ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <button className="chip chip-accent" onClick={onShuffle}>
          <ShuffleIcon />
          Ngẫu nhiên
        </button>
      </div>

      <h3 className="section-title">
        <activeTab.icon />
        {activeTab.label}
        <span className="section-count">{visibleGames.length}</span>
      </h3>

      {visibleGames.length > 0 ? (
        <div className="game-grid">
          {visibleGames.map((game) => (
            <GameCard key={game.id} game={game} onSelect={onSelectGame} />
          ))}
        </div>
      ) : (
        <p className="section-empty">Không có game nào trong mục này.</p>
      )}
    </div>
  )
}
