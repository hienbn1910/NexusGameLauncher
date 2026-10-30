import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  games: {
    getAll: () => ipcRenderer.invoke('games:getAll'),
    getById: (id: string) => ipcRenderer.invoke('games:getById', id),
    create: (input) => ipcRenderer.invoke('games:create', input),
    update: (id: string, input) => ipcRenderer.invoke('games:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('games:delete', id),
    selectExe: () => ipcRenderer.invoke('games:selectExe'),
    inspectExe: (exePath: string) => ipcRenderer.invoke('games:inspectExe', exePath),
    findSteamApp: (title: string) => ipcRenderer.invoke('games:findSteamApp', title),
    selectCover: () => ipcRenderer.invoke('games:selectCover'),
    previewCover: (imagePath: string) => ipcRenderer.invoke('games:previewCover', imagePath),
    setCover: (id: string, imagePath: string | null, kind?: string) =>
      ipcRenderer.invoke('games:setCover', id, imagePath, kind),
    // Lấy đường dẫn thật của file được kéo-thả (File.path đã bị bỏ trong Electron mới)
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    launch: (id: string) => ipcRenderer.invoke('games:launch', id),
    getRunning: () => ipcRenderer.invoke('games:getRunning'),
    getStats: () => ipcRenderer.invoke('games:getStats'),
    getArtColor: (id: string) => ipcRenderer.invoke('games:getArtColor', id),
    getGameStats: (id: string) => ipcRenderer.invoke('games:getGameStats', id),
    setNotes: (id: string, notes: string) => ipcRenderer.invoke('games:setNotes', id, notes),
    getSteamDetails: (id: string, force?: boolean) =>
      ipcRenderer.invoke('games:getSteamDetails', id, force),
    getInstallInfo: (id: string, withSize?: boolean) =>
      ipcRenderer.invoke('games:getInstallInfo', id, withSize),
    openFolder: (id: string) => ipcRenderer.invoke('games:openFolder', id),
    selectWatchDir: () => ipcRenderer.invoke('games:selectWatchDir'),
    validateWatchDir: (path: string) => ipcRenderer.invoke('games:validateWatchDir', path),
    getTrackingInfo: () => ipcRenderer.invoke('games:getTrackingInfo'),
    acceptWatchDir: (id: string, dir: string) =>
      ipcRenderer.invoke('games:acceptWatchDir', id, dir),
    dismissWatchDir: (id: string, dir: string) =>
      ipcRenderer.invoke('games:dismissWatchDir', id, dir),
    // Gợi ý thư mục game khi launcher sinh ra exe ở thư mục lạ
    onWatchDirSuggestion: (callback: (suggestion: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on('games:watchDirSuggestion', listener)
      return () => ipcRenderer.removeListener('games:watchDirSuggestion', listener)
    },
    setAutoDetect: (enabled: boolean) => ipcRenderer.invoke('games:setAutoDetect', enabled),
    // Đăng ký nhận sự kiện game bắt đầu/kết thúc, trả về hàm huỷ đăng ký
    onSessionChanged: (callback: (event: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on('games:sessionChanged', listener)
      return () => ipcRenderer.removeListener('games:sessionChanged', listener)
    },
    // Game được cập nhật từ main process (vd vừa tự lấy được ảnh bìa)
    onUpdated: (callback: (game: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, game: unknown): void => callback(game)
      ipcRenderer.on('games:updated', listener)
      return () => ipcRenderer.removeListener('games:updated', listener)
    }
  },
  news: {
    get: (tab: string, force?: boolean) => ipcRenderer.invoke('news:get', tab, force),
    getGame: (gameId: string, force?: boolean) => ipcRenderer.invoke('news:getGame', gameId, force),
    getFollowing: () => ipcRenderer.invoke('news:getFollowing'),
    getSuggestions: () => ipcRenderer.invoke('news:getSuggestions'),
    follow: (name: string, appId: string | null) => ipcRenderer.invoke('news:follow', name, appId),
    unfollow: (id: string) => ipcRenderer.invoke('news:unfollow', id),
    getSites: () => ipcRenderer.invoke('news:getSites'),
    setSiteEnabled: (id: string, enabled: boolean) =>
      ipcRenderer.invoke('news:setSiteEnabled', id, enabled)
  },
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    save: (input: unknown) => ipcRenderer.invoke('profile:save', input),
    skipOnboarding: () => ipcRenderer.invoke('profile:skipOnboarding'),
    pickAvatar: () => ipcRenderer.invoke('profile:pickAvatar'),
    previewAvatar: (imagePath: string) => ipcRenderer.invoke('profile:previewAvatar', imagePath)
  },
  app: {
    getDataInfo: () => ipcRenderer.invoke('app:getDataInfo'),
    openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
    resetData: () => ipcRenderer.invoke('app:resetData'),
    getAppearance: () => ipcRenderer.invoke('app:getAppearance'),
    setTheme: (theme: string) => ipcRenderer.invoke('app:setTheme', theme)
  },
  network: {
    getSettings: () => ipcRenderer.invoke('network:getSettings'),
    saveSettings: (settings: unknown) => ipcRenderer.invoke('network:saveSettings', settings),
    testSteam: () => ipcRenderer.invoke('network:testSteam')
  },
  steamGridDb: {
    isConfigured: () => ipcRenderer.invoke('sgdb:isConfigured'),
    saveApiKey: (apiKey: string) => ipcRenderer.invoke('sgdb:saveApiKey', apiKey),
    search: (term: string) => ipcRenderer.invoke('sgdb:search', term),
    getBySteamAppId: (appId: string) => ipcRenderer.invoke('sgdb:getBySteamAppId', appId),
    getImages: (gameId: number, kind: string, page: number) =>
      ipcRenderer.invoke('sgdb:getImages', gameId, kind, page),
    download: (url: string) => ipcRenderer.invoke('sgdb:download', url)
  }
})
