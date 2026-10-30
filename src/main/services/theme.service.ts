import { getSetting, setSetting } from './settings.service'

// Giao diện của app. Tối giản là mặc định, Cân bằng miễn phí,
// Neon (bản nâng cấp của Cân bằng) phải mở khoá (nhiệm vụ - giai đoạn sau)
export type ThemeId = 'minimal' | 'balanced' | 'neon'

export const THEME_IDS: ThemeId[] = ['minimal', 'balanced', 'neon']
export const DEFAULT_THEME: ThemeId = 'minimal'
const FREE_THEMES: ThemeId[] = ['minimal', 'balanced']

const THEME_KEY = 'ui_theme'
// Danh sách theme đã mở khoá thêm (JSON). Hệ thống nhiệm vụ sẽ ghi vào đây
const UNLOCKED_KEY = 'unlocked_themes'

export interface Appearance {
  theme: ThemeId
  unlocked: ThemeId[]
}

const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as string[]).includes(value)

function getUnlocked(): ThemeId[] {
  let extra: unknown = []
  try {
    extra = JSON.parse(getSetting(UNLOCKED_KEY) ?? '[]')
  } catch {
    // Dữ liệu hỏng => coi như chưa mở khoá gì thêm
  }
  const list = Array.isArray(extra) ? extra.filter(isThemeId) : []
  return THEME_IDS.filter((id) => FREE_THEMES.includes(id) || list.includes(id))
}

export function getAppearance(): Appearance {
  const unlocked = getUnlocked()
  const saved = getSetting(THEME_KEY)
  // Theme đã lưu nhưng bị khoá lại (vd. dữ liệu cũ) => quay về mặc định
  const theme = isThemeId(saved) && unlocked.includes(saved) ? saved : DEFAULT_THEME
  return { theme, unlocked }
}

export function setTheme(theme: unknown): Appearance {
  if (!isThemeId(theme)) throw new Error('Giao diện không hợp lệ')
  if (!getUnlocked().includes(theme)) throw new Error('Giao diện này chưa được mở khoá')
  setSetting(THEME_KEY, theme)
  return getAppearance()
}
