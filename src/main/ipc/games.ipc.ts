import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as coverService from '../services/cover.service'
import * as exeMetadataService from '../services/exe-metadata.service'
import * as gameService from '../services/game.service'
import * as launcherService from '../services/launcher.service'

export function registerGameHandlers() {
  // Mở dialog chọn file thực thi, trả về đường dẫn hoặc null nếu người dùng huỷ
  ipcMain.handle('games:selectExe', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Chọn file chạy game',
      properties: ['openFile'],
      filters:
        process.platform === 'win32'
          ? [
              { name: 'Ứng dụng', extensions: ['exe', 'bat', 'lnk'] },
              { name: 'Tất cả file', extensions: ['*'] }
            ]
          : [{ name: 'Tất cả file', extensions: ['*'] }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })

  // Gợi ý tên game từ metadata exe + tên thư mục
  ipcMain.handle('games:inspectExe', (_event, exePath: string) => {
    return exeMetadataService.inspectExe(exePath)
  })

  // Chọn ảnh bìa: trả về đường dẫn + ảnh xem trước, chưa lưu gì cả
  ipcMain.handle('games:selectCover', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Chọn ảnh bìa',
      properties: ['openFile'],
      filters: [{ name: 'Ảnh', extensions: coverService.COVER_EXTENSIONS }]
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    const path = result.filePaths[0]
    const preview = await coverService.createPreview(path)
    return preview ? { path, preview } : null
  })

  // Ảnh kéo-thả vào form
  ipcMain.handle('games:previewCover', (_event, imagePath: string) => {
    return coverService.createPreview(imagePath)
  })

  // imagePath = null để xoá ảnh bìa
  ipcMain.handle('games:setCover', (_event, id: string, imagePath: string | null) => {
    return coverService.setCover(id, imagePath)
  })

  ipcMain.handle('games:getAll', () => {
    return gameService.getAllGames()
  })

  ipcMain.handle('games:getById', (_event, id: string) => {
    return gameService.getGameById(id)
  })

  ipcMain.handle('games:create', (_event, input) => {
    return gameService.createGame(input)
  })

  ipcMain.handle('games:update', (_event, id: string, input) => {
    return gameService.updateGame(id, input)
  })

  ipcMain.handle('games:delete', async (_event, id: string) => {
    const game = gameService.getGameById(id)
    if (game) await coverService.deleteCover(game)
    return gameService.deleteGame(id)
  })

  ipcMain.handle('games:launch', (_event, id: string) => {
    return launcherService.launchGame(id)
  })

  ipcMain.handle('games:getRunning', () => {
    return launcherService.getRunningGameIds()
  })
}
