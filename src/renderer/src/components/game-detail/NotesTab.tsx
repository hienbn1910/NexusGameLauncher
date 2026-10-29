import { useEffect, useRef, useState } from 'react'

interface NotesTabProps {
  game: Game
  onSaved: (game: Game) => void
}

const SAVE_DELAY_MS = 600

// Ghi chú cá nhân: tự lưu sau khi ngừng gõ
export function NotesTab({ game, onSaved }: NotesTabProps): React.JSX.Element {
  const [text, setText] = useState(game.notes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  const flush = async (): Promise<void> => {
    if (pending.current === null) return
    const value = pending.current
    pending.current = null
    const saved = await window.electronAPI.games.setNotes(game.id, value)
    if (saved) onSaved(saved)
    setStatus('saved')
  }

  // Rời tab / đổi game khi chưa kịp lưu => lưu ngay
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      void flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const change = (value: string): void => {
    setText(value)
    setStatus('saving')
    pending.current = value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  return (
    <div className="detail-notes">
      <textarea
        className="input notes-input"
        placeholder={`Ghi chú cho ${game.title}: code quà, build nhân vật, tiến độ, mẹo...`}
        value={text}
        maxLength={20_000}
        onChange={(e) => change(e.target.value)}
      />
      <span className="field-hint">
        {status === 'saving'
          ? 'Đang lưu...'
          : status === 'saved'
            ? '✓ Đã lưu'
            : 'Tự động lưu khi gõ'}
      </span>
    </div>
  )
}
