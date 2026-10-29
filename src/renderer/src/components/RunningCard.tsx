import { useNow } from '../hooks/useNow'
import { coverUrl, formatClock, gameGradient, posterUrl } from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'

interface RunningCardProps {
  game: Game
  info: RunningInfo
  onSelect: (game: Game) => void
}

// Thẻ game đang mở ở đầu hàng "Tiếp tục chơi": đồng hồ đếm thời gian chơi trong phiên,
// mới mở launcher thì chưa đếm
export function RunningCard({ game, info, onSelect }: RunningCardProps): React.JSX.Element {
  const now = useNow(1000)
  const art = coverUrl(game) ?? posterUrl(game)
  const startedAt = info.phase === 'playing' ? info.startedAt : null
  const playing = startedAt !== null

  return (
    <button
      className={`running-card ${playing ? '' : 'launcher-open'}`}
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
          {playing ? (
            <>
              <span className="pulse-dot" /> Đang chơi
            </>
          ) : (
            <>
              <span className="open-dot" /> Đang mở launcher
            </>
          )}
        </span>
        <span className="running-card-title">{game.title}</span>
        <span className="running-card-clock">
          {startedAt !== null ? formatClock(now - startedAt) : '--:--'}
        </span>
        <span className="running-card-hint">
          {playing ? 'Thời gian chơi phiên này' : 'Chưa vào game, chưa tính giờ'}
        </span>
      </span>
    </button>
  )
}
