import { formatHours, formatPlaytime, parseDay } from '../../utils/gameArt'
import { BarChart } from '../BarChart'

interface StatsTabProps {
  game: Game
  stats: GameStats | undefined
}

const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export function StatsTab({ game, stats }: StatsTabProps): React.JSX.Element {
  if (!stats) return <p className="detail-muted">Đang tải thống kê...</p>

  const tiles = [
    { label: 'Tổng thời gian', value: formatPlaytime(game.total_playtime) },
    { label: 'Số phiên chơi', value: stats.sessions.toLocaleString('vi-VN') },
    { label: 'Phiên dài nhất', value: stats.sessions ? formatHours(stats.longestHours) : '—' },
    { label: 'Trung bình / phiên', value: stats.sessions ? formatHours(stats.averageHours) : '—' },
    {
      label: 'Ghi nhận từ',
      value: stats.firstPlayed ? new Date(stats.firstPlayed).toLocaleDateString('vi-VN') : '—'
    },
    { label: 'So với cả thư viện', value: `${Math.round(stats.share * 100)}%` }
  ]

  return (
    <div className="detail-stats">
      <div className="detail-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <span className="stat-label">{t.label}</span>
            <span className="stat-value">{t.value}</span>
          </div>
        ))}
      </div>

      {stats.sessions === 0 ? (
        <p className="detail-muted">
          Chưa có phiên chơi nào được ghi lại. Thống kê chi tiết bắt đầu từ lần chơi tới (tổng giờ
          chơi trước đó vẫn được giữ).
        </p>
      ) : (
        <>
          <section className="detail-card">
            <h3>Giờ chơi 12 tuần gần nhất</h3>
            <div className="detail-chart">
              <BarChart
                ariaLabel="Giờ chơi theo tuần"
                bars={stats.weeks.map((w, i) => {
                  const start = parseDay(w.start)
                  const end = new Date(start)
                  end.setDate(end.getDate() + 6)
                  const fmt = (d: Date): string =>
                    d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                  const current = i === stats.weeks.length - 1
                  return {
                    key: w.start,
                    label: current ? 'Nay' : fmt(start),
                    value: w.hours,
                    highlight: current,
                    tooltip: (
                      <>
                        <strong>{formatHours(w.hours)}</strong>
                        {fmt(start)} – {fmt(end)}
                      </>
                    )
                  }
                })}
              />
            </div>
          </section>

          <section className="detail-card">
            <h3>Phiên chơi gần đây</h3>
            <ul className="session-list">
              {stats.recent.map((s) => (
                <li key={s.startedAt}>
                  <span className="session-date">{dateTime(s.startedAt)}</span>
                  <span className="session-range">
                    {time(s.startedAt)} – {time(s.endedAt)}
                  </span>
                  <span className="session-hours">{formatHours(s.hours)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
