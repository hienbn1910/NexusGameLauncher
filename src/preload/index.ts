import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  games: {
    getAll: () => ipcRenderer.invoke('games:getAll'),
    getById: (id: string) => ipcRenderer.invoke('games:getById', id),
    create: (input) => ipcRenderer.invoke('games:create', input),
    update: (id: string, input) => ipcRenderer.invoke('games:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('games:delete', id)
  }
})
