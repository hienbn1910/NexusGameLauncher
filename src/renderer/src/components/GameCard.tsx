import { useLauncher } from '../hooks/useLauncher'
import { coverUrl, formatPlaytime, gameGradient, gameInitials } from '../utils/gameArt'
import { ClockIcon, PencilIcon, PlayIcon, StarIcon } from './Icons'

interface GameCardProps {
  game: Game
  onSelect: (game: Game) => void
  onEdit: (game: Game) => void
  onToggleFavorite: (game: Game) => void
}

export function GameCard({
  game,
  onSelect,
  onEdit,
  onToggleFavorite
}: GameCardProps): React.JSX.Element {
  const isFavorite = game.is_favorite === 1
  const { runningIds, launchingId, launch } = useLauncher()
  const running = runningIds.has(game.id)
  const launching = launchingId === game.id
  const cover = coverUrl(game)

  return (
    <div className={`game-card ${running ? 'running' : ''}`} onClick={() => onSelect(game)}>
      {running && (
        <span className="running-badge">
          <span className="pulse-dot" /> Đang chạy
        </span>
      )}
      <div className="game-card-art" style={{ background: gameGradient(game.title) }}>
        {cover ? (
          <img className="game-card-cover" src={cover} alt="" draggable={false} />
        ) : (
          <span className="game-card-initials">{gameInitials(game.title)}</span>
        )}

        <div className="game-card-actions">
          <button
            className={`card-action ${isFavorite ? 'favorite' : ''}`}
            title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite(game)
            }}
          >
            <StarIcon width={15} height={15} />
          </button>
          <button
            className="card-action"
            title="Sửa game"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(game)
            }}
          >
            <PencilIcon width={15} height={15} />
          </button>
        </div>

        {!running && (
          <button
            className={`game-card-play ${launching ? 'launching' : ''}`}
            title="Chơi"
            disabled={launching}
            onClick={(e) => {
              e.stopPropagation()
              launch(game)
            }}
          >
            <PlayIcon width={20} height={20} />
          </button>
        )}
      </div>
      <div className="game-card-body">
        <span className="game-card-title">{game.title}</span>
        <span className="game-card-meta">
          <ClockIcon width={13} height={13} />
          {formatPlaytime(game.total_playtime)}
          {game.genre && <span className="tag">{game.genre}</span>}
        </span>
      </div>
    </div>
  )
}
