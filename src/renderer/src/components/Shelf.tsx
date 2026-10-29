import { useEffect, useRef, useState } from 'react'
import type { IconComponent } from './Icons'

interface ShelfProps {
  title: string
  icon?: IconComponent
  count?: number
  // Nút/thao tác thêm ở góc phải tiêu đề
  action?: React.ReactNode
  // Dòng phụ dưới tiêu đề (trạng thái, ghi chú...)
  subtitle?: React.ReactNode
  children: React.ReactNode
}

// Một "kệ" game: tiêu đề + hàng cuộn ngang, có nút cuộn trái/phải
export function Shelf({
  title,
  icon: Icon,
  count,
  action,
  subtitle,
  children
}: ShelfProps): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const updateEdges = (): void => {
    const el = trackRef.current
    if (!el) return
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    })
  }

  // Cập nhật khi đổi kích thước cửa sổ hoặc số game trong kệ
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => observer.disconnect()
  }, [children])

  const scroll = (dir: 1 | -1): void => {
    const el = trackRef.current
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="shelf">
      <div className="shelf-header">
        <h3 className="section-title">
          {Icon && <Icon />}
          {title}
          {count !== undefined && <span className="section-count">{count}</span>}
        </h3>
        <div className="shelf-tools">
          {action}
          {(edges.left || edges.right) && (
            <div className="shelf-arrows">
              <button disabled={!edges.left} onClick={() => scroll(-1)} title="Cuộn trái">
                ‹
              </button>
              <button disabled={!edges.right} onClick={() => scroll(1)} title="Cuộn phải">
                ›
              </button>
            </div>
          )}
        </div>
      </div>
      {subtitle && <div className="shelf-subtitle">{subtitle}</div>}
      <div className="shelf-track" ref={trackRef} onScroll={updateEdges}>
        {children}
      </div>
    </section>
  )
}
