import { useEffect, useState } from 'react'

// Cache theo game id + đường dẫn ảnh (đổi ảnh thì tính lại)
const cache = new Map<string, string | null>()

// Màu chủ đạo của ảnh bìa game dạng "r, g, b" (null nếu game chưa có ảnh)
export function useArtColor(game: Game | null): string | null {
  const key = game ? `${game.id}|${game.cover_path ?? ''}|${game.poster_path ?? ''}` : ''
  const [state, setState] = useState<{ key: string; color: string | null }>({
    key: '',
    color: null
  })

  useEffect(() => {
    if (!game || cache.has(key)) return
    let cancelled = false
    window.electronAPI.games.getArtColor(game.id).then((color) => {
      cache.set(key, color)
      if (!cancelled) setState({ key, color })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!game) return null
  if (cache.has(key)) return cache.get(key)!
  return state.key === key ? state.color : null
}
