import { useEffect, useRef, useState } from 'react'
import { useLauncher } from '../hooks/useLauncher'
import { useWheelScroll } from '../hooks/useWheelScroll'
import {
  coverUrl,
  formatPlaytime,
  formatRelative,
  gameAccent,
  gameGradient,
  gameInitials,
  logoUrl
} from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'
import { ClockIcon, PencilIcon, StarIcon } from './Icons'
import { PlayButton } from './PlayButton'

// Thời gian mỗi game hiển thị trước khi tự chuyển
const ROTATE_MS = 8000

interface FeaturedBannerProps {
  game: Game
  // Các game xoay vòng trên banner (rỗng/1 game => không xoay)
  rotation: Game[]
  onFeature: (game: Game) => void
  onEdit: (game: Game) => void
  onOpen: (game: Game) => void // Mở trang chi tiết game
}

export function FeaturedBanner({
  game,
  rotation,
  onFeature,
  onEdit,
  onOpen
}: FeaturedBannerProps): React.JSX.Element {
  const cover = coverUrl(game)
  const logo = logoUrl(game)
  const { runningIds } = useLauncher()
  const runningInfo = runningIds.get(game.id)
  const running = runningInfo?.phase === 'playing'
  const [paused, setPaused] = useState(false)
  // Logo lỗi (file bị xoá...) => hiện tên game dạng chữ
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const showLogo = !!logo && failedLogo !== logo

  const canRotate = rotation.length > 1
  const index = rotation.findIndex((g) => g.id === game.id)
  // Dải ảnh nhỏ chỉ hiện 3 game, lăn chuột để cuộn xem game khác
  const thumbsRef = useRef<HTMLDivElement>(null)
  useWheelScroll(thumbsRef, canRotate)

  // Đổi game (tự xoay vòng / bấm) => cuộn ảnh nhỏ của game đó vào giữa dải
  useEffect(() => {
    const strip = thumbsRef.current
    const active = strip?.children[index] as HTMLElement | undefined
    if (!strip || !active) return
    const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2
    strip.scrollTo({ left, behavior: 'smooth' })
  }, [index])

  // Tự chuyển sang game tiếp theo, dừng khi rê chuột vào banner
  useEffect(() => {
    if (!canRotate || paused) return
    const timer = setTimeout(() => {
      onFeature(rotation[(index + 1) % rotation.length])
    }, ROTATE_MS)
    return () => clearTimeout(timer)
  }, [canRotate, paused, index, rotation, onFeature])

  const badge = running
    ? 'Đang chơi'
    : runningInfo
      ? 'Đang mở'
      : game.last_played
        ? 'Tiếp tục chơi'
        : game.is_favorite === 1
          ? 'Yêu thích'
          : 'Nổi bật'

  return (
    <section
      className={`featured ${paused ? 'paused' : ''} ${canRotate ? 'has-thumbs' : ''}`}
      style={{ background: gameGradient(game.title) }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {cover ? (
        // key => ảnh mới mờ dần lên mỗi khi đổi game
        <img key={cover} className="featured-cover" src={cover} alt="" draggable={false} />
      ) : (
        <GameIconArt
          key={game.id}
          game={game}
          className="featured-icon"
          backdrop
          fallback={
            <>
              <span className="featured-watermark">{gameInitials(game.title)}</span>
              <div className="featured-glow" style={{ background: gameAccent(game.title) }} />
            </>
          }
        />
      )}

      <div className="featured-content" key={game.id}>
        <span className="featured-badge">
          {running && <span className="pulse-dot" />}
          {!running && runningInfo && <span className="open-dot" />}
          {!runningInfo && game.is_favorite === 1 && <StarIcon width={12} height={12} />}
          {badge}
        </span>

        {showLogo ? (
          <img
            className="featured-logo"
            src={logo}
            alt={game.title}
            draggable={false}
            onError={() => setFailedLogo(logo)}
          />
        ) : (
          <h2 className="featured-title">{game.title}</h2>
        )}

        <div className="featured-meta">
          {game.source === 'steam' && <span className="tag">Steam</span>}
          {game.genre && <span className="tag">{game.genre}</span>}
          <span>
            <ClockIcon width={14} height={14} /> {formatPlaytime(game.total_playtime)}
          </span>
          {game.last_played && <span>Chơi lần cuối {formatRelative(game.last_played)}</span>}
        </div>
        <div className="featured-actions">
          <PlayButton game={game} label={game.last_played ? 'Tiếp tục chơi' : 'Chơi ngay'} />
          <button className="btn btn-glass" onClick={() => onOpen(game)}>
            Xem chi tiết
          </button>
          <button className="btn btn-glass" onClick={() => onEdit(game)} title="Sửa game">
            <PencilIcon width={16} height={16} />
          </button>
        </div>
      </div>

      {canRotate && (
        <div className="featured-thumbs" ref={thumbsRef}>
          {rotation.map((g) => {
            const thumb = coverUrl(g)
            const active = g.id === game.id
            return (
              <button
                key={g.id}
                className={`featured-thumb ${active ? 'active' : ''}`}
                title={g.title}
                style={{ background: gameGradient(g.title) }}
                onClick={() => onFeature(g)}
              >
                {thumb ? (
                  <img src={thumb} alt="" draggable={false} />
                ) : (
                  // Game ngoài Steam: nền icon phóng to làm mờ + icon ở giữa (như ảnh bìa)
                  <GameIconArt
                    game={g}
                    className="featured-thumb-icon"
                    backdrop
                    fallback={<span>{gameInitials(g.title)}</span>}
                  />
                )}
                {/* Thanh chạy cho biết còn bao lâu thì chuyển game; rê chuột vào banner thì
                    ẩn, rời chuột thì chạy lại từ đầu cùng với bộ hẹn giờ */}
                {active && !paused && (
                  <span
                    key={game.id}
                    className="featured-progress"
                    style={{ animationDuration: `${ROTATE_MS}ms` }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
