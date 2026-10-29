import koffi from 'koffi'

// Liệt kê tiến trình bằng API Windows (gọi trực tiếp qua koffi, không mở tiến trình con).
// KHÔNG mở handle tới bất kỳ tiến trình nào (không OpenProcess) để anti-cheat của game
// (XIGNCODE, nProtect...) không thấy app tương tác với game; chỉ hỏi hệ điều hành:
// - CreateToolhelp32Snapshot: tên, PID, PID tiến trình cha của mọi tiến trình
// - NtQuerySystemInformation(SystemProcessIdInformation): đường dẫn exe theo PID
//   (đọc được cả tiến trình chạy quyền Administrator)

export interface WinProcess {
  pid: number
  parentPid: number
  name: string // Tên file exe, viết thường
  path: string | null // Đường dẫn đầy đủ, viết thường (để so khớp)
  rawPath: string | null // Đường dẫn giữ nguyên chữ hoa/thường (để hiển thị)
}

const TH32CS_SNAPPROCESS = 0x2
const SYSTEM_PROCESS_ID_INFORMATION = 0x58
const INVALID_HANDLE = 0xffffffffffffffffn
// UNICODE_STRING.MaximumLength là số 16 bit => bộ đệm tối đa 65534 byte
const PATH_BUFFER_BYTES = 0xfffe
// Bố cục SYSTEM_PROCESS_ID_INFORMATION (x64): PID (8) | Length (2) | MaximumLength (2) | đệm (4) | Buffer (8)
const INFO_BYTES = 24
const DEVICE_MAP_TTL_MS = 60_000

interface Api {
  createSnapshot: (flags: number, pid: number) => unknown
  first: (snap: unknown, entry: Record<string, unknown>) => boolean
  next: (snap: unknown, entry: Record<string, unknown>) => boolean
  closeHandle: (handle: unknown) => boolean
  querySystemInfo: (cls: number, info: Buffer, size: number, ret: number[]) => number
  queryDosDevice: (name: string, out: Uint16Array, size: number) => number
  entrySize: number
}

let api: Api | null | undefined

function load(): Api | null {
  if (api !== undefined) return api
  try {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('unsupported')
    const kernel32 = koffi.load('kernel32.dll')
    const ntdll = koffi.load('ntdll.dll')
    koffi.pointer('HANDLE', koffi.opaque())
    const PROCESSENTRY32W = koffi.struct('PROCESSENTRY32W', {
      dwSize: 'uint32',
      cntUsage: 'uint32',
      th32ProcessID: 'uint32',
      th32DefaultHeapID: 'uintptr',
      th32ModuleID: 'uint32',
      cntThreads: 'uint32',
      th32ParentProcessID: 'uint32',
      pcPriClassBase: 'int32',
      dwFlags: 'uint32',
      szExeFile: koffi.array('char16', 260, 'String')
    })
    api = {
      createSnapshot: kernel32.func('HANDLE __stdcall CreateToolhelp32Snapshot(uint32, uint32)'),
      first: kernel32.func('bool __stdcall Process32FirstW(HANDLE, _Inout_ PROCESSENTRY32W *)'),
      next: kernel32.func('bool __stdcall Process32NextW(HANDLE, _Inout_ PROCESSENTRY32W *)'),
      closeHandle: kernel32.func('bool __stdcall CloseHandle(HANDLE)'),
      querySystemInfo: ntdll.func(
        'int32 __stdcall NtQuerySystemInformation(uint32, _Inout_ uint8_t *, uint32, _Out_ uint32 *)'
      ),
      queryDosDevice: kernel32.func(
        'uint32 __stdcall QueryDosDeviceW(str16, _Out_ uint16_t *, uint32)'
      ),
      entrySize: koffi.sizeof(PROCESSENTRY32W)
    }
  } catch {
    api = null // Không phải Windows x64 / không nạp được koffi => dùng tasklist
  }
  return api
}

export function isNativeAvailable(): boolean {
  return load() !== null
}

// ---------- Đường dẫn thiết bị => ổ đĩa ----------
// Windows trả đường dẫn dạng \Device\HarddiskVolume4\Games\x.exe => đổi thành d:\games\x.exe

let deviceMap: [string, string][] = []
let deviceMapAt = 0

function refreshDeviceMap(a: Api): void {
  const map: [string, string][] = []
  const out = new Uint16Array(1024)
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!a.queryDosDevice(`${letter}:`, out, out.length)) continue
    const target = Buffer.from(out.buffer).toString('utf16le').split('\0')[0].toLowerCase()
    if (target) map.push([`${target}\\`, `${letter.toLowerCase()}:\\`])
  }
  deviceMap = map
  deviceMapAt = Date.now()
}

// Giữ nguyên chữ hoa/thường của phần sau ổ đĩa
function toDosPath(a: Api, ntPath: string): string {
  const lower = ntPath.toLowerCase()
  // Ổ mạng: \Device\Mup\server\share\... => \\server\share\...
  const mup = '\\device\\mup\\'
  if (lower.startsWith(mup)) return `\\\\${ntPath.slice(mup.length)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const [device, drive] of deviceMap) {
      if (lower.startsWith(device)) return drive.toUpperCase() + ntPath.slice(device.length)
    }
    // Không khớp ổ nào (vừa cắm USB / gắn ổ mới) => đọc lại bảng ổ đĩa, tối đa mỗi phút một lần
    if (Date.now() - deviceMapAt < DEVICE_MAP_TTL_MS) break
    refreshDeviceMap(a)
  }
  return ntPath
}

// ---------- Đường dẫn exe theo PID (không mở tiến trình) ----------

const pathBuffer = Buffer.alloc(PATH_BUFFER_BYTES)
const infoBuffer = Buffer.alloc(INFO_BYTES)
const returnLength = [0]

function queryPath(a: Api, pid: number): string | null {
  infoBuffer.writeBigUInt64LE(BigInt(pid), 0)
  infoBuffer.writeUInt16LE(0, 8)
  infoBuffer.writeUInt16LE(PATH_BUFFER_BYTES, 10)
  infoBuffer.writeBigUInt64LE(BigInt(koffi.address(pathBuffer)), 16)
  if (
    a.querySystemInfo(SYSTEM_PROCESS_ID_INFORMATION, infoBuffer, INFO_BYTES, returnLength) !== 0
  ) {
    return null
  }
  const length = infoBuffer.readUInt16LE(8)
  return length > 0 ? toDosPath(a, pathBuffer.toString('utf16le', 0, length)) : null
}

// Đường dẫn theo PID: chỉ hỏi Windows với tiến trình mới (key gồm cả tên vì PID có thể bị dùng lại)
const pathCache = new Map<string, string | null>()

export function listWinProcesses(): WinProcess[] | null {
  const a = load()
  if (!a) return null
  if (deviceMapAt === 0) refreshDeviceMap(a)
  const snap = a.createSnapshot(TH32CS_SNAPPROCESS, 0)
  if (!snap || koffi.address(snap) === INVALID_HANDLE) return null

  const result: WinProcess[] = []
  const alive = new Set<string>()
  try {
    const entry: Record<string, unknown> = { dwSize: a.entrySize }
    for (let ok = a.first(snap, entry); ok; ok = a.next(snap, entry)) {
      const pid = entry.th32ProcessID as number
      const name = String(entry.szExeFile).toLowerCase()
      if (pid === 0) continue
      const key = `${pid}:${name}`
      alive.add(key)
      let rawPath = pathCache.get(key)
      if (rawPath === undefined) {
        rawPath = queryPath(a, pid)
        pathCache.set(key, rawPath)
      }
      result.push({
        pid,
        parentPid: entry.th32ParentProcessID as number,
        name,
        path: rawPath?.toLowerCase() ?? null,
        rawPath
      })
    }
  } finally {
    a.closeHandle(snap)
  }
  // Bỏ cache của tiến trình đã thoát
  for (const key of pathCache.keys()) if (!alive.has(key)) pathCache.delete(key)
  return result
}
