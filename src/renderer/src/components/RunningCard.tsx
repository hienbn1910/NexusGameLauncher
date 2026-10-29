import { useNow } from '../hooks/useNow'
import { coverUrl, formatClock, gameGradient, posterUrl } from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'

interface RunningCardProps {
  game: Game
  startedAt: number
  onSelect: (game: Game) => void
}

// Thẻ game đang chạy ở đầu hàng "Tiếp tục chơi": đồng hồ đếm thời gian phiên chơi
export function RunningCard({ game, startedAt, onSelect }: RunningCardProps): React.JSX.Element {
  const now = useNow(1000)
  const art = coverUrl(game) ?? posterUrl(game)

  return (
    <button
      className="running-card"
      style={{ background: gameGradient(game.title) }}
      onClick={() => onSelect(game)}
    >
      {art ? (
        <img className="running-card-bg" src={art} alt="" draggable={false} />
      ) : (
        <GameIconArt game={game} className="running-card-icon" fallback={null} />
      )}
      <span className="running-card-body">
        <span className="running-card-status">
          <span className="pulse-dot" /> Đang chơi
        </span>
        <span className="running-card-title">{game.title}</span>
        <span className="running-card-clock">{formatClock(now - startedAt)}</span>
        <span className="running-card-hint">Phiên chơi hiện tại</span>
      </span>
    </button>
  )
}
