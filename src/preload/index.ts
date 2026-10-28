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
    selectCover: () => ipcRenderer.invoke('games:selectCover'),
    previewCover: (imagePath: string) => ipcRenderer.invoke('games:previewCover', imagePath),
    setCover: (id: string, imagePath: string | null) =>
      ipcRenderer.invoke('games:setCover', id, imagePath),
    // Lấy đường dẫn thật của file được kéo-thả (File.path đã bị bỏ trong Electron mới)
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    launch: (id: string) => ipcRenderer.invoke('games:launch', id),
    getRunning: () => ipcRenderer.invoke('games:getRunning'),
    // Đăng ký nhận sự kiện game bắt đầu/kết thúc, trả về hàm huỷ đăng ký
    onSessionChanged: (callback: (event: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on('games:sessionChanged', listener)
      return () => ipcRenderer.removeListener('games:sessionChanged', listener)
    }
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
