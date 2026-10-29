import { ipcMain } from 'electron'
import * as networkService from '../services/network.service'
import * as newsService from '../services/news.service'

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

const TABS: newsService.NewsTab[] = ['library', 'following', 'sites']

export function registerNewsHandlers(): void {
  ipcMain.handle('news:get', (_e, tab: string, force?: boolean) =>
    wrap(() =>
      newsService.getNews(
        TABS.includes(tab as newsService.NewsTab) ? (tab as newsService.NewsTab) : 'library',
        force === true
      )
    )
  )

  ipcMain.handle('news:getFollowing', () => newsService.getFollowing())
  ipcMain.handle('news:getSuggestions', () => newsService.SUGGESTED_GAMES)
  ipcMain.handle('news:follow', (_e, name: string, appId: string | null) =>
    wrap(() => newsService.follow(String(name ?? ''), appId ? String(appId) : null))
  )
  ipcMain.handle('news:unfollow', (_e, id: string) => newsService.unfollow(String(id)))

  ipcMain.handle('news:getSites', () => newsService.getSites())
  ipcMain.handle('news:setSiteEnabled', (_e, id: string, enabled: boolean) =>
    newsService.setSiteEnabled(String(id), enabled === true)
  )

  ipcMain.handle('network:getSettings', () => networkService.getNetworkSettings())
  ipcMain.handle('network:saveSettings', (_e, settings: networkService.NetworkSettings) =>
    wrap(() =>
      networkService.saveNetworkSettings(settings ?? ({} as networkService.NetworkSettings))
    )
  )
  ipcMain.handle('network:testSteam', () => networkService.testSteamConnection())
}
