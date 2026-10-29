import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as profileService from '../services/profile.service'

export function registerProfileHandlers(): void {
  ipcMain.handle('profile:get', () => profileService.getProfile())

  // Lỗi (ảnh hỏng, sai định dạng) trả về dạng { ok: false, error } để hiện trong hộp thoại
  ipcMain.handle('profile:save', async (_e, input: profileService.ProfileInput) => {
    try {
      return { ok: true, data: await profileService.saveProfile(input) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Không lưu được hồ sơ' }
    }
  })

  ipcMain.handle('profile:skipOnboarding', () => profileService.skipOnboarding())

  ipcMain.handle('profile:pickAvatar', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Chọn ảnh đại diện',
      properties: ['openFile'],
      filters: [{ name: 'Ảnh', extensions: profileService.AVATAR_EXTENSIONS }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    const path = result.filePaths[0]
    const preview = profileService.previewAvatar(path)
    return preview ? { path, preview } : null
  })

  // Ảnh kéo-thả vào hộp thoại
  ipcMain.handle('profile:previewAvatar', (_e, imagePath: string) => {
    const preview = profileService.previewAvatar(String(imagePath))
    return preview ? { path: imagePath, preview } : null
  })
}
