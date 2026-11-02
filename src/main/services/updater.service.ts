import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

// Cập nhật tự động từ GitHub Releases (cấu hình publish trong electron-builder.yml).
// Tự tải bản mới ở nền; tải xong thì giao diện hỏi "Khởi động lại để cập nhật".
// Người dùng thoát app lúc đã tải xong thì bản mới cũng được cài khi thoát.

export type UpdateState =
  | 'disabled' // Bản dev: không cập nhật
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready' // Đã tải xong, chờ khởi động lại
  | 'latest' // Đang là bản mới nhất
  | 'error'

export interface UpdateStatus {
  currentVersion: string
  state: UpdateState
  version: string | null // Phiên bản mới (khi có)
  progress: number | null // % đã tải
  error: string | null
}

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let status: UpdateStatus = {
  currentVersion: app.getVersion(),
  state: app.isPackaged ? 'idle' : 'disabled',
  version: null,
  progress: null,
  error: null
}

function update(patch: Partial<UpdateStatus>): void {
  status = { ...status, ...patch }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('app:updateStatus', status)
  }
}

export const getUpdateStatus = (): UpdateStatus => status

export function startAutoUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    if (status.state !== 'ready') update({ state: 'checking', error: null })
  })
  autoUpdater.on('update-available', (info) =>
    update({ state: 'downloading', version: info.version, progress: 0 })
  )
  autoUpdater.on('update-not-available', () => update({ state: 'latest', version: null }))
  autoUpdater.on('download-progress', (p) => update({ progress: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info) =>
    update({ state: 'ready', version: info.version, progress: 100 })
  )
  autoUpdater.on('error', () =>
    // Lỗi mạng / GitHub chưa có bản phát hành: lần kiểm tra sau thử lại
    update({ state: 'error', error: 'Không kiểm tra được bản cập nhật' })
  )

  void checkForUpdates()
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS)
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged || status.state === 'downloading' || status.state === 'ready') return status
  await autoUpdater.checkForUpdates().catch(() => undefined)
  return status
}

// Thoát và cài bản mới ngay (cửa sổ không bị giữ ở khay vì app đang thoát)
export function installUpdate(): void {
  if (status.state === 'ready') autoUpdater.quitAndInstall()
}
