import { createContext, useContext } from 'react'

export interface LauncherContextValue {
  // Game đang chạy (launcher theo dõi được tiến trình): id => thời điểm bắt đầu (ms)
  runningIds: ReadonlyMap<string, number>
  // Game đang trong lúc khởi động (đã bấm Chơi, chờ main process trả lời)
  launchingId: string | null
  launch: (game: Game) => void
}

export const LauncherContext = createContext<LauncherContextValue | null>(null)

export function useLauncher(): LauncherContextValue {
  const ctx = useContext(LauncherContext)
  if (!ctx) throw new Error('useLauncher phải dùng bên trong LauncherContext.Provider')
  return ctx
}
