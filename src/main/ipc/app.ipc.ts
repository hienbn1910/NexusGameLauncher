import { ipcMain } from 'electron'
import * as appDataService from '../services/app-data.service'
import * as themeService from '../services/theme.service'
import * as trayService from '../services/tray.service'
import * as updaterService from '../services/updater.service'

// Lỗi trả về dạng { ok: false, error } để giao diện hiện được message tiếng Việt
async function wrap<T>(
  fn: () => T | Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Có lỗi xảy ra' }
  }
}

export function registerAppHandlers(): void {
  ipcMain.handle('app:getDataInfo', () => appDataService.getDataInfo())
  ipcMain.handle('app:openDataFolder', () => wrap(() => appDataService.openDataFolder()))
  ipcMain.handle('app:resetData', () => wrap(() => appDataService.resetAllData()))
  ipcMain.handle('app:getAppearance', () => themeService.getAppearance())
  ipcMain.handle('app:setTheme', (_e, theme: unknown) => wrap(() => themeService.setTheme(theme)))

  // Phiên bản và cập nhật tự động
  ipcMain.handle('app:getUpdateStatus', () => updaterService.getUpdateStatus())
  ipcMain.handle('app:checkForUpdates', () => updaterService.checkForUpdates())
  ipcMain.handle('app:installUpdate', () => updaterService.installUpdate())

  // Chạy nền: thu nhỏ xuống khay khi đóng cửa sổ, khởi động cùng Windows
  ipcMain.handle('app:getBackgroundSettings', () => trayService.getBackgroundSettings())
  ipcMain.handle('app:setCloseToTray', (_e, enabled: unknown) =>
    trayService.setCloseToTray(enabled === true)
  )
  ipcMain.handle('app:setOpenAtLogin', (_e, enabled: unknown) =>
    wrap(() => trayService.setOpenAtLogin(enabled === true))
  )
}
