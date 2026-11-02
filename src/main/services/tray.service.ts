import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { getSetting, setSetting } from './settings.service'

// Chạy nền ở khay hệ thống: đóng cửa sổ vẫn tiếp tục tính giờ chơi (người dùng hay tắt launcher
// sau khi mở game). Thoát hẳn bằng menu chuột phải ở biểu tượng khay.

const CLOSE_TO_TRAY_SETTING = 'close_to_tray' // '0' = đóng cửa sổ là thoát app
const TRAY_HINT_SETTING = 'tray_hint_shown' // Đã báo "app vẫn chạy ở khay" lần đầu
// Mở cùng Windows thì chạy ẩn ở khay, không bật cửa sổ lên
export const HIDDEN_ARG = '--hidden'

export interface BackgroundSettings {
  closeToTray: boolean
  openAtLogin: boolean
  canAutoStart: boolean // Chỉ bản cài đặt (bản dev sẽ đăng ký nhầm electron.exe)
}

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let quitting = false

app.on('before-quit', () => {
  quitting = true
})

export const startedHidden = (): boolean => process.argv.includes(HIDDEN_ARG)

const closeToTray = (): boolean => getSetting(CLOSE_TO_TRAY_SETTING) !== '0'

export function getBackgroundSettings(): BackgroundSettings {
  return {
    closeToTray: closeToTray(),
    openAtLogin: app.isPackaged && app.getLoginItemSettings({ args: [HIDDEN_ARG] }).openAtLogin,
    canAutoStart: app.isPackaged
  }
}

export function setCloseToTray(enabled: boolean): BackgroundSettings {
  setSetting(CLOSE_TO_TRAY_SETTING, enabled ? '1' : '0')
  return getBackgroundSettings()
}

export function setOpenAtLogin(enabled: boolean): BackgroundSettings {
  if (!app.isPackaged) throw new Error('Chỉ bật được ở bản cài đặt')
  app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_ARG] })
  return getBackgroundSettings()
}

// Hiện cửa sổ chính (bấm biểu tượng khay, hoặc mở app lần nữa khi app đang chạy)
export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

export function setupTray(win: BrowserWindow, iconPath: string): void {
  mainWindow = win

  win.on('close', (e) => {
    if (quitting || !closeToTray()) return
    e.preventDefault()
    win.hide()
    // Lần đầu: báo cho người dùng biết app chưa thoát
    if (getSetting(TRAY_HINT_SETTING) !== '1') {
      setSetting(TRAY_HINT_SETTING, '1')
      tray?.displayBalloon({
        title: 'Nexus Launcher vẫn đang chạy',
        content:
          'App vẫn chạy ở khay hệ thống để tiếp tục tính giờ chơi!',
        iconType: 'info'
      })
    }
  })

  if (tray) return
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }))
  tray.setToolTip('Nexus Launcher')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mở Nexus Launcher', click: showMainWindow },
      { type: 'separator' },
      { label: 'Thoát', click: () => app.quit() }
    ])
  )
  tray.on('click', showMainWindow)
}
