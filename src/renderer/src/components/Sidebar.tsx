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
  type IconComponent
} from './Icons'
import { Avatar } from './Avatar'
import { useOnline } from '../hooks/useOnline'
import { DEFAULT_PROFILE_NAME } from '../utils/avatar'
import { runningLabel } from '../utils/gameArt'

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
  profile: UserProfile | null
  onEditProfile: () => void
}

// Trạng thái dưới tên: đang chơi / đang mở game nào / mất mạng / trực tuyến
function ProfileStatus({ games }: { games: Game[] }): React.JSX.Element {
  const { runningIds } = useLauncher()
  const online = useOnline()
  const playing = games.filter((g) => runningIds.get(g.id)?.phase === 'playing')
  const open = games.filter((g) => runningIds.get(g.id)?.phase === 'launcher')
  // Ưu tiên hiện game đang chơi thật
  const [list, verb, className] =
    playing.length > 0 ? [playing, 'Đang chơi', 'playing'] : [open, 'Đang mở', 'launcher-open']

  if (list.length > 0) {
    const label = list.length > 1 ? `${list[0].title} +${list.length - 1}` : list[0].title
    return (
      <span className={`profile-status ${className}`} title={list.map((g) => g.title).join(', ')}>
        <span className="status-dot" />{' '}
        <span className="profile-status-text">
          {verb} {label}
        </span>
      </span>
    )
  }
  return (
    <span className={`profile-status ${online ? '' : 'offline'}`}>
      <span className="status-dot" /> {online ? 'Trực tuyến' : 'Ngoại tuyến'}
    </span>
  )
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
  onOpenFolder,
  profile,
  onEditProfile
}: SidebarProps): React.JSX.Element {
  const [filter, setFilter] = useState('')
  const { runningIds, launch } = useLauncher()
  const [menu, setMenu] = useState<{ game: Game; x: number; y: number } | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const menuItems = (game: Game): (MenuItem | 'divider')[] => [
    {
      label: runningLabel(runningIds.get(game.id)) ?? 'Chơi',
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
      <button className="sidebar-profile" title="Sửa hồ sơ" onClick={onEditProfile}>
        <Avatar
          name={profile?.displayName ?? DEFAULT_PROFILE_NAME}
          type={profile?.avatar.type ?? 'initials'}
          value={profile?.avatar.value ?? null}
        />
        <span className="profile-info">
          <span className="profile-name">{profile?.displayName ?? DEFAULT_PROFILE_NAME}</span>
          <ProfileStatus games={games} />
        </span>
        <span className="profile-edit">
          <PencilIcon width={15} height={15} />
        </span>
      </button>

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
                {runningIds.get(game.id)?.phase === 'playing' && (
                  <span className="pulse-dot" title="Đang chơi" />
                )}
                {runningIds.get(game.id)?.phase === 'launcher' && (
                  <span className="open-dot" title="Đang mở launcher" />
                )}
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
