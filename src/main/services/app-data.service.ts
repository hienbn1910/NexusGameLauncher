import { rmSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { app, session, shell } from 'electron'
import { closeDatabase, initDatabase } from '../database'
import { runMigrations } from '../database/migrate'
import { applyNetworkSettings } from './network.service'
import { invalidateTargets, resetTracker } from './play-tracker.service'

// Dữ liệu người dùng của app (trong %APPDATA%\game-launcher) và reset về như mới cài.
// Chỉ xoá dữ liệu của Nexus, KHÔNG đụng tới file game trên máy.

const DB_FILES = ['games.db', 'games.db-wal', 'games.db-shm']
const DATA_DIRS = ['covers', 'avatars', 'news-images']
// Thư mục tạm của app (ảnh SteamGridDB đang tải...)
const TEMP_DIRS = ['game-launcher-covers']

export interface DataInfo {
  path: string
  bytes: number
  files: number
}

async function measure(path: string, result: DataInfo): Promise<void> {
  let info
  try {
    info = await stat(path)
  } catch {
    return // Chưa có
  }
  if (info.isFile()) {
    result.bytes += info.size
    result.files++
    return
  }
  for (const name of await readdir(path).catch(() => [] as string[])) {
    await measure(join(path, name), result)
  }
}

export async function getDataInfo(): Promise<DataInfo> {
  const root = app.getPath('userData')
  const result: DataInfo = { path: root, bytes: 0, files: 0 }
  for (const name of [...DB_FILES, ...DATA_DIRS]) await measure(join(root, name), result)
  return result
}

export async function openDataFolder(): Promise<void> {
  const error = await shell.openPath(app.getPath('userData'))
  if (error) throw new Error(error)
}

// Xoá toàn bộ dữ liệu: thư viện game, giờ chơi, ảnh bìa, hồ sơ, cài đặt, tin tức đã lưu...
// Làm ngay khi app đang chạy (không cần khởi động lại):
// đóng DB => xoá file => tạo DB trống => xoá cache giao diện (giao diện tự tải lại sau đó).
// Các bước với file chạy đồng bộ liên tiếp nên không tác vụ nền nào dùng DB giữa chừng.
export async function resetAllData(): Promise<void> {
  const root = app.getPath('userData')
  const temp = app.getPath('temp')
  const failed: string[] = []

  resetTracker() // Bỏ các phiên đang theo dõi, không ghi giờ chơi vào DB sắp xoá
  closeDatabase()
  try {
    for (const name of DB_FILES) {
      try {
        rmSync(join(root, name), { force: true })
      } catch {
        failed.push(name)
      }
    }
    for (const name of DATA_DIRS) {
      try {
        rmSync(join(root, name), { recursive: true, force: true })
      } catch {
        failed.push(name)
      }
    }
    for (const name of TEMP_DIRS) rmSync(join(temp, name), { recursive: true, force: true })
  } finally {
    // Luôn mở lại DB (kể cả khi xoá lỗi) để app vẫn chạy được
    initDatabase()
    runMigrations()
  }
  invalidateTargets()

  // Dữ liệu phía giao diện: localStorage (kiểu xem Kho game...), cache ảnh/HTTP
  await session.defaultSession.clearStorageData()
  await session.defaultSession.clearCache()
  // Cài đặt mạng về mặc định (DNS hệ thống, proxy hệ thống)
  await applyNetworkSettings().catch(() => undefined)

  // Giao diện tự tải lại sau khi nhận kết quả (để còn hiện được lỗi nếu có)
  if (failed.length > 0) {
    // games.db bị chương trình khác mở (vd DB Browser) thì không xoá được
    throw new Error(
      `Không xoá được: ${failed.join(', ')}. Hãy đóng chương trình đang mở các file này rồi thử lại.`
    )
  }
}
