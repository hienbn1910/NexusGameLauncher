import { readFile, stat } from 'fs/promises'
import { basename, dirname, extname } from 'path'
import * as PELibrary from 'pe-library'
import * as ResEdit from 'resedit'

// Exe lớn hơn mức này thì bỏ qua đọc metadata (phải nạp cả file vào RAM)
const MAX_EXE_SIZE = 200 * 1024 * 1024

// Tên do engine / launcher đặt, không phải tên game thật
const GENERIC_NAMES = new Set(
  [
    'unrealgame',
    'unreal engine',
    'ue4game',
    'ue5game',
    'unity',
    'unity player',
    'unityplayer',
    'bootstrappackagedgame',
    'launcher',
    'game launcher',
    'game',
    'client',
    'game client',
    'patcher',
    'updater',
    'setup',
    'installer',
    'application',
    'app',
    'main',
    'start',
    'play',
    'win64',
    'shipping',
    'electron',
    'nw.js',
    'godot engine',
    'renpy',
    'java(tm) platform se binary',
    'microsoft® windows® operating system'
  ].map((s) => s.toLowerCase())
)

// Thư mục không mang tên game, gặp thì đi tiếp lên thư mục cha
const GENERIC_FOLDERS = new Set([
  'bin',
  'bin64',
  'bin32',
  'binaries',
  'win64',
  'win32',
  'x64',
  'x86',
  'windows',
  'windowsnoeditor',
  'game',
  'games',
  'client',
  'launcher',
  'app',
  'release',
  'retail',
  'live',
  'shipping',
  'program files',
  'program files (x86)',
  'steamapps',
  'common',
  'epic games',
  'downloads',
  'desktop'
])

const NOISE_SUFFIX =
  /\b(launcher|win64|win32|x64|x86|shipping|client|patcher|updater|setup|installer|dx11|dx12|vulkan)\b/gi

// Tên thư mục chỉ là số phiên bản, vd "1.3.361.151", "v2_0"
const VERSION_ONLY = /^v?[\d._\-\s]+$/i

// "hollow_knight-v1.2.3" -> "Hollow Knight", "HollowKnight" -> "Hollow Knight"
export function cleanName(raw: string): string {
  let name = raw
    .replace(/\.exe$/i, '')
    .replace(/[_.]+/g, ' ')
    .replace(/(?<=\S)-(?=\S)/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2') // ABCWord -> ABC Word (giữ nguyên SGuard)
    .replace(/\bv?\d+(\s\d+){1,3}\b/gi, '') // số phiên bản (đã đổi dấu chấm thành cách)
    .replace(NOISE_SUFFIX, '')
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Viết hoa chữ cái đầu nếu toàn bộ đang viết thường
  if (name && name === name.toLowerCase()) {
    name = name.replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  }
  // Từ viết HOA toàn bộ và dài (CLOSERS) => Closers; giữ nguyên viết tắt ngắn (DOOM, XCOM)
  name = name.replace(/\b[A-Z]{5,}\b/g, (w) => w[0] + w.slice(1).toLowerCase())
  return name
}

function isUseful(name: string): boolean {
  const n = name.trim().toLowerCase()
  return n.length >= 2 && !GENERIC_NAMES.has(n) && !VERSION_ONLY.test(n)
}

// Đọc ProductName / FileDescription trong Version Info của file exe
async function readVersionStrings(exePath: string): Promise<string[]> {
  try {
    const { size } = await stat(exePath)
    if (size > MAX_EXE_SIZE) return []

    const exe = PELibrary.NtExecutable.from(await readFile(exePath), { ignoreCert: true })
    const res = PELibrary.NtExecutableResource.from(exe)
    const [versionInfo] = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
    if (!versionInfo) return []

    const result: string[] = []
    for (const lang of versionInfo.getAllLanguagesForStringValues()) {
      const values = versionInfo.getStringValues(lang)
      for (const key of ['ProductName', 'FileDescription']) {
        const value = values[key]?.trim()
        // Bỏ giá trị mẫu nhà phát triển quên sửa, vd "TODO: <CLOSERS>"
        if (value && !/todo|<|>/i.test(value)) result.push(value)
      }
    }
    return result
  } catch {
    return [] // File hỏng, không phải PE hoặc không có Version Info
  }
}

// Đi ngược lên các thư mục cha, lấy thư mục đầu tiên có tên "giống tên game"
function folderName(exePath: string): string | null {
  let dir = dirname(exePath)
  for (let i = 0; i < 5; i++) {
    const name = basename(dir)
    if (!name || dir === dirname(dir)) return null // Đã tới gốc ổ đĩa
    if (!GENERIC_FOLDERS.has(name.toLowerCase()) && !VERSION_ONLY.test(name)) return name
    dir = dirname(dir)
  }
  return null
}

export interface ExeInspection {
  // Gợi ý tên game, tốt nhất đứng đầu
  suggestions: { name: string; source: 'metadata' | 'folder' | 'file' }[]
}

export async function inspectExe(exePath: string): Promise<ExeInspection> {
  const candidates: ExeInspection['suggestions'] = []
  const push = (raw: string | null, source: 'metadata' | 'folder' | 'file'): void => {
    if (!raw) return
    const name = cleanName(raw)
    if (!isUseful(name)) return
    if (candidates.some((c) => c.name.toLowerCase() === name.toLowerCase())) return
    candidates.push({ name, source })
  }

  if (extname(exePath).toLowerCase() === '.exe') {
    for (const value of await readVersionStrings(exePath)) push(value, 'metadata')
  }
  push(folderName(exePath), 'folder')
  push(basename(exePath, extname(exePath)), 'file')

  // Metadata thường chính xác nhất, nhưng nếu nó trùng tên file exe (vd "CCPatcher")
  // thì nhiều khả năng chỉ là tên launcher => ưu tiên tên thư mục
  const fileBase = cleanName(basename(exePath, extname(exePath))).toLowerCase()
  candidates.sort((a, b) => score(b) - score(a))

  function score(c: ExeInspection['suggestions'][number]): number {
    if (c.source === 'metadata') return c.name.toLowerCase() === fileBase ? 1 : 3
    if (c.source === 'folder') return 2
    return 0
  }

  return { suggestions: candidates.slice(0, 4) }
}
