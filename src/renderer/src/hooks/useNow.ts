import { useEffect, useState } from 'react'

// Thời gian hiện tại, tự cập nhật sau mỗi intervalMs (đồng hồ phiên chơi, "5 phút trước"...)
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs, enabled])

  return now
}
