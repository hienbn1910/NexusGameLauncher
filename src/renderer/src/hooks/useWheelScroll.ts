import { useEffect } from 'react'

const LINE_HEIGHT = 40 // deltaMode = 1: con lăn báo theo dòng
const SPEED = 1.2

// Lăn chuột (lên/xuống) trên một hàng cuộn ngang => cuộn sang trái/phải, có hiệu ứng mượt.
// Đã cuộn tới đầu/cuối hàng thì trả lại cho trang cuộn dọc như bình thường.
export function useWheelScroll(ref: React.RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let target: number | null = null

    const onWheel = (e: WheelEvent): void => {
      // Touchpad vuốt ngang / giữ Shift: để trình duyệt tự xử lý
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const delta = e.deltaY * (e.deltaMode === 1 ? LINE_HEIGHT : 1) * SPEED
      const from = target ?? el.scrollLeft
      if ((delta < 0 && from <= 0) || (delta > 0 && from >= max)) return

      e.preventDefault()
      // Lăn liên tục: cộng dồn vào đích đang tới để không bị chậm lại giữa chừng
      target = Math.max(0, Math.min(max, from + delta))
      el.scrollTo({ left: target, behavior: 'smooth' })
    }
    const onScrollEnd = (): void => {
      target = null
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scrollend', onScrollEnd)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scrollend', onScrollEnd)
    }
  }, [ref, enabled])
}
