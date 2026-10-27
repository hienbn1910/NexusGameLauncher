import { formatPlaytime, gameGradient, gameInitials } from '../utils/gameArt'
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

  return (
    <div className="game-card" onClick={() => onSelect(game)}>
      <div className="game-card-art" style={{ background: gameGradient(game.title) }}>
        <span className="game-card-initials">{gameInitials(game.title)}</span>

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

        <span className="game-card-play">
          <PlayIcon width={20} height={20} />
        </span>
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
