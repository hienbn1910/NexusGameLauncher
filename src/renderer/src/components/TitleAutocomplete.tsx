import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TitleAutocompleteProps {
  id: string
  value: string
  placeholder?: string
  autoFocus?: boolean
  // Người dùng gõ tên
  onChange: (value: string) => void
  // Người dùng chọn một game trong gợi ý
  onPick: (game: SgdbGame) => void
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 300
const MAX_ITEMS = 8

// Ô tên game có gợi ý từ SteamGridDB. Chỉ tìm khi người dùng tự gõ (không tìm khi tên được
// điền tự động từ file exe). Danh sách gắn vào body vì thân modal có thanh cuộn sẽ cắt mất.
export function TitleAutocomplete({
  id,
  value,
  placeholder,
  autoFocus,
  onChange,
  onPick
}: TitleAutocompleteProps): React.JSX.Element {
  const api = window.electronAPI.steamGridDb
  const inputRef = useRef<HTMLInputElement>(null)
  // Từ khoá người dùng đang gõ; null = chưa gõ hoặc vừa chọn gợi ý
  const [query, setQuery] = useState<string | null>(null)
  const [results, setResults] = useState<{ term: string; games: SgdbGame[] } | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const term = query?.trim() ?? ''

  // Ngừng gõ 300ms thì tìm; lỗi (chưa có key, mất mạng) => không hiện gợi ý, ô nhập vẫn dùng được
  useEffect(() => {
    if (term.length < MIN_CHARS) return
    let cancelled = false
    const timer = setTimeout(() => {
      api.search(term).then((result) => {
        if (!cancelled && result.ok) setResults({ term, games: result.data.slice(0, MAX_ITEMS) })
      })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [api, term])

  // Trong lúc chờ kết quả mới vẫn giữ danh sách cũ để không bị nháy
  const games = open && term.length >= MIN_CHARS && results ? results.games : []
  const visible = games.length > 0 && !!rect

  // Cuộn hoặc đổi cỡ cửa sổ thì đóng danh sách (vị trí đã lệch so với ô nhập)
  useEffect(() => {
    if (!visible) return
    const close = (e: Event): void => {
      if (e.target instanceof Element && e.target.closest('.title-suggest')) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [visible])

  const showList = (): void => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setOpen(true)
  }

  const pick = (game: SgdbGame): void => {
    setOpen(false)
    setQuery(null)
    setActive(-1)
    onPick(game)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!visible) {
        if (results && term.length >= MIN_CHARS) showList()
        return
      }
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + games.length) % games.length)
    } else if (e.key === 'Enter' && visible && active >= 0 && games[active]) {
      e.preventDefault() // Không submit form
      pick(games[active])
    } else if (e.key === 'Escape' && visible) {
      // Chỉ đóng danh sách, không đóng form
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        className="input"
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={visible}
        aria-controls={`${id}-suggest`}
        onChange={(e) => {
          onChange(e.target.value)
          setQuery(e.target.value)
          setActive(-1)
          showList()
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      {visible &&
        createPortal(
          <ul
            id={`${id}-suggest`}
            className="title-suggest"
            role="listbox"
            style={{
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              // Không tràn khỏi cửa sổ khi ô nhập nằm thấp
              maxHeight: Math.max(160, window.innerHeight - rect.bottom - 16)
            }}
          >
            <li className="title-suggest-head">Gợi ý từ SteamGridDB</li>
            {games.map((g, i) => (
              <li key={g.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`title-suggest-item ${i === active ? 'active' : ''}`}
                  // Giữ focus ở ô nhập (blur sẽ đóng danh sách trước khi kịp bấm)
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(g)}
                >
                  <span className="title-suggest-name">{g.name}</span>
                  {g.year && <span className="title-suggest-year">{g.year}</span>}
                  {g.platforms.includes('steam') && <span className="tag">Steam</span>}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  )
}
