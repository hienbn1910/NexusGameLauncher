import { useEffect, useState } from 'react'

// Tải dữ liệu theo key (vd id game). Khi key đổi, dữ liệu cũ không còn được trả về
// nên không bị hiện nhầm thông tin của game trước trong lúc đang tải game mới.
// key = null => không tải.
export function useAsyncData<T>(key: string | null, load: () => Promise<T>): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | null>(null)

  useEffect(() => {
    if (key === null) return
    let cancelled = false
    load().then((value) => {
      if (!cancelled) setState({ key, value })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state && state.key === key ? state.value : undefined
}
