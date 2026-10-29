import { useNow } from '../hooks/useNow'
import { formatHours, parseDay } from '../utils/gameArt'
import { BarChart } from './BarChart'

interface StatsPanelProps {
  stats: PlayStats | null
  games: Game[]
  onSelectGame: (game: Game) => void
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function greeting(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Chào buổi sáng'
  if (hour >= 11 && hour < 13) return 'Chào buổi trưa'
  if (hour >= 13 && hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

// Câu chào + 3 ô số liệu + biểu đồ giờ chơi 7 ngày
export function StatsPanel({ stats, games, onSelectGame }: StatsPanelProps): React.JSX.Element {
  // Cập nhật câu chào mỗi phút
  const now = useNow(60_000)

  const week = stats?.days.slice(7) ?? []
  const weekHours = stats?.weekHours ?? 0
  const prevHours = stats?.prevWeekHours ?? 0
  const topGame = stats?.topGame ? games.find((g) => g.id === stats.topGame!.gameId) : undefined
  const hasData = week.some((d) => d.hours > 0) || prevHours > 0

  const delta = prevHours > 0 ? Math.round(((weekHours - prevHours) / prevHours) * 100) : null

  const summary = !hasData
    ? 'Tuần này bạn chưa chơi game nào. Chọn một game và bắt đầu thôi!'
    : `Tuần này bạn đã chơi ${formatHours(weekHours)}.`

  return (
    <section className="stats-panel">
      <div className="stats-greeting">
        <h2>{greeting(new Date(now).getHours())}!</h2>
        <p>{summary}</p>
      </div>

      <div className="stats-tiles">
        <div className="stat-tile">
          <span className="stat-label">7 ngày qua</span>
          <span className="stat-value">{formatHours(weekHours)}</span>
          <span className="stat-sub">
            {delta === null ? (
              'Chưa có dữ liệu tuần trước'
            ) : (
              <span className={delta >= 0 ? 'stat-up' : 'stat-down'}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% so với tuần trước
              </span>
            )}
          </span>
        </div>

        <div className="stat-tile">
          <span className="stat-label">Chuỗi ngày chơi</span>
          <span className="stat-value">
            {stats?.streak ? <>🔥 {stats.streak}</> : 0}
            <small> ngày</small>
          </span>
          <span className="stat-sub">
            {stats?.streak ? 'Chơi mỗi ngày để giữ chuỗi' : 'Chơi hôm nay để bắt đầu chuỗi'}
          </span>
        </div>

        <button
          className="stat-tile stat-tile-button"
          disabled={!topGame}
          onClick={() => topGame && onSelectGame(topGame)}
        >
          <span className="stat-label">Chơi nhiều nhất tuần</span>
          <span className="stat-value stat-value-text">{topGame?.title ?? '—'}</span>
          <span className="stat-sub">
            {topGame && stats?.topGame ? formatHours(stats.topGame.hours) : 'Chưa có'}
          </span>
        </button>
      </div>

      <div className="stats-chart">
        <span className="stat-label">Giờ chơi 7 ngày</span>
        <BarChart
          ariaLabel="Giờ chơi 7 ngày gần nhất"
          bars={week.map((d, i) => {
            const date = parseDay(d.date)
            const isToday = i === week.length - 1
            return {
              key: d.date,
              label: isToday ? 'Nay' : WEEKDAYS[date.getDay()],
              value: d.hours,
              highlight: isToday,
              tooltip: (
                <>
                  <strong>{formatHours(d.hours)}</strong>
                  {isToday ? 'Hôm nay' : WEEKDAY_NAMES[date.getDay()]},{' '}
                  {date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </>
              )
            }
          })}
        />
      </div>
    </section>
  )
}
