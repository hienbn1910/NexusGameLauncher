import { flushSync } from 'react-dom'

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

// Chuyển cảnh mượt bằng View Transitions API của Chromium.
// prepare: chạy trước khi chụp trạng thái cũ (vd gắn view-transition-name cho ảnh được bấm),
// trả về hàm dọn dẹp chạy ngay trước khi cập nhật giao diện.
export function withViewTransition(update: () => void, prepare?: () => (() => void) | void): void {
  const doc = document as ViewTransitionDocument
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduceMotion) {
    update()
    return
  }
  const cleanup = prepare?.()
  doc.startViewTransition(() => {
    cleanup?.()
    flushSync(update)
  })
}
