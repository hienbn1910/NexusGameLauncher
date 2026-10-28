import { ipcMain } from 'electron'
import * as sgdb from '../services/steamgriddb.service'

// Gói lỗi thành { ok: false, error } để renderer hiển thị được message tiếng Việt
// (lỗi throw qua IPC bị Electron thêm tiền tố "Error invoking remote method...")
async function wrap<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Có lỗi xảy ra' }
  }
}

export function registerSteamGridDbHandlers(): void {
  ipcMain.handle('sgdb:isConfigured', () => sgdb.isConfigured())

  ipcMain.handle('sgdb:saveApiKey', (_e, apiKey: string) => wrap(() => sgdb.saveApiKey(apiKey)))

  ipcMain.handle('sgdb:search', (_e, term: string) => wrap(() => sgdb.searchGames(term)))

  ipcMain.handle('sgdb:getBySteamAppId', (_e, appId: string) =>
    wrap(() => sgdb.getGameBySteamAppId(appId))
  )

  ipcMain.handle('sgdb:getImages', (_e, gameId: number, kind: sgdb.ImageKind, page: number) =>
    wrap(() => sgdb.getImages(gameId, kind, page))
  )

  ipcMain.handle('sgdb:download', (_e, url: string) => wrap(() => sgdb.downloadImage(url)))
}
