import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as coverService from '../services/cover.service'
import * as exeMetadataService from '../services/exe-metadata.service'
import * as gameService from '../services/game.service'
import * as gameFilesService from '../services/game-files.service'
import * as launcherService from '../services/launcher.service'
import * as playTracker from '../services/play-tracker.service'
import * as steamDetailsService from '../services/steam-details.service'
import * as steamArtService from '../services/steam-art.service'

export function registerGameHandlers(): void {
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
      const safeKind = kind === 'poster' || kind === 'logo' ? kind : 'cover'
      return coverService.setCover(id, imagePath, safeKind)
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
  // Thêm/sửa/xoá game => tính lại thư mục theo dõi giờ chơi
  ipcMain.handle('games:create', (_event, input) => {
    const game = gameService.createGame(input)
    playTracker.invalidateTargets()
    void steamArtService.autoFetchArt(game.id)
    return game
  })

  ipcMain.handle('games:update', (_event, id: string, input) => {
    const game = gameService.updateGame(id, input)
    playTracker.invalidateTargets()
    if (game) void steamArtService.autoFetchArt(game.id)
    return game
  })

  ipcMain.handle('games:delete', async (_event, id: string) => {
    const game = gameService.getGameById(id)
    if (game) await coverService.deleteCover(game)
    const deleted = gameService.deleteGame(id)
    playTracker.invalidateTargets()
    return deleted
  })

  ipcMain.handle('games:launch', (_event, id: string) => {
    return launcherService.launchGame(id)
  })

  ipcMain.handle('games:getRunning', () => {
    return playTracker.getRunningSessions()
  })

  // ---------- Theo dõi giờ chơi ----------

  // Chọn thư mục theo dõi; trả về lỗi nếu thư mục quá chung (ổ đĩa, Program Files...)
  ipcMain.handle('games:selectWatchDir', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Chọn thư mục game',
      properties: ['openDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return null
    const path = result.filePaths[0]
    return { path, error: playTracker.validateWatchDir(path) }
  })

  ipcMain.handle('games:validateWatchDir', (_event, path: string) =>
    playTracker.validateWatchDir(String(path))
  )

  // Gợi ý thư mục game (exe do launcher sinh ra): đồng ý / bỏ qua
  ipcMain.handle('games:acceptWatchDir', (_event, id: string, dir: string) =>
    playTracker.acceptWatchDir(String(id), String(dir))
  )
  ipcMain.handle('games:dismissWatchDir', (_event, id: string, dir: string) =>
    playTracker.dismissWatchDir(String(id), String(dir))
  )

  ipcMain.handle('games:getTrackingInfo', () => playTracker.getTrackingInfo())
  ipcMain.handle('games:setAutoDetect', (_event, enabled: boolean) =>
    playTracker.setAutoDetect(enabled === true)
  )

  ipcMain.handle('games:getArtColor', (_event, id: string) => {
    return coverService.getArtColor(id)
  })

  // ---------- Trang chi tiết game ----------

  ipcMain.handle('games:getGameStats', (_event, id: string) => {
    return gameService.getGameStats(String(id))
  })

  ipcMain.handle('games:setNotes', (_event, id: string, notes: string) => {
    return gameService.setNotes(String(id), String(notes ?? ''))
  })

  ipcMain.handle('games:getSteamDetails', (_event, id: string, force?: boolean) => {
    return steamDetailsService.getSteamDetails(String(id), force === true)
  })

  ipcMain.handle('games:getInstallInfo', async (_event, id: string, withSize?: boolean) => {
    const path = await gameFilesService.getInstallDir(String(id))
    const size = withSize ? await gameFilesService.getFolderSize(String(id)) : null
    return { path, size }
  })

  // Lỗi trả về dạng chuỗi để giao diện hiện thông báo
  ipcMain.handle('games:openFolder', async (_event, id: string) => {
    try {
      await gameFilesService.openInstallDir(String(id))
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Không mở được thư mục game'
    }
  })

  ipcMain.handle('games:getStats', () => {
    return gameService.getPlayStats()
  })
}
