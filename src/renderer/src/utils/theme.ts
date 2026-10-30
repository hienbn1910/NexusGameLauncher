import { flushSync } from 'react-dom'

// Thông tin hiển thị của từng giao diện (thứ tự = thứ tự trong Cài đặt)
export interface ThemeInfo {
  id: ThemeId
  name: string
  description: string
  // Gợi ý cách mở khoá khi theme còn bị khoá
  unlockHint?: string
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'minimal',
    name: 'Tối giản',
    description: 'Phẳng, ít màu, tập trung vào nội dung.'
  },
  {
    id: 'balanced',
    name: 'Cân bằng',
    description: 'Góc vát nhẹ, nút gradient, ảnh bìa và màu nhấn tím.'
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Bản nâng cấp của Cân bằng: viền neon phát sáng, chữ tiêu đề đậm nghiêng.',
    unlockHint: 'Mở khoá bằng nhiệm vụ (sắp ra mắt)'
  }
]

export const DEFAULT_THEME: ThemeId = 'minimal'

// Bản sao theme trong localStorage để áp dụng ngay khi mở app, trước khi hỏi main process
const CACHE_KEY = 'nexus-theme'

const isThemeId = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value)

export function cachedTheme(): ThemeId {
  const value = localStorage.getItem(CACHE_KEY)
  return isThemeId(value) ? value : DEFAULT_THEME
}

export function currentTheme(): ThemeId {
  const value = document.documentElement.dataset.theme
  return isThemeId(value) ? value : DEFAULT_THEME
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(CACHE_KEY, theme)
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown
}

// Đổi theme có hiệu ứng chuyển mờ dần (nếu máy cho phép hiệu ứng)
export function switchTheme(theme: ThemeId, update?: () => void): void {
  const doc = document as ViewTransitionDocument
  const run = (): void => {
    applyTheme(theme)
    if (update) flushSync(update)
  }
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    run()
    return
  }
  doc.startViewTransition(run)
}
