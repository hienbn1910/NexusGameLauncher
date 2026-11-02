import { useEffect, useState } from 'react'

// Phiên bản app và trạng thái cập nhật tự động (main gửi sự kiện mỗi khi thay đổi)
export function useUpdateStatus(): UpdateStatus | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const api = window.electronAPI.app
    let cancelled = false
    api.getUpdateStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    const off = api.onUpdateStatus(setStatus)
    return () => {
      cancelled = true
      off()
    }
  }, [])

  return status
}
