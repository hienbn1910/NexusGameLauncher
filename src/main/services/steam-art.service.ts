import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { readdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { app, BrowserWindow, net } from 'electron'
import { setCover, type CoverKind } from './cover.service'
import * as gameService from './game.service'
import type { Game } from './game.service'

// Tự lấy ảnh bìa từ Steam (không cần API key):
// 1. Tìm Steam App ID: game Steam => steam_appid.txt => appmanifest trong steamapps => tìm theo tên
// 2. Lấy ảnh: thư mục cache của Steam trên máy => CDN của Steam
// Game không có trên Steam thì giao diện tự dùng icon file exe.

const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps'
// Chỉ tải ảnh từ máy chủ ảnh của Steam
const ALLOWED_HOST = /(^|\.)steamstatic\.com$/i
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
// Đổi khi sửa cách tìm để các game đã tìm trước đó được tìm lại
const LOOKUP_VERSION = 'v1'

// File ảnh Steam cho từng ô, theo thứ tự ưu tiên
// poster: ảnh dọc thư viện; cover: ảnh nền lớn (hợp banner) => capsule => header
const ART_FILES: Record<CoverKind, string[]> = {
  poster: ['library_600x900.jpg'],
  cover: ['library_hero.jpg', 'capsule_616x353.jpg', 'header.jpg']
}

const isSteamUri = (value: string): boolean => /^steam:\/\//i.test(value.trim())

// Lỗi mạng => không đánh dấu đã tìm, lần mở app sau sẽ thử lại
class NetworkError extends Error {}

async function fetchOrThrow(url: string): Promise<Response> {
  try {
    return await net.fetch(url)
  } catch {
    throw new NetworkError(`Không kết nối được: ${url}`)
  }
}

// ---------- Tìm Steam App ID ----------

// Nhiều game cài từ Steam có file steam_appid.txt ở thư mục game
async function appIdFromFile(exePath: string): Promise<string | null> {
  let dir = dirname(exePath)
  for (let i = 0; i < 4 && dir !== dirname(dir); i++) {
    try {
      const id = (await readFile(join(dir, 'steam_appid.txt'), 'utf8')).trim()
      if (/^\d+$/.test(id)) return id
    } catch {
      // Không có file, thử thư mục cha
    }
    // Đã tới thư mục gốc của game trong steamapps\common
    if (basename(dirname(dir)).toLowerCase() === 'common') break
    dir = dirname(dir)
  }
  return null
}

// Exe nằm trong ...\steamapps\common\<Thư mục game>: đọc appmanifest_<id>.acf để biết App ID
async function appIdFromManifest(exePath: string): Promise<string | null> {
  const match = exePath.match(/^(.*[\\/]steamapps)[\\/]common[\\/]([^\\/]+)/i)
  if (!match) return null
  const [, steamapps, installDir] = match

  let files: string[]
  try {
    files = await readdir(steamapps)
  } catch {
    return null
  }
  for (const file of files) {
    if (!/^appmanifest_\d+\.acf$/i.test(file)) continue
    try {
      const content = await readFile(join(steamapps, file), 'utf8')
      const dir = content.match(/"installdir"\s+"([^"]+)"/i)?.[1]
      const id = content.match(/"appid"\s+"(\d+)"/i)?.[1]
      if (id && dir?.toLowerCase() === installDir.toLowerCase()) return id
    } catch {
      // Bỏ qua file lỗi
    }
  }
  return null
}

// "Hollow Knight™" / "HOLLOW KNIGHT" / "Hollow-Knight" => "hollow knight"
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[®™©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

interface SteamApp {
  id: string
  name: string
}

// Các thư mục steamapps của mọi thư viện Steam (ổ C, D, E...) đọc từ libraryfolders.vdf
async function steamappsDirs(): Promise<string[]> {
  const root = await steamPath()
  if (!root) return []
  const dirs = [join(root, 'steamapps')]
  try {
    const vdf = await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    for (const [, path] of vdf.matchAll(/"path"\s+"([^"]+)"/gi)) {
      dirs.push(join(path.replace(/\\\\/g, '\\'), 'steamapps'))
    }
  } catch {
    // Không có file => chỉ dùng thư viện mặc định
  }
  // Bỏ trùng (thư viện mặc định cũng nằm trong libraryfolders.vdf)
  return [...new Map(dirs.map((d) => [d.toLowerCase(), d])).values()]
}

// Game Steam đã cài trên máy (đọc appmanifest_*.acf, không cần mạng)
async function installedSteamApps(): Promise<SteamApp[]> {
  const apps: SteamApp[] = []
  for (const dir of await steamappsDirs()) {
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue // Ổ đĩa đã rút / thư viện không còn
    }
    for (const file of files) {
      if (!/^appmanifest_\d+\.acf$/i.test(file)) continue
      try {
        const content = await readFile(join(dir, file), 'utf8')
        const id = content.match(/"appid"\s+"(\d+)"/i)?.[1]
        const name = content.match(/"name"\s+"([^"]+)"/i)?.[1]
        if (id && name) apps.push({ id, name })
      } catch {
        // Bỏ qua file lỗi
      }
    }
  }
  return apps
}

// Tìm theo tên trên Steam Store và Steam Community, chỉ nhận kết quả trùng tên
// (tránh nhầm sang soundtrack, DLC, phần khác cùng series)
async function searchSteamOnline(title: string): Promise<SteamApp | null> {
  const target = normalizeName(title)
  if (target.length < 2) return null
  const term = encodeURIComponent(title.trim())

  const sources: [string, (json: unknown) => { id: string; name: string }[]][] = [
    [
      `https://store.steampowered.com/api/storesearch/?term=${term}&cc=us&l=en`,
      (json) =>
        ((json as { items?: { id: number; name: string; type?: string }[] }).items ?? [])
          .filter((i) => !i.type || i.type === 'app')
          .map((i) => ({ id: String(i.id), name: i.name }))
    ],
    // Thấy được cả game không bán ở khu vực US
    [
      `https://steamcommunity.com/actions/SearchApps/${term}`,
      (json) =>
        (Array.isArray(json) ? (json as { appid: string; name: string }[]) : []).map((i) => ({
          id: String(i.appid),
          name: i.name
        }))
    ]
  ]

  for (const [url, parse] of sources) {
    const res = await fetchOrThrow(url)
    if (!res.ok) continue
    const json = await res.json().catch(() => null)
    const found = parse(json).find((r) => normalizeName(r.name) === target)
    if (found && /^\d+$/.test(found.id)) return found
  }
  return null
}

export interface SteamAppMatch {
  appId: string
  name: string
  installed: boolean // Tìm thấy trong thư viện Steam trên máy
}

// Tìm game Steam theo tên: game đã cài trên máy trước, rồi mới tìm online
export async function findSteamApp(title: string): Promise<SteamAppMatch | null> {
  const target = normalizeName(title)
  if (target.length < 2) return null

  const local = (await installedSteamApps()).find((a) => normalizeName(a.name) === target)
  if (local) return { appId: local.id, name: local.name, installed: true }

  const online = await searchSteamOnline(title)
  return online ? { appId: online.id, name: online.name, installed: false } : null
}

async function findAppId(game: Game): Promise<string | null> {
  if (game.source === 'steam' && game.source_id) return game.source_id

  const exe = game.exe_path.trim()
  if (!isSteamUri(exe) && existsSync(exe)) {
    const id = (await appIdFromFile(exe)) ?? (await appIdFromManifest(exe))
    if (id) return id
  }
  return (await findSteamApp(game.title))?.appId ?? null
}

// ---------- Ảnh có sẵn trên máy ----------

let steamPathPromise: Promise<string | null> | null = null

// Thư mục cài Steam, đọc từ registry
function steamPath(): Promise<string | null> {
  steamPathPromise ??= new Promise((resolve) => {
    const fallback = 'C:\\Program Files (x86)\\Steam'
    if (process.platform !== 'win32') return resolve(null)
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { windowsHide: true },
      (err, stdout) => {
        const path = err ? null : stdout.match(/SteamPath\s+REG_SZ\s+(.+)/)?.[1]?.trim()
        if (path && existsSync(path)) resolve(path)
        else resolve(existsSync(fallback) ? fallback : null)
      }
    )
  })
  return steamPathPromise
}

// Steam lưu ảnh thư viện trong appcache\librarycache:
// bản cũ: <appid>_library_600x900.jpg, bản mới: <appid>\library_600x900.jpg hoặc <appid>\<hash>\...
async function localArt(appId: string, file: string): Promise<string | null> {
  const root = await steamPath()
  if (!root) return null
  const cache = join(root, 'appcache', 'librarycache')

  const candidates = [join(cache, `${appId}_${file}`), join(cache, appId, file)]
  try {
    for (const entry of await readdir(join(cache, appId), { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(join(cache, appId, entry.name, file))
    }
  } catch {
    // Không có thư mục cache của game này
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

// ---------- Ảnh trên CDN ----------

function tempDir(): string {
  return app.getPath('temp')
}

// Tải ảnh về file tạm; null nếu ảnh không tồn tại (404)
async function downloadArt(url: string): Promise<string | null> {
  if (!ALLOWED_HOST.test(new URL(url).host)) return null
  const res = await fetchOrThrow(url)
  if (!res.ok) return null
  if (!(res.headers.get('content-type') ?? '').startsWith('image/')) return null

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null

  const path = join(tempDir(), `game-launcher-steam-${Date.now()}.jpg`)
  await writeFile(path, buffer)
  return path
}

// Một số game đặt ảnh ở đường dẫn có hash; appdetails cho biết thư mục ảnh thật
async function assetBaseFromDetails(appId: string): Promise<string | null> {
  const res = await fetchOrThrow(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`
  )
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as Record<
    string,
    { success: boolean; data?: { header_image?: string } }
  > | null
  const header = json?.[appId]?.data?.header_image
  return header ? header.replace(/header\.jpg.*$/i, '') : null
}

// ---------- Tự lấy ảnh ----------

const COLUMN: Record<CoverKind, 'cover_path' | 'poster_path'> = {
  cover: 'cover_path',
  poster: 'poster_path'
}

// Lấy ảnh cho một ô (poster/cover); trả về true nếu đã đặt ảnh
async function fillSlot(
  gameId: string,
  appId: string,
  kind: CoverKind,
  getAssetBase: () => Promise<string | null>
): Promise<boolean> {
  const files = ART_FILES[kind]

  const trySet = async (path: string, temporary: boolean): Promise<boolean> => {
    try {
      // Người dùng có thể vừa tự chọn ảnh trong lúc đang tìm => không ghi đè
      const current = gameService.getGameById(gameId)
      if (!current || current[COLUMN[kind]]) return false
      await setCover(gameId, path, kind)
      return true
    } catch {
      return false
    } finally {
      if (temporary) await rm(path, { force: true })
    }
  }

  for (const file of files) {
    const local = await localArt(appId, file)
    if (local && (await trySet(local, false))) return true
  }
  for (const file of files) {
    const tmp = await downloadArt(`${CDN}/${appId}/${file}`)
    if (tmp) return trySet(tmp, true)
  }
  const base = await getAssetBase()
  if (base) {
    for (const file of files) {
      const tmp = await downloadArt(`${base}${file}`)
      if (tmp) return trySet(tmp, true)
    }
  }
  return false
}

function lookupKey(game: Game): string {
  return [LOOKUP_VERSION, game.title, game.exe_path, game.process_name ?? ''].join('|')
}

function broadcastUpdated(game: Game): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('games:updated', game)
  }
}

const inFlight = new Set<string>()

// Tự tìm ảnh cho các ô còn trống. Mỗi bộ (tên, đường dẫn) chỉ tìm một lần,
// đổi tên/đường dẫn game thì tìm lại. Không bao giờ ghi đè ảnh đã có.
export async function autoFetchArt(gameId: string): Promise<void> {
  const game = gameService.getGameById(gameId)
  if (!game || inFlight.has(gameId)) return
  if (game.cover_path && game.poster_path) return
  const key = lookupKey(game)
  if (game.art_lookup === key) return

  inFlight.add(gameId)
  try {
    const appId = await findAppId(game)
    let changed = false

    if (appId) {
      let assetBase: Promise<string | null> | null = null
      const getAssetBase = (): Promise<string | null> =>
        (assetBase ??= assetBaseFromDetails(appId).catch(() => null))

      for (const kind of ['poster', 'cover'] as CoverKind[]) {
        if (game[COLUMN[kind]]) continue
        if (await fillSlot(gameId, appId, kind, getAssetBase)) changed = true
      }
    }

    gameService.setArtLookup(gameId, key)
    const updated = gameService.getGameById(gameId)
    if (changed && updated) broadcastUpdated(updated)
  } catch {
    // Lỗi mạng: để lần sau thử lại
  } finally {
    inFlight.delete(gameId)
  }
}

// Chạy khi mở app: lần lượt từng game để không gửi quá nhiều request cùng lúc
export async function autoFetchAllArt(): Promise<void> {
  for (const game of gameService.getAllGames()) {
    await autoFetchArt(game.id)
  }
}
