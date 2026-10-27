import { formatPlaytime, gameGradient, gameInitials } from '../utils/gameArt'
import { ClockIcon, PlayIcon } from './Icons'

interface GameCardProps {
  game: Game
  onSelect: (game: Game) => void
}

export function GameCard({ game, onSelect }: GameCardProps): React.JSX.Element {
  return (
    <button className="game-card" onClick={() => onSelect(game)}>
      <div className="game-card-art" style={{ background: gameGradient(game.title) }}>
        <span className="game-card-initials">{gameInitials(game.title)}</span>
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
    </button>
  )
}
