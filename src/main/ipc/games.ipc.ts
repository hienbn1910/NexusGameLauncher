import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as coverService from '../services/cover.service'
import * as exeMetadataService from '../services/exe-metadata.service'
import * as gameService from '../services/game.service'
import * as launcherService from '../services/launcher.service'
import * as steamArtService from '../services/steam-art.service'

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

  // imagePath = null để xoá ảnh bìa; kind = 'poster' cho ảnh dọc
  ipcMain.handle(
    'games:setCover',
    (_event, id: string, imagePath: string | null, kind?: string) => {
      return coverService.setCover(id, imagePath, kind === 'poster' ? 'poster' : 'cover')
    }
  )

  // Tìm Steam App ID theo tên game; null nếu không thấy hoặc lỗi mạng
  ipcMain.handle('games:findSteamApp', async (_event, title: string) => {
    try {
      return await steamArtService.findSteamApp(String(title ?? ''))
    } catch {
      return null
    }
  })

  ipcMain.handle('games:getAll', () => {
    return gameService.getAllGames()
  })

  ipcMain.handle('games:getById', (_event, id: string) => {
    return gameService.getGameById(id)
  })

  // Sau khi thêm/sửa: tự tìm ảnh Steam ở nền, có ảnh sẽ báo qua sự kiện games:updated
  ipcMain.handle('games:create', (_event, input) => {
    const game = gameService.createGame(input)
    void steamArtService.autoFetchArt(game.id)
    return game
  })

  ipcMain.handle('games:update', (_event, id: string, input) => {
    const game = gameService.updateGame(id, input)
    if (game) void steamArtService.autoFetchArt(game.id)
    return game
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
