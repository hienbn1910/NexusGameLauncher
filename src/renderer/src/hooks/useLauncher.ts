import { createContext, useContext } from 'react'

export interface LauncherContextValue {
  // Game đang mở (theo dõi được tiến trình): id => trạng thái "Đang mở" / "Đang chơi" + mốc đồng hồ
  runningIds: ReadonlyMap<string, RunningInfo>
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
