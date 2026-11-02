import { useUpdateStatus } from '../hooks/useUpdateStatus'

interface StatusBarProps {
  gameCount: number
  playingTitles: string[] // Game thật đang chạy (đang đếm giờ)
  openTitles: string[] // Mới mở launcher, chưa vào game
}

export function StatusBar({
  gameCount,
  playingTitles,
  openTitles
}: StatusBarProps): React.JSX.Element {
  const update = useUpdateStatus()
  const idle = playingTitles.length === 0 && openTitles.length === 0
  return (
    <footer className="statusbar">
      <span className="statusbar-sessions">
        {idle && <span>Sẵn sàng</span>}
        {playingTitles.length > 0 && (
          <span className="statusbar-playing">
            <span className="pulse-dot" /> Đang chơi: {playingTitles.join(', ')}
          </span>
        )}
        {openTitles.length > 0 && (
          <span className="statusbar-open">
            <span className="open-dot" /> Đang mở: {openTitles.join(', ')}
          </span>
        )}
      </span>
      <span className="statusbar-right">
        {update?.state === 'ready' && (
          <button
            className="statusbar-update"
            title="Thoát và cài bản mới, app sẽ tự mở lại"
            onClick={() => window.electronAPI.app.installUpdate()}
          >
            Có bản {update.version} · Khởi động lại để cập nhật
          </button>
        )}
        {update?.state === 'downloading' && (
          <span>
            Đang tải bản {update.version} ({update.progress ?? 0}%)
          </span>
        )}
        <span>
          {gameCount} game{update && ` · v${update.currentVersion}`}
        </span>
      </span>
    </footer>
  )
}
