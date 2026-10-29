import { useCallback, useMemo, useState } from 'react'
import { useLauncher } from '../hooks/useLauncher'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { GameThumb } from './GameThumb'
import {
  DownloadIcon,
  FolderIcon,
  GearIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
  type IconComponent
} from './Icons'

// 'game' = trang chi tiết game (không có trong menu điều hướng)
export type PageKey = 'home' | 'catalogue' | 'downloads' | 'settings' | 'game'

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
  onEditGame: (game: Game) => void
  onDeleteGame: (game: Game) => void
  onToggleFavorite: (game: Game) => void
  onOpenFolder: (game: Game) => void
}

export function Sidebar({
  page,
  onNavigate,
  games,
  selectedGameId,
  onSelectGame,
  onAddGame,
  onEditGame,
  onDeleteGame,
  onToggleFavorite,
  onOpenFolder
}: SidebarProps): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const { runningIds, launch } = useLauncher()
  const [menu, setMenu] = useState<{ game: Game; x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const menuItems = (game: Game): (MenuItem | 'divider')[] => [
    {
      label: runningIds.has(game.id) ? 'Đang chạy' : 'Chơi',
      icon: PlayIcon,
      disabled: runningIds.has(game.id),
      onClick: () => launch(game)
    },
    { label: 'Xem chi tiết', icon: GridIcon, onClick: () => onSelectGame(game) },
    {
      label: game.is_favorite === 1 ? 'Bỏ yêu thích' : 'Yêu thích',
      icon: StarIcon,
      onClick: () => onToggleFavorite(game)
    },
    { label: 'Sửa game', icon: PencilIcon, onClick: () => onEditGame(game) },
    { label: 'Mở thư mục game', icon: FolderIcon, onClick: () => onOpenFolder(game) },
    'divider',
    { label: 'Xoá khỏi thư viện', icon: TrashIcon, danger: true, onClick: () => onDeleteGame(game) }
  ]

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
                title="Bấm: xem chi tiết · Bấm đúp: chơi · Chuột phải: thêm tuỳ chọn"
                onClick={() => onSelectGame(game)}
                onDoubleClick={() => {
                  if (!runningIds.has(game.id)) launch(game)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ game, x: e.clientX, y: e.clientY })
                }}
              >
                <GameThumb game={game} />
                <span className="library-title">{game.title}</span>
                {runningIds.has(game.id) && <span className="pulse-dot" title="Đang chạy" />}
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

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.game)} onClose={closeMenu} />
      )}
    </aside>
  )
}
