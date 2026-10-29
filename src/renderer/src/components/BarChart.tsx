import { useState } from 'react'

export interface BarDatum {
  key: string
  label: string // Nhãn trục dưới cột
  value: number
  tooltip: React.ReactNode
  highlight?: boolean // Cột hiện tại (hôm nay / tuần này): nhãn đậm hơn
}

interface BarChartProps {
  bars: BarDatum[]
  minMax?: number // Giá trị trần tối thiểu để vài phút chơi không thành cột cao kịch
  ariaLabel: string
}

// Biểu đồ cột một chuỗi dữ liệu: cột mảnh bo góc trên, rê chuột vào cả cột để xem tooltip
export function BarChart({ bars, minMax = 0.5, ariaLabel }: BarChartProps): React.JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...bars.map((b) => b.value), minMax)

  return (
    <div
      className="chart-bars"
      role="img"
      aria-label={ariaLabel}
      style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}
      onMouseLeave={() => setHovered(null)}
    >
      {bars.map((bar, i) => {
        const height = bar.value > 0 ? Math.max(4, (bar.value / max) * 100) : 0
        return (
          <div
            key={bar.key}
            className={`chart-col ${hovered === i ? 'hovered' : ''}`}
            onMouseEnter={() => setHovered(i)}
          >
            {hovered === i && <span className="chart-tooltip">{bar.tooltip}</span>}
            <div className="chart-track">
              <div className="chart-bar" style={{ height: `${height}%` }} />
            </div>
            <span className={`chart-label ${bar.highlight ? 'today' : ''}`}>{bar.label}</span>
          </div>
        )
      })}
    </div>
  )
}
