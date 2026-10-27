import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  games: {
    getAll: () => ipcRenderer.invoke('games:getAll'),
    getById: (id: string) => ipcRenderer.invoke('games:getById', id),
    create: (input) => ipcRenderer.invoke('games:create', input),
    update: (id: string, input) => ipcRenderer.invoke('games:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('games:delete', id),
    selectExe: () => ipcRenderer.invoke('games:selectExe'),
    launch: (id: string) => ipcRenderer.invoke('games:launch', id),
    getRunning: () => ipcRenderer.invoke('games:getRunning'),
    // Đăng ký nhận sự kiện game bắt đầu/kết thúc, trả về hàm huỷ đăng ký
    onSessionChanged: (callback: (event: unknown) => void) => {
      const listener = (_e: IpcRendererEvent, payload: unknown): void => callback(payload)
      ipcRenderer.on('games:sessionChanged', listener)
      return () => ipcRenderer.removeListener('games:sessionChanged', listener)
    }
  }
})
