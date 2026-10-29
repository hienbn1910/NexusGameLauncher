import { execFile } from 'child_process'
import { readdir } from 'fs/promises'
import { basename, join } from 'path'
import { listWinProcesses, type WinProcess } from './win-process'

export type ProcessInfo = WinProcess

// Tất cả tiến trình đang chạy: tên + đường dẫn exe (null nếu không đọc được).
// Windows: gọi thẳng API (~10ms); không được thì dùng tasklist / ps (~0.5s, chỉ có tên).
export async function listProcesses(): Promise<ProcessInfo[]> {
  const native = process.platform === 'win32' ? listWinProcesses() : null
  if (native) return native
  return [...(await listProcessNames())].map((name) => ({
    pid: 0,
    parentPid: 0,
    name,
    path: null,
    rawPath: null
  }))
}

// Lấy tên (viết thường) của tất cả tiến trình đang chạy.
// tasklist thấy được cả tiến trình chạy bằng quyền admin, khác với việc đọc đường dẫn exe.
function listProcessNames(): Promise<Set<string>> {
  return new Promise((resolve) => {
    const [cmd, args] =
      process.platform === 'win32'
        ? ['tasklist', ['/FO', 'CSV', '/NH']]
        : ['ps', ['-A', '-o', 'comm=']]

    execFile(cmd, args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      const names = new Set<string>()
      if (err) return resolve(names)

      for (const line of stdout.split(/\r?\n/)) {
        // Windows: "Game.exe","1234","Console","1","50,000 K"
        const name = process.platform === 'win32' ? line.match(/^"([^"]+)"/)?.[1] : line.trim()
        if (name) names.add(basename(name).toLowerCase())
      }
      resolve(names)
    })
  })
}

// Chuẩn hoá tên tiến trình người dùng nhập: "Game", "game.exe", "C:\...\Game.exe" => "game.exe"
// Cho phép nhập nhiều tên, ngăn cách bằng dấu phẩy
export function parseProcessNames(value: string): string[] {
  return value
    .split(',')
    .map((v) => basename(v.trim()).toLowerCase())
    .filter(Boolean)
    .map((v) => (process.platform === 'win32' && !v.endsWith('.exe') ? `${v}.exe` : v))
}

const MAX_DEPTH = 4
const MAX_ENTRIES = 5000

// Quét thư mục cài game, trả về Map tên exe (viết thường) => đường dẫn đầy đủ (file gặp đầu tiên).
// Giới hạn độ sâu và số file để không bị treo khi exe nằm ở thư mục quá lớn.
async function scanExeFiles(rootDir: string, maxDepth = MAX_DEPTH): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  let visited = 0

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited > MAX_ENTRIES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return // Thư mục không có quyền đọc
    }
    for (const entry of entries) {
      if (++visited > MAX_ENTRIES) return
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) await walk(fullPath, depth + 1)
      else if (entry.name.toLowerCase().endsWith('.exe')) {
        const name = entry.name.toLowerCase()
        if (!files.has(name)) files.set(name, fullPath)
      }
    }
  }

  await walk(rootDir, 0)
  return files
}

export async function collectExeNames(rootDir: string): Promise<Set<string>> {
  return new Set((await scanExeFiles(rootDir)).keys())
}

// Tìm đường dẫn file exe theo tên (vd "game.exe") trong thư mục cài game
export async function findExeFile(
  rootDir: string,
  name: string,
  maxDepth = MAX_DEPTH
): Promise<string | null> {
  return (await scanExeFiles(rootDir, maxDepth)).get(name.toLowerCase()) ?? null
}
