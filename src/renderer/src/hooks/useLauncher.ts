import { createContext, useContext } from 'react'

export interface LauncherContextValue {
  // Game .exe đang chạy (launcher theo dõi được tiến trình)
  runningIds: Set<string>
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
