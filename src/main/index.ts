import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { runMigrations } from './database/migrate'
import { registerGameHandlers } from './ipc/games.ipc'
import { registerSteamGridDbHandlers } from './ipc/steamgriddb.ipc'
import { initDatabase } from './database'
import { registerMediaProtocol, registerMediaScheme } from './services/cover.service'
import { autoFetchAllArt } from './services/steam-art.service'
import { cleanupTempDownloads } from './services/steamgriddb.service'
import { registerNewsHandlers } from './ipc/news.ipc'
import { registerProfileHandlers } from './ipc/profile.ipc'
import { registerAppHandlers } from './ipc/app.ipc'
import { startTracker } from './services/play-tracker.service'
import { fillMissingCatalogArt, fillMissingGameExe } from './services/catalog.service'
import { applyNetworkSettings } from './services/network.service'
import { cleanupNewsImages } from './services/news-image.service'
import { setupTray, showMainWindow, startedHidden } from './services/tray.service'
import { startAutoUpdate } from './services/updater.service'

const APP_NAME = 'Nexus Launcher'

// Giữ thư mục dữ liệu cũ (%APPDATA%\game-launcher) để không mất database và ảnh bìa khi đổi tên app
app.setPath('userData', join(app.getPath('appData'), 'game-launcher'))
app.setName(APP_NAME)

// Chỉ chạy một bản: hai bản cùng chạy sẽ cùng tính giờ chơi (cộng đôi) và cùng ghi một database.
// Mở app lần nữa => hiện cửa sổ của bản đang chạy
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) app.quit()
else app.on('second-instance', () => showMainWindow())

// Scheme game-media:// (ảnh bìa) phải đăng ký trước khi app ready
registerMediaScheme()

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#08090c', // Gần với nền của mọi theme, tránh nháy trắng khi mở
    show: false,
    title: APP_NAME,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Mở cùng Windows (--hidden): chạy ẩn ở khay, chỉ theo dõi giờ chơi
  mainWindow.on('ready-to-show', () => {
    if (!startedHidden()) mainWindow.show()
  })
  setupTray(mainWindow, icon)

  // Giao diện đã sẵn sàng nhận sự kiện: tự tìm ảnh Steam cho game còn thiếu ảnh
  mainWindow.webContents.once('did-finish-load', () => {
    void autoFetchAllArt()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!isPrimaryInstance) return // Đang thoát vì đã có bản khác chạy
  initDatabase()
  runMigrations()
  registerGameHandlers()
  registerMediaProtocol()
  registerSteamGridDbHandlers()
  registerNewsHandlers()
  registerProfileHandlers()
  registerAppHandlers()
  fillMissingGameExe() // Icon game thật cho game thêm từ danh mục (thay icon launcher)
  // Ảnh dọc / nền banner / logo đóng gói sẵn cho game trong danh mục còn thiếu ảnh
  await fillMissingCatalogArt().catch(() => undefined)
  startTracker() // Theo dõi giờ chơi + tự nhận game mở ngoài Nexus
  void cleanupTempDownloads()
  void cleanupNewsImages()
  // DNS bảo mật / proxy người dùng đã chọn (lỗi thì vẫn mở app với mạng mặc định)
  await applyNetworkSettings().catch(() => undefined)
  // Windows nhóm cửa sổ trên taskbar và hiển thị thông báo theo ID này
  electronApp.setAppUserModelId('com.nexus.launcher')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()
  startAutoUpdate() // Chỉ chạy ở bản cài đặt

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
