interface StatusBarProps {
  gameCount: number
  runningTitles: string[]
}

export function StatusBar({ gameCount, runningTitles }: StatusBarProps): React.JSX.Element {
  return (
    <footer className="statusbar">
      {runningTitles.length > 0 ? (
        <span className="statusbar-playing">
          <span className="pulse-dot" /> Đang chơi: {runningTitles.join(', ')}
        </span>
      ) : (
        <span>Sẵn sàng</span>
      )}
      <span>{gameCount} game · v1.0.0</span>
    </footer>
  )
}
