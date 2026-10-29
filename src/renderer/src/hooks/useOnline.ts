import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

// Máy có đang kết nối mạng hay không (theo hệ điều hành)
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine)
}
