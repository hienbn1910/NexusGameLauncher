import { execFile } from 'child_process'

// Danh sách phần mềm đã cài của Windows (registry Uninstall: máy + người dùng, 32 và 64-bit).
// Chỉ ĐỌC registry, không đụng tới tiến trình nào (an toàn với anti-cheat).

export interface InstalledApp {
  name: string
  installLocation: string | null
  displayIcon: string | null
}

// PowerShell xuất JSON UTF-8 để giữ đúng tên/đường dẫn tiếng Việt (reg.exe dùng code page OEM)
const SCRIPT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
@(Get-ItemProperty $paths -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName } |
  Select-Object DisplayName, InstallLocation, DisplayIcon) | ConvertTo-Json -Compress
`

const CACHE_MS = 30_000

let cache: { at: number; apps: Promise<InstalledApp[]> } | null = null

// "D:\Game\a.exe",0  /  "D:\Game"  =>  D:\Game\a.exe  /  D:\Game
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value
    .trim()
    .replace(/,\s*-?\d+$/, '') // Chỉ số icon trong DisplayIcon
    .replace(/^"+|"+$/g, '')
    .replace(/\//g, '\\')
    .replace(/\\{2,}/g, '\\')
    .trim()
  return path || null
}

function readInstalledApps(): Promise<InstalledApp[]> {
  if (process.platform !== 'win32') return Promise.resolve([])
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { windowsHide: true, encoding: 'utf8', timeout: 20_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve([])
        try {
          const raw = JSON.parse(stdout.trim() || '[]') as unknown
          const list = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[]
          resolve(
            list
              .filter((r) => typeof r.DisplayName === 'string')
              .map((r) => ({
                name: (r.DisplayName as string).trim(),
                installLocation: cleanPath(r.InstallLocation),
                displayIcon: cleanPath(r.DisplayIcon)
              }))
          )
        } catch {
          resolve([])
        }
      }
    )
  })
}

// Kết quả giữ 30 giây: mở hộp thoại rồi bấm thêm game không phải đọc registry lại
export function listInstalledApps(): Promise<InstalledApp[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), apps: readInstalledApps() }
  }
  return cache.apps
}
