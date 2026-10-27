import { useRef } from 'react'
import { useFocusShortcut } from '../hooks/useFocusShortcut'
import { SearchIcon } from './Icons'

interface TopBarProps {
  title: string
  search: string
  onSearchChange: (value: string) => void
  // Trang Kho game có ô tìm kiếm riêng nên ẩn ô này đi
  showSearch?: boolean
}

export function TopBar({
  title,
  search,
  onSearchChange,
  showSearch = true
}: TopBarProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  useFocusShortcut(inputRef, showSearch)

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      {showSearch && (
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
      )}
    </header>
  )
}
