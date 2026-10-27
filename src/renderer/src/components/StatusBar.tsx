interface StatusBarProps {
  gameCount: number
}

export function StatusBar({ gameCount }: StatusBarProps): React.JSX.Element {
  return (
    <footer className="statusbar">
      <span>Không có tác vụ tải xuống</span>
      <span>{gameCount} game · v1.0.0</span>
    </footer>
  )
}
