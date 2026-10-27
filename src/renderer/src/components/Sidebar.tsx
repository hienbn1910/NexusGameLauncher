import { useMemo, useState } from 'react'
import { gameGradient, gameInitials } from '../utils/gameArt'
import {
  DownloadIcon,
  GearIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  PlusIcon,
  UsersIcon,
  type IconComponent
} from './Icons'

export type PageKey = 'home' | 'catalogue' | 'downloads' | 'settings'

const NAV_ITEMS: { key: PageKey; label: string; icon: IconComponent }[] = [
  { key: 'home', label: 'Trang chủ', icon: HomeIcon },
  { key: 'catalogue', label: 'Kho game', icon: GridIcon },
  { key: 'downloads', label: 'Tải xuống', icon: DownloadIcon },
  { key: 'settings', label: 'Cài đặt', icon: GearIcon }
]

interface SidebarProps {
  page: PageKey
  onNavigate: (page: PageKey) => void
  games: Game[]
  selectedGameId: string | null
  onSelectGame: (game: Game) => void
  onAddGame: () => void
}

export function Sidebar({
  page,
  onNavigate,
  games,
  selectedGameId,
  onSelectGame,
  onAddGame
}: SidebarProps): React.JSX.Element {
  const [filter, setFilter] = useState('')

  const filteredGames = useMemo(() => {
    const keyword = filter.trim().toLowerCase()
    if (!keyword) return games
    return games.filter((g) => g.title.toLowerCase().includes(keyword))
  }, [games, filter])

  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <div className="avatar">P</div>
        <div className="profile-info">
          <span className="profile-name">Player</span>
          <span className="profile-status">
            <span className="status-dot" /> Trực tuyến
          </span>
        </div>
        <button className="icon-button" title="Bạn bè">
          <UsersIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${page === key ? 'active' : ''}`}
            onClick={() => onNavigate(key)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-library">
        <div className="library-header">
          <span>Thư viện</span>
          <span className="library-count">{games.length}</span>
          <button className="library-add" onClick={onAddGame} title="Thêm game">
            <PlusIcon width={14} height={14} />
          </button>
        </div>
        <input
          className="library-filter"
          placeholder="Lọc thư viện..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <ul className="library-list">
          {filteredGames.map((game) => (
            <li key={game.id}>
              <button
                className={`library-item ${selectedGameId === game.id ? 'active' : ''}`}
                onClick={() => onSelectGame(game)}
              >
                <span className="library-thumb" style={{ background: gameGradient(game.title) }}>
                  {gameInitials(game.title)}
                </span>
                <span className="library-title">{game.title}</span>
              </button>
            </li>
          ))}
          {filteredGames.length === 0 && (
            <li className="library-empty">
              {games.length === 0 ? 'Thư viện đang trống' : 'Không tìm thấy game'}
            </li>
          )}
        </ul>
      </div>

      <button className="sidebar-help">
        <HelpIcon />
        <span>Trợ giúp</span>
      </button>
    </aside>
  )
}
