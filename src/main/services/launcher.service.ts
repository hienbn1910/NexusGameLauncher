import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { dirname, extname } from 'path'
import { shell } from 'electron'
import * as gameService from './game.service'
import type { Game } from './game.service'
import { relink } from './catalog.service'
import { invalidateTargets, isTracking, trackLaunch } from './play-tracker.service'

// code 'unlinked': game chưa có file chạy => giao diện mở form để người dùng chọn file
export type LaunchResult =
  { ok: true; game: Game } | { ok: false; error: string; code?: 'unlinked'; game?: Game }

function isSteamUri(path: string): boolean {
  return /^steam:\/\//i.test(path.trim())
}

// ---------- Chạy exe ----------

// Chạy file exe và chờ tới khi tiến trình thực sự được tạo (hoặc báo lỗi)
function spawnExe(exePath: string, args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(exePath, args, {
      cwd: dirname(exePath), // Nhiều game cần chạy đúng thư mục để tìm file data
      detached: true, // Đóng launcher không làm tắt game
      stdio: 'ignore'
    })
    child.once('spawn', () => resolve(child))
    child.once('error', reject)
  })
}

// Script PowerShell chạy exe với quyền Administrator (hiện hộp thoại UAC) rồi chờ game thoát.
// Đường dẫn + tham số truyền qua biến môi trường để không phải xử lý escape ký tự đặc biệt.
const ELEVATED_SCRIPT = `
try {
  $params = @{ FilePath = $env:GL_EXE; WorkingDirectory = $env:GL_CWD; Verb = 'RunAs'; PassThru = $true; ErrorAction = 'Stop' }
  if ($env:GL_ARGS) { $params.ArgumentList = $env:GL_ARGS }
  $p = Start-Process @params
  Write-Output 'STARTED'
  $p.WaitForExit()
} catch {
  Write-Output 'CANCELLED'
  exit 1
}
`

// Tiến trình trả về là PowerShell: nó thoát khi exe được chạy thoát
function spawnElevated(exePath: string, args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ELEVATED_SCRIPT],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          GL_EXE: exePath,
          GL_CWD: dirname(exePath),
          // Tham số trong danh mục không có dấu cách nên ghép bằng dấu cách là đủ
          GL_ARGS: args.join(' ')
        }
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
async function startExe(exePath: string, args: string[]): Promise<ChildProcess> {
  try {
    return await spawnExe(exePath, args)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (process.platform === 'win32' && code === 'EACCES') {
      return spawnElevated(exePath, args)
    }
    throw err
  }
}

// ---------- Bật game ----------

export async function launchGame(id: string): Promise<LaunchResult> {
  let game = gameService.getGameById(id)
  if (!game) return { ok: false, error: 'Không tìm thấy game' }
  if (isTracking(id)) return { ok: false, error: `${game.title} đang chạy rồi` }

  // Game thêm từ danh mục nhưng chưa có trên máy: thử tìm lại (có thể vừa cài xong)
  if (!gameService.isLinked(game)) {
    const relinked = await relink(game).catch(() => null)
    if (!relinked) {
      return {
        ok: false,
        code: 'unlinked',
        game,
        error: `Chọn file chạy của ${game.title} để bắt đầu chơi`
      }
    }
    game = relinked
    invalidateTargets()
  }

  const target = game.exe_path.trim()
  const args = gameService.parseLaunchArgs(game.launch_args)

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
      child = await startExe(target, args)
    }

    // Theo dõi giờ chơi theo thư mục game (cả game Steam / shortcut nếu biết thư mục cài)
    const tracked = await trackLaunch(game, child)
    // Không theo dõi được: vẫn ghi lại lần chơi cuối
    if (!tracked) gameService.recordPlaySession(id, 0)
    return { ok: true, game: gameService.getGameById(id)! }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Không thể mở game' }
  }
}
