import { useEffect, useState } from 'react'
import { currentTheme, switchTheme, THEMES } from '../utils/theme'
import { LockIcon } from './Icons'

// Bản xem trước thu nhỏ: mỗi theme tự vẽ bằng màu/kiểu của chính nó (data-theme lồng nhau)
function ThemePreview({ id }: { id: ThemeId }): React.JSX.Element {
  return (
    <span className="theme-preview" data-theme={id} aria-hidden>
      <span className="theme-preview-side">
        <i />
        <i />
        <i />
      </span>
      <span className="theme-preview-main">
        <span className="theme-preview-hero">
          <b>NEXUS</b>
          <span className="theme-preview-play" />
        </span>
        <span className="theme-preview-tiles">
          <i />
          <i />
          <i />
        </span>
      </span>
    </span>
  )
}

export function AppearanceSettingsCard(): React.JSX.Element {
  const [theme, setTheme] = useState<ThemeId>(currentTheme)
  const [unlocked, setUnlocked] = useState<ThemeId[]>(['minimal', 'balanced'])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.app.getAppearance().then((a) => {
      setTheme(a.theme)
      setUnlocked(a.unlocked)
    })
  }, [])

  const choose = async (id: ThemeId): Promise<void> => {
    if (id === theme || !unlocked.includes(id)) return
    setError(null)
    const result = await window.electronAPI.app.setTheme(id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    switchTheme(result.data.theme, () => {
      setTheme(result.data.theme)
      setUnlocked(result.data.unlocked)
    })
  }

  return (
    <div className="appearance-settings">
      <div className="theme-options" role="radiogroup" aria-label="Giao diện">
        {THEMES.map((t) => {
          const locked = !unlocked.includes(t.id)
          const active = theme === t.id
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={active}
              className={`theme-option ${active ? 'active' : ''} ${locked ? 'locked' : ''}`}
              disabled={locked}
              title={locked ? t.unlockHint : undefined}
              onClick={() => choose(t.id)}
            >
              <ThemePreview id={t.id} />
              <span className="theme-option-info">
                <span className="theme-option-name">
                  {t.name}
                  {active && <span className="theme-option-badge">Đang dùng</span>}
                  {locked && (
                    <span className="theme-option-badge locked">
                      <LockIcon width={11} height={11} /> Đã khoá
                    </span>
                  )}
                </span>
                <span className="theme-option-desc">{locked ? t.unlockHint : t.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
