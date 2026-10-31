import { useLauncher } from '../hooks/useLauncher'
import { FolderIcon, PlayIcon } from './Icons'

interface PlayButtonProps {
  game: Game
  label?: string
  // Dòng chữ nhỏ dưới nhãn (vd "Phiên trước · 13 giờ trước"), theme quyết định có hiện hay không
  hint?: string
}

// Nút "Chơi ngay" lớn trên banner, tự đổi trạng thái khi game đang khởi động/đang chạy
export function PlayButton({
  game,
  label = 'Chơi ngay',
  hint
}: PlayButtonProps): React.JSX.Element {
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

  // Chưa có file chạy (thêm từ danh mục): bấm sẽ tìm lại trên máy, không thấy thì mở form chọn file
  if (!game.exe_path.trim()) {
    return (
      <button
        className="btn btn-primary"
        disabled={launching}
        title="Game chưa có file chạy trên máy này"
        onClick={() => launch(game)}
      >
        <FolderIcon width={16} height={16} />
        {launching ? 'Đang tìm game...' : 'Chọn file game'}
      </button>
    )
  }

  return (
    <button className="btn btn-primary" disabled={launching} onClick={() => launch(game)}>
      <PlayIcon width={16} height={16} />
      {hint && !launching ? (
        <span className="btn-label">
          {label}
          <small className="btn-hint">{hint}</small>
        </span>
      ) : launching ? (
        'Đang mở...'
      ) : (
        label
      )}
    </button>
  )
}
