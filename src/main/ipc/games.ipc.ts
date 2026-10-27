import { ipcMain } from 'electron'
import * as gameService from '../services/game.service'

export function registerGameHandlers() {
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
