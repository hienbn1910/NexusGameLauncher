import { useLauncher } from '../hooks/useLauncher'
import { PlayIcon } from './Icons'

interface PlayButtonProps {
  game: Game
  label?: string
}

// Nút "Chơi ngay" lớn trên banner, tự đổi trạng thái khi game đang khởi động/đang chạy
export function PlayButton({ game, label = 'Chơi ngay' }: PlayButtonProps): React.JSX.Element {
  const { runningIds, launchingId, launch } = useLauncher()
  const running = runningIds.get(game.id)
  const launching = launchingId === game.id

  if (running?.phase === 'playing') {
    return (
      <button className="btn btn-running" disabled>
        <span className="pulse-dot" /> Đang chạy
      </button>
    )
  }
  // Mới mở launcher, chưa vào game: chưa đếm giờ
  if (running) {
    return (
      <button
        className="btn btn-running launcher-open"
        disabled
        title="Chưa vào game, chưa tính giờ"
      >
        <span className="open-dot" /> Đang mở
      </button>
    )
  }

  return (
    <button className="btn btn-primary" disabled={launching} onClick={() => launch(game)}>
      <PlayIcon width={16} height={16} />
      {launching ? 'Đang mở...' : label}
    </button>
  )
}
