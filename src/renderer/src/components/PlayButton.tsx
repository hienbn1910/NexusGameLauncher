import { useLauncher } from '../hooks/useLauncher'
import { PlayIcon } from './Icons'

interface PlayButtonProps {
  game: Game
}

// Nút "Chơi ngay" lớn trên banner, tự đổi trạng thái khi game đang khởi động/đang chạy
export function PlayButton({ game }: PlayButtonProps): React.JSX.Element {
  const { runningIds, launchingId, launch } = useLauncher()
  const running = runningIds.has(game.id)
  const launching = launchingId === game.id

  if (running) {
    return (
      <button className="btn btn-running" disabled>
        <span className="pulse-dot" /> Đang chạy
      </button>
    )
  }

  return (
    <button className="btn btn-primary" disabled={launching} onClick={() => launch(game)}>
      <PlayIcon width={16} height={16} />
      {launching ? 'Đang mở...' : 'Chơi ngay'}
    </button>
  )
}
