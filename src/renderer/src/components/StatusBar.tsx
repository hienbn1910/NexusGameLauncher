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
      <span>{gameCount} game · v1.0.0</span>
    </footer>
  )
}
