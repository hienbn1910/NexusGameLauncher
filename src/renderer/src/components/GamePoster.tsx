import { useState } from 'react'
import { useLauncher } from '../hooks/useLauncher'
import { coverUrl, formatPlaytime, gameGradient, posterUrl } from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'
import { PencilIcon, PlayIcon, StarIcon } from './Icons'

interface GamePosterProps {
  game: Game
  onSelect: (game: Game) => void
  onEdit: (game: Game) => void
  onToggleFavorite: (game: Game) => void
  // Dòng chữ nhỏ dưới ảnh (vd "3 ngày trước") - dùng trên các kệ ở trang chủ
  caption?: string
  // Nhãn nhỏ góc dưới ảnh (vd "Có cập nhật")
  badge?: string
}

// Ô ảnh bìa dọc 2:3 kiểu thư viện Steam.
// Chưa có ảnh dọc => dùng ảnh ngang đặt giữa nền mờ,
// không có ảnh nào (game ngoài Steam) => icon file exe + tên game trên nền gradient
export function GamePoster({
  game,
  onSelect,
  onEdit,
  onToggleFavorite,
  caption,
  badge
}: GamePosterProps): React.JSX.Element {
  const { runningIds, launchingId, launch } = useLauncher()
  const running = runningIds.has(game.id)
  const launching = launchingId === game.id
  const isFavorite = game.is_favorite === 1
  const poster = posterUrl(game)
  const cover = coverUrl(game)
  const [failedPoster, setFailedPoster] = useState<string | null>(null)
  const showPoster = !!poster && failedPoster !== poster

  return (
    <div
      className={`poster ${running ? 'running' : ''}`}
      title={`${game.title} · ${formatPlaytime(game.total_playtime)}`}
      onClick={() => onSelect(game)}
    >
      <div className="poster-art" style={{ background: gameGradient(game.title) }}>
        {showPoster ? (
          <img
            className="poster-image"
            src={poster}
            alt=""
            draggable={false}
            onError={() => setFailedPoster(poster)}
          />
        ) : (
          <div className="poster-fallback">
            {cover ? (
              <>
                <img className="poster-fallback-bg" src={cover} alt="" draggable={false} />
                <img className="poster-fallback-cover" src={cover} alt="" draggable={false} />
                <span className="poster-fallback-title">{game.title}</span>
              </>
            ) : (
              // Tên game đã có ở chú thích bên dưới nên chỉ hiện khi không có icon
              <GameIconArt
                game={game}
                className="poster-icon"
                backdrop
                fallback={<span className="poster-fallback-title">{game.title}</span>}
              />
            )}
          </div>
        )}

        {running && (
          <span className="running-badge">
            <span className="pulse-dot" /> Đang chạy
          </span>
        )}
        {badge && !running && <span className="poster-badge">{badge}</span>}

        <div className="poster-actions">
          <button
            className={`card-action ${isFavorite ? 'favorite' : ''}`}
            title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(game)
            }}
          >
            <StarIcon width={14} height={14} />
          </button>
          <button
            className="card-action"
            title="Sửa game"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(game)
            }}
          >
            <PencilIcon width={14} height={14} />
          </button>
        </div>

        {!running && (
          <button
            className={`poster-play ${launching ? 'launching' : ''}`}
            disabled={launching}
            onClick={(e) => {
              e.stopPropagation()
              launch(game)
            }}
          >
            <PlayIcon width={16} height={16} />
            {launching ? 'Đang mở...' : 'Chơi'}
          </button>
        )}
      </div>
      {caption && (
        <div className="poster-caption">
          <span className="poster-caption-title">{game.title}</span>
          <span className="poster-caption-sub">{caption}</span>
        </div>
      )}
    </div>
  )
}
