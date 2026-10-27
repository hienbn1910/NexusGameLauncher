import { useEffect, useRef } from 'react'
import { SearchIcon } from './Icons'

interface TopBarProps {
  title: string
  search: string
  onSearchChange: (value: string) => void
}

export function TopBar({ title, search, onSearchChange }: TopBarProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl/Cmd + K để focus ô tìm kiếm
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <label className="search-box">
        <SearchIcon width={16} height={16} />
        <input
          ref={inputRef}
          placeholder="Tìm kiếm game..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <kbd>Ctrl K</kbd>
      </label>
    </header>
  )
}
