import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { dirname, extname } from 'path'
import { app, BrowserWindow, shell } from 'electron'
import * as gameService from './game.service'
import type { Game } from './game.service'

export type LaunchResult = { ok: true; game: Game } | { ok: false; error: string }

export interface SessionEvent {
  gameId: string
  running: boolean
  game?: Game
}

interface Session {
  startedAt: number
  child: ChildProcess
}

// Các game .exe đang chạy (key = game id) để tính giờ chơi khi thoát
const sessions = new Map<string, Session>()

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

  const hours = (Date.now() - session.startedAt) / 3_600_000
  const game = gameService.recordPlaySession(gameId, hours)
  broadcast({ gameId, running: false, game })
}

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

// Tiến trình trả về là PowerShell: nó thoát khi game thoát, nên vẫn tính được giờ chơi
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

export async function launchGame(id: string): Promise<LaunchResult> {
  const game = gameService.getGameById(id)
  if (!game) return { ok: false, error: 'Không tìm thấy game' }
  if (sessions.has(id)) return { ok: false, error: `${game.title} đang chạy rồi` }

  const target = game.exe_path.trim()

  try {
    // Steam: giao cho Steam client mở, launcher không theo dõi được tiến trình
    if (isSteamUri(target)) {
      await shell.openExternal(target)
      return { ok: true, game: gameService.recordPlaySession(id, 0)! }
    }

    if (!existsSync(target)) {
      return { ok: false, error: `Không tìm thấy file: ${target}` }
    }

    // Shortcut / batch / file khác: mở bằng shell của hệ điều hành
    if (extname(target).toLowerCase() !== '.exe') {
      const errorMessage = await shell.openPath(target)
      if (errorMessage) return { ok: false, error: errorMessage }
      return { ok: true, game: gameService.recordPlaySession(id, 0)! }
    }

    const child = await startExe(target)
    sessions.set(id, { startedAt: Date.now(), child })
    child.once('exit', () => endSession(id))

    const updated = gameService.recordPlaySession(id, 0)!
    broadcast({ gameId: id, running: true, game: updated })
    return { ok: true, game: updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không thể mở game' }
  }
}

// Thoát launcher khi game còn chạy: lưu lại giờ chơi tính tới thời điểm này
app.on('before-quit', () => {
  for (const id of getRunningGameIds()) endSession(id)
})
