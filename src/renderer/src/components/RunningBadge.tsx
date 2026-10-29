// Huy hiệu trên ảnh game: "Đang chạy" (game thật, đang đếm giờ) / "Đang mở" (mới mở launcher)
export function RunningBadge({ info }: { info: RunningInfo }): React.JSX.Element {
  return info.phase === 'playing' ? (
    <span className="running-badge">
      <span className="pulse-dot" /> Đang chạy
    </span>
  ) : (
    <span className="running-badge launcher-open" title="Chưa vào game, chưa tính giờ">
      <span className="open-dot" /> Đang mở
    </span>
  )
}
