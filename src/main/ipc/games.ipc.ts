import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as gameService from '../services/game.service'

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

  ipcMain.handle('games:delete', (_event, id: string) => {
    return gameService.deleteGame(id)
  })
}
