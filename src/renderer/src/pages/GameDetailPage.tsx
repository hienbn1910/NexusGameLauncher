import { useEffect, useState } from 'react'
import { ContextMenu, type MenuItem } from '../components/ContextMenu'
import { GameIconArt } from '../components/GameIconArt'
import { MediaTab } from '../components/game-detail/MediaTab'
import { NotesTab } from '../components/game-detail/NotesTab'
import { OverviewTab } from '../components/game-detail/OverviewTab'
import { StatsTab } from '../components/game-detail/StatsTab'
import { FolderIcon, PencilIcon, StarIcon, TrashIcon } from '../components/Icons'
import { NewsCard } from '../components/NewsCard'
import { PlayButton } from '../components/PlayButton'
import { useArtColor } from '../hooks/useArtColor'
import { useAsyncData } from '../hooks/useAsyncData'
import { useLauncher } from '../hooks/useLauncher'
import { useNow } from '../hooks/useNow'
import {
  coverUrl,
  formatClock,
  formatPlaytime,
  formatRelative,
  gameGradient,
  gameInitials,
  logoUrl
} from '../utils/gameArt'

type DetailTab = 'overview' | 'stats' | 'news' | 'media' | 'notes'

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'stats', label: 'Thống kê' },
  { key: 'news', label: 'Tin tức' },
  { key: 'media', label: 'Ảnh & video' },
  { key: 'notes', label: 'Ghi chú' }
]

interface GameDetailPageProps {
  game: Game
  games: Game[] // Thứ tự giống sidebar, dùng cho phím ↑ ↓
  onBack: () => void
  onNavigate: (game: Game) => void
  onEdit: (game: Game) => void
  onDelete: (game: Game) => void
  onToggleFavorite: (game: Game) => void
  onGameUpdated: (game: Game) => void
  onNotify: (type: 'error' | 'info', text: string) => void
}

// Đồng hồ phiên chơi đang chạy cạnh nút Chơi
function SessionClock({ startedAt }: { startedAt: number }): React.JSX.Element {
  const now = useNow(1000)
  return <span className="detail-clock">{formatClock(now - startedAt)}</span>
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export function GameDetailPage({
  game,
  games,
  onBack,
  onNavigate,
  onEdit,
  onDelete,
  onToggleFavorite,
  onGameUpdated,
  onNotify
}: GameDetailPageProps): React.JSX.Element {
  const api = window.electronAPI.games
  const { runningIds } = useLauncher()
  const [tab, setTab] = useState<DetailTab>('overview')
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const ambient = useArtColor(game)

  const startedAt = runningIds.get(game.id)
  const cover = coverUrl(game)
  const logo = logoUrl(game)
  const appId = game.steam_app_id ?? game.source_id
  const isFavorite = game.is_favorite === 1

  // Dữ liệu theo game; thống kê tải lại khi tổng giờ chơi đổi (vừa chơi xong)
  const stats = useAsyncData(`${game.id}:${game.total_playtime}`, () => api.getGameStats(game.id))
  const details = useAsyncData(`${game.id}:${appId ?? ''}`, () => api.getSteamDetails(game.id))
  const install = useAsyncData(`${game.id}:${game.exe_path}`, () =>
    api.getInstallInfo(game.id, true)
  )
  const news = useAsyncData(tab === 'news' ? `${game.id}:${appId ?? ''}` : null, () =>
    window.electronAPI.news.getGame(game.id)
  )

  // ↑ ↓: chuyển sang game trước / sau trong thư viện
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || isTyping(e.target) || e.altKey || e.ctrlKey) return
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      const index = games.findIndex((g) => g.id === game.id)
      const next = games[index + (e.key === 'ArrowDown' ? 1 : -1)]
      if (!next) return
      e.preventDefault()
      onNavigate(next)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [games, game.id, onNavigate])

  const openFolder = async (): Promise<void> => {
    const error = await api.openFolder(game.id)
    if (error) onNotify('error', error)
  }

  const menuItems: (MenuItem | 'divider')[] = [
    { label: 'Mở thư mục game', icon: FolderIcon, onClick: openFolder, disabled: !install?.path },
    ...(appId
      ? [
          {
            label: 'Mở trang Steam',
            onClick: () => window.open(`https://store.steampowered.com/app/${appId}/`, '_blank')
          }
        ]
      : []),
    'divider',
    { label: 'Xoá khỏi thư viện', icon: TrashIcon, danger: true, onClick: () => onDelete(game) }
  ]

  return (
    <div
      className="detail"
      style={ambient ? ({ '--ambient': `rgb(${ambient})` } as React.CSSProperties) : undefined}
    >
      <div className="home-ambient" aria-hidden />

      <section className="detail-hero" style={{ background: gameGradient(game.title) }}>
        {/* Khối ảnh có view-transition-name: ảnh nhỏ ở sidebar "bay" thành ảnh lớn */}
        <div className="detail-hero-media">
          {cover ? (
            <img key={cover} className="detail-hero-cover" src={cover} alt="" draggable={false} />
          ) : (
            <GameIconArt
              game={game}
              className="detail-hero-icon"
              fallback={<span className="featured-watermark">{gameInitials(game.title)}</span>}
            />
          )}
        </div>

        <button className="detail-back btn btn-glass btn-xs" onClick={onBack}>
          ← Quay lại
        </button>

        <div className="detail-hero-content" key={game.id}>
          {logo && failedLogo !== logo ? (
            <img
              className="featured-logo"
              src={logo}
              alt={game.title}
              draggable={false}
              onError={() => setFailedLogo(logo)}
            />
          ) : (
            <h1 className="featured-title">{game.title}</h1>
          )}

          <div className="detail-actions">
            <PlayButton game={game} label={game.last_played ? 'Tiếp tục chơi' : 'Chơi ngay'} />
            {startedAt !== undefined && <SessionClock startedAt={startedAt} />}
            <button
              className={`btn btn-glass detail-icon-btn ${isFavorite ? 'favorite' : ''}`}
              title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
              onClick={() => onToggleFavorite(game)}
            >
              <StarIcon width={16} height={16} />
            </button>
            <button
              className="btn btn-glass detail-icon-btn"
              title="Sửa game"
              onClick={() => onEdit(game)}
            >
              <PencilIcon width={16} height={16} />
            </button>
            <button
              className="btn btn-glass detail-icon-btn"
              title="Mở thư mục game"
              disabled={!install?.path}
              onClick={openFolder}
            >
              <FolderIcon width={16} height={16} />
            </button>
            <button
              className="btn btn-glass detail-icon-btn"
              title="Thêm"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setMenu({ x: rect.left, y: rect.bottom + 6 })
              }}
            >
              ⋯
            </button>
          </div>

          <div className="featured-meta">
            <span>{formatPlaytime(game.total_playtime)}</span>
            {game.last_played && <span>Chơi lần cuối {formatRelative(game.last_played)}</span>}
            {game.source === 'steam' && <span className="tag">Steam</span>}
            {game.genre && <span className="tag">{game.genre}</span>}
          </div>
        </div>
      </section>

      <div className="detail-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`detail-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === 'notes' && game.notes && <span className="detail-tab-dot" />}
          </button>
        ))}
        <span className="detail-nav-hint">↑ ↓ chuyển game</span>
      </div>

      <div className="detail-body">
        {tab === 'overview' && (
          <OverviewTab
            game={game}
            details={details}
            install={install}
            onOpenFolder={openFolder}
            onShowMedia={() => setTab('media')}
          />
        )}
        {tab === 'stats' && <StatsTab game={game} stats={stats} />}
        {tab === 'news' &&
          (!news ? (
            <p className="detail-muted">Đang tải tin tức...</p>
          ) : !news.ok ? (
            <p className="detail-muted">Không tải được tin: {news.error}</p>
          ) : news.data.items.length === 0 ? (
            <p className="detail-muted">Chưa có tin tức nào gần đây về game này.</p>
          ) : (
            <div className="detail-news">
              {news.data.steamBlocked && (
                <p className="news-status warn">Không vào được Steam, đang hiện tin từ báo chí.</p>
              )}
              <div className="detail-news-grid">
                {news.data.items.map((item) => (
                  <NewsCard key={item.id} item={item} game={game} />
                ))}
              </div>
            </div>
          ))}
        {tab === 'media' && <MediaTab details={details} appId={appId} />}
        {tab === 'notes' && <NotesTab key={game.id} game={game} onSaved={onGameUpdated} />}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}
    </div>
  )
}
