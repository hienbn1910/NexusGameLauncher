import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { dirname, join } from 'path'
import { shell } from 'electron'
import * as gameService from './game.service'
import { steamInstallDir } from './steam-art.service'

// Thư mục cài game: mở thư mục, tính dung lượng

const MAX_ENTRIES = 300_000

// Game Steam: thư mục trong steamapps\common; game tự thêm: thư mục gốc chứa file exe
export async function getInstallDir(gameId: string): Promise<string | null> {
  const game = gameService.getGameById(gameId)
  if (!game) return null

  const target = game.exe_path.trim()
  if (/^steam:\/\//i.test(target)) {
    const appId = game.source_id ?? game.steam_app_id
    return appId ? steamInstallDir(appId) : null
  }

  // Exe nằm sâu trong steamapps\common\<Game>\bin\... => lấy thư mục gốc của game
  const steamRoot = target.match(/^(.*[\\/]steamapps[\\/]common[\\/][^\\/]+)/i)?.[1]
  const dir = steamRoot ?? dirname(target)
  return existsSync(dir) ? dir : null
}

export async function openInstallDir(gameId: string): Promise<void> {
  const dir = await getInstallDir(gameId)
  if (!dir) throw new Error('Không tìm thấy thư mục cài game trên máy')
  const error = await shell.openPath(dir)
  if (error) throw new Error(error)
}

export interface FolderSize {
  path: string
  bytes: number
  files: number
  partial: boolean // Thư mục quá lớn, chỉ tính được một phần
}

const sizeCache = new Map<string, FolderSize>()

export async function getFolderSize(gameId: string, force = false): Promise<FolderSize | null> {
  const dir = await getInstallDir(gameId)
  if (!dir) return null
  if (!force && sizeCache.has(dir)) return sizeCache.get(dir)!

  const result: FolderSize = { path: dir, bytes: 0, files: 0, partial: false }
  let visited = 0
  // Duyệt theo hàng đợi thay vì đệ quy để không tràn stack với thư mục rất sâu
  const queue = [dir]
  while (queue.length > 0) {
    const current = queue.pop()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue // Không có quyền đọc
    }
    for (const entry of entries) {
      if (++visited > MAX_ENTRIES) {
        result.partial = true
        queue.length = 0
        break
      }
      const path = join(current, entry.name)
      if (entry.isDirectory()) queue.push(path)
      else if (entry.isFile()) {
        try {
          result.bytes += (await stat(path)).size
          result.files++
        } catch {
          // File bị khoá
        }
      }
    }
  }

  sizeCache.set(dir, result)
  return result
}
