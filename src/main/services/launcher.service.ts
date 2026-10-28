import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { basename, dirname, extname } from 'path'
import { app, BrowserWindow, shell } from 'electron'
import * as gameService from './game.service'
import type { Game } from './game.service'
import { collectExeNames, listProcessNames, parseProcessNames } from './process.service'

export type LaunchResult = { ok: true; game: Game } | { ok: false; error: string }

export interface SessionEvent {
  gameId: string
  running: boolean
  game?: Game
}

const POLL_INTERVAL_MS = 5_000
// Số lần kiểm tra liên tiếp không thấy tiến trình nào thì coi như đã tắt game
// (chừa thời gian cho khoảng trống giữa lúc launcher tắt và game bật lên)
const MISS_LIMIT = 4
// Chỉ định tiến trình nhưng mãi không thấy nó chạy (game lỗi, người dùng tắt launcher...)
const NOT_SEEN_TIMEOUT_MS = 5 * 60_000

interface Session {
  // 'explicit': chỉ tính giờ khi tiến trình người dùng chỉ định đang chạy
  // 'auto': tính giờ khi còn bất kỳ exe nào trong thư mục game đang chạy
  mode: 'explicit' | 'auto'
  watchNames: Set<string>
  childAlive: boolean
  waitingSince: number // Mốc để tính timeout khi chưa thấy tiến trình game
  seen: boolean
  missCount: number
  active: boolean // Lần kiểm tra gần nhất game có đang chạy không
  lastTick: number
  playedMs: number
}

// Các game đang được theo dõi (key = game id)
const sessions = new Map<string, Session>()
let pollTimer: NodeJS.Timeout | null = null
let polling = false

export function isSteamUri(path: string): boolean {
  return /^steam:\/\//i.test(path.trim())
}

export function getRunningGameIds(): string[] {
  return [...sessions.keys()]
}

// Gửi trạng thái chơi game tới tất cả cửa sổ renderer
function broadcast(event: SessionEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('games:sessionChanged', event)
  }
}

function endSession(gameId: string): void {
  const session = sessions.get(gameId)
  if (!session) return
  sessions.delete(gameId)
  if (sessions.size === 0) stopPolling()

  // Cộng nốt khoảng thời gian từ lần kiểm tra cuối nếu game vẫn đang chạy
  if (session.active) session.playedMs += Date.now() - session.lastTick

  const game = gameService.recordPlaySession(gameId, session.playedMs / 3_600_000)
  broadcast({ gameId, running: false, game })
}

// ---------- Theo dõi tiến trình ----------

function updateSession(gameId: string, session: Session, running: Set<string>): void {
  const now = Date.now()
  const anyRunning = [...session.watchNames].some((name) => running.has(name))
  const active = session.mode === 'auto' ? anyRunning || session.childAlive : anyRunning

  if (session.active) session.playedMs += now - session.lastTick
  session.active = active
  session.lastTick = now

  if (active) {
    session.seen = true
    session.missCount = 0
    return
  }

  if (session.seen) {
    // Đã từng chạy, giờ không còn: chờ thêm vài lượt rồi mới kết thúc
    if (++session.missCount >= MISS_LIMIT) endSession(gameId)
  } else if (!session.childAlive && now - session.waitingSince > NOT_SEEN_TIMEOUT_MS) {
    endSession(gameId)
  }
}

async function poll(): Promise<void> {
  if (polling || sessions.size === 0) return
  polling = true
  try {
    const running = await listProcessNames()
    for (const [gameId, session] of sessions) updateSession(gameId, session, running)
  } finally {
    polling = false
  }
}

function startPolling(): void {
  if (!pollTimer) pollTimer = setInterval(poll, POLL_INTERVAL_MS)
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startSession(
  gameId: string,
  mode: Session['mode'],
  watchNames: Set<string>,
  child: ChildProcess | null
): void {
  const now = Date.now()
  const session: Session = {
    mode,
    watchNames,
    childAlive: !!child,
    waitingSince: now,
    seen: false,
    missCount: 0,
    active: mode === 'auto', // Auto: launcher vừa bật nên tính là đang chạy
    lastTick: now,
    playedMs: 0
  }
  sessions.set(gameId, session)

  child?.once('exit', () => {
    session.childAlive = false
    session.waitingSince = Date.now()
    // Kiểm tra ngay để không phải chờ hết chu kỳ
    void poll()
  })

  startPolling()
}

// ---------- Chạy exe ----------

// Chạy file exe và chờ tới khi tiến trình thực sự được tạo (hoặc báo lỗi)
function spawnExe(exePath: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, [], {
      cwd: dirname(exePath), // Nhiều game cần chạy đúng thư mục để tìm file data
      detached: true, // Đóng launcher không làm tắt game
      stdio: 'ignore'
    })
    child.once('spawn', () => resolve(child))
    child.once('error', reject)
  })
}

// Script PowerShell chạy exe với quyền Administrator (hiện hộp thoại UAC) rồi chờ game thoát.
// Đường dẫn truyền qua biến môi trường để không phải xử lý escape ký tự đặc biệt.
const ELEVATED_SCRIPT = `
try {
  $p = Start-Process -FilePath $env:GL_EXE -WorkingDirectory $env:GL_CWD -Verb RunAs -PassThru -ErrorAction Stop
  Write-Output 'STARTED'
  $p.WaitForExit()
} catch {
  Write-Output 'CANCELLED'
  exit 1
}
`

// Tiến trình trả về là PowerShell: nó thoát khi exe được chạy thoát
function spawnElevated(exePath: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ELEVATED_SCRIPT],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...process.env, GL_EXE: exePath, GL_CWD: dirname(exePath) }
      }
    )

    let output = ''
    child.stdout!.on('data', (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes('STARTED')) resolve(child)
      else if (output.includes('CANCELLED')) {
        reject(new Error('Game cần quyền Administrator nhưng yêu cầu đã bị huỷ'))
      }
    })
    child.once('error', reject)
    child.once('exit', () => reject(new Error('Không thể chạy game với quyền Administrator')))
  })
}

// Thử chạy bình thường; nếu exe đòi quyền admin (EACCES trên Windows) thì chạy lại qua UAC
async function startExe(exePath: string): Promise<ChildProcess> {
  try {
    return await spawnExe(exePath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (process.platform === 'win32' && code === 'EACCES') {
      return spawnElevated(exePath)
    }
    throw err
  }
}

// ---------- Bật game ----------

export async function launchGame(id: string): Promise<LaunchResult> {
  const game = gameService.getGameById(id)
  if (!game) return { ok: false, error: 'Không tìm thấy game' }
  if (sessions.has(id)) return { ok: false, error: `${game.title} đang chạy rồi` }

  const target = game.exe_path.trim()
  const explicitNames = parseProcessNames(game.process_name ?? '')

  try {
    let child: ChildProcess | null = null

    if (isSteamUri(target)) {
      // Steam: giao cho Steam client mở
      await shell.openExternal(target)
    } else if (!existsSync(target)) {
      return { ok: false, error: `Không tìm thấy file: ${target}` }
    } else if (extname(target).toLowerCase() !== '.exe') {
      // Shortcut / batch / file khác: mở bằng shell của hệ điều hành
      const errorMessage = await shell.openPath(target)
      if (errorMessage) return { ok: false, error: errorMessage }
    } else {
      child = await startExe(target)
    }

    if (explicitNames.length > 0) {
      // Có chỉ định tiến trình game => theo dõi được cả game Steam / shortcut
      startSession(id, 'explicit', new Set(explicitNames), child)
    } else if (child) {
      // Không chỉ định: theo dõi mọi exe trong thư mục game (launcher -> game)
      const names = await collectExeNames(dirname(target))
      names.add(basename(target).toLowerCase())
      startSession(id, 'auto', names, child)
    }
    // Steam / shortcut không chỉ định tiến trình: không theo dõi được, chỉ ghi lần chơi cuối

    const updated = gameService.recordPlaySession(id, 0)!
    if (sessions.has(id)) broadcast({ gameId: id, running: true, game: updated })
    return { ok: true, game: updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không thể mở game' }
  }
}

// Thoát launcher khi game còn chạy: lưu lại giờ chơi tính tới thời điểm này
app.on('before-quit', () => {
  for (const id of getRunningGameIds()) endSession(id)
})
