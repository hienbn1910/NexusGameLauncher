import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { IconComponent } from './Icons'

export interface MenuItem {
  label: string
  icon?: IconComponent
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: (MenuItem | 'divider')[]
  onClose: () => void
}

// Menu chuột phải: đặt tại vị trí chuột, tự lùi vào trong nếu tràn khỏi cửa sổ
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.min(x, window.innerWidth - width - 8),
      top: Math.min(y, window.innerHeight - height - 8)
    })
  }, [x, y])

  // Bấm ra ngoài, Esc, cuộn hoặc rời cửa sổ => đóng
  useEffect(() => {
    const close = (e: Event): void => {
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('wheel', close, { passive: true })
    window.addEventListener('blur', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('wheel', close)
      window.removeEventListener('blur', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="context-menu" style={pos} role="menu">
      {items.map((item, i) =>
        item === 'divider' ? (
          <div key={`d${i}`} className="context-menu-divider" />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onClick()
            }}
          >
            {item.icon && <item.icon width={15} height={15} />}
            {item.label}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
