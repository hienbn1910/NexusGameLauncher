import { existsSync } from 'fs'
import { readFile, rm, stat, writeFile } from 'fs/promises'
import { dirname, extname, isAbsolute, join } from 'path'
import { app, nativeImage } from 'electron'
import * as PELibrary from 'pe-library'
import * as ResEdit from 'resedit'
import type { Game } from './game.service'
import { findExeFile, parseProcessNames } from './process.service'

// Exe lớn hơn mức này thì không đọc icon gốc (phải nạp cả file vào RAM)
const MAX_EXE_SIZE = 200 * 1024 * 1024
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47])

// Cache theo đường dẫn file (icon không đổi khi file không đổi)
const iconCache = new Map<string, Buffer | null>()

// Đọc icon lớn nhất trong resource của exe (thường 256px) để hiển thị nét trên ảnh bìa.
// app.getFileIcon trên Windows chỉ trả về tối đa 32px.
async function readLargestIcon(exePath: string): Promise<Buffer | null> {
  try {
    if ((await stat(exePath)).size > MAX_EXE_SIZE) return null

    const exe = PELibrary.NtExecutable.from(await readFile(exePath), { ignoreCert: true })
    const res = PELibrary.NtExecutableResource.from(exe)
    // Nhóm icon đầu tiên chính là icon Windows hiển thị cho file exe
    const [group] = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
    if (!group) return null

    const items = group.getIconItemsFromEntries(res.entries)
    // Trong icon group, width = 0 nghĩa là 256px
    const size = (i: number): number => group.icons[i]?.width || 256
    let best = 0
    for (let i = 1; i < items.length; i++) if (size(i) > size(best)) best = i
    const item = items[best]
    if (!item) return null

    // Icon 256px thường được lưu sẵn dạng PNG
    if (item.isRaw() && Buffer.from(item.bin).subarray(0, 4).equals(PNG_SIGNATURE)) {
      return Buffer.from(item.bin)
    }

    // Icon dạng bitmap: ghép thành file .ico rồi để nativeImage chuyển sang PNG
    const ico = new ResEdit.Data.IconFile()
    ico.icons = [{ data: item }]
    const tmp = join(app.getPath('temp'), `game-launcher-icon-${Date.now()}.ico`)
    await writeFile(tmp, Buffer.from(ico.generate()))
    try {
      const image = nativeImage.createFromPath(tmp)
      return image.isEmpty() ? null : image.toPNG()
    } finally {
      await rm(tmp, { force: true })
    }
  } catch {
    return null // Không phải PE, file hỏng hoặc không có icon
  }
}

async function iconOf(filePath: string): Promise<Buffer | null> {
  if (iconCache.has(filePath)) return iconCache.get(filePath)!

  let png: Buffer | null = null
  if (extname(filePath).toLowerCase() === '.exe') png = await readLargestIcon(filePath)
  if (!png) {
    // Shortcut, file .bat hoặc exe không có icon riêng: lấy icon Windows hiển thị
    try {
      const icon = await app.getFileIcon(filePath, { size: 'large' })
      png = icon.isEmpty() ? null : icon.toPNG()
    } catch {
      png = null
    }
  }
  iconCache.set(filePath, png)
  return png
}

// Kết quả tìm exe tiến trình, key = exe_path|process_name
const processPathCache = new Map<string, string[]>()

export async function processExePaths(game: Game): Promise<string[]> {
  const key = `${game.exe_path}|${game.process_name ?? ''}`
  let paths = processPathCache.get(key)
  if (!paths) {
    paths = await findProcessExePaths(game)
    processPathCache.set(key, paths)
  }
  return [...paths]
}

// Tìm file exe của tiến trình game (process_name chỉ lưu tên file)
async function findProcessExePaths(game: Game): Promise<string[]> {
  const raw = game.process_name?.trim()
  if (!raw) return []

  const launcher = game.exe_path.trim()
  const hasLauncherFile = !/^steam:\/\//i.test(launcher) && existsSync(launcher)
  const paths: string[] = []

  for (const value of raw.split(',').map((v) => v.trim())) {
    // Người dùng nhập đường dẫn đầy đủ
    if (isAbsolute(value) && existsSync(value)) {
      paths.push(value)
      continue
    }
    if (!hasLauncherFile) continue
    const [name] = parseProcessNames(value)
    if (!name) continue
    // Game thường nằm cùng thư mục launcher hoặc thư mục con; thử thêm thư mục cha
    const found =
      (await findExeFile(dirname(launcher), name)) ??
      (await findExeFile(dirname(dirname(launcher)), name, 3))
    if (found) paths.push(found)
  }
  return paths
}

// Icon của game: ưu tiên exe tiến trình game, không có thì dùng file launcher (exe_path)
export async function getGameIcon(game: Game): Promise<Buffer | null> {
  const launcher = game.exe_path.trim()
  const candidates = await processExePaths(game)
  if (!/^steam:\/\//i.test(launcher) && existsSync(launcher)) candidates.push(launcher)

  for (const path of candidates) {
    const png = await iconOf(path)
    if (png) return png
  }
  return null
}
