import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { GAME_CATALOG, type CatalogGame } from '../data/game-catalog'
import * as gameService from './game.service'
import type { Game } from './game.service'
import { cleanPath, listInstalledApps, type InstalledApp } from './installed-apps.service'
import { steamInstallDir, steamPath } from './steam-art.service'

// Danh mục game phổ biến: tự tìm game trên máy (chỉ đọc file / registry, không quét ổ đĩa)
// và thêm vào thư viện theo lựa chọn của người dùng.

// installed = đã cài trên máy; available = chưa cài nhưng mở qua launcher sẽ cài được
// (Steam, Riot Client); missing = không tìm thấy => thêm vào sẽ "chưa liên kết"
export type CatalogStatus = 'installed' | 'available' | 'missing'

export interface CatalogItem {
  id: string
  title: string
  genre: string
  steamAppId: string | null
  status: CatalogStatus
  via: string | null // Mở qua đâu: Steam, Riot Client, HoYoPlay...
  inLibrary: boolean
}

interface Detection {
  status: CatalogStatus
  via: string | null
  exePath: string // '' = chưa liên kết
  launchArgs?: string[]
  watchDirs?: string[]
}

const MISSING: Detection = { status: 'missing', via: null, exePath: '' }

const firstExisting = (base: string, files: string[]): string | null =>
  files.map((f) => join(base, f)).find((p) => existsSync(p)) ?? null

// Bỏ file gỡ cài đặt / icon khi lấy file chạy từ DisplayIcon
const isRunnableExe = (path: string | null): path is string =>
  !!path && /\.exe$/i.test(path) && !/unins|uninstall/i.test(path) && existsSync(path)

// ---------- Riot ----------

const RIOT_DATA = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Riot Games')

async function riotClientPath(): Promise<string | null> {
  try {
    const json = JSON.parse(
      await readFile(join(RIOT_DATA, 'RiotClientInstalls.json'), 'utf8')
    ) as Record<string, unknown>
    for (const key of ['rc_default', 'rc_live']) {
      const path = cleanPath(json[key])
      if (path && existsSync(path)) return path
    }
  } catch {
    // Chưa cài Riot Client
  }
  return null
}

// Thư mục game Riot đã cài (đọc product_settings.yaml; thư mục phải còn tồn tại)
async function riotProductDir(product: string): Promise<string | null> {
  const file = join(
    RIOT_DATA,
    'Metadata',
    `${product}.live`,
    `${product}.live.product_settings.yaml`
  )
  try {
    const yaml = await readFile(file, 'utf8')
    const path = cleanPath(yaml.match(/product_install_full_path:\s*"?([^"\r\n]+)"?/)?.[1])
    return path && existsSync(path) ? path : null
  } catch {
    return null
  }
}

async function detectRiot(product: string): Promise<Detection | null> {
  const client = await riotClientPath()
  if (!client) return null
  const gameDir = await riotProductDir(product)
  return {
    status: gameDir ? 'installed' : 'available',
    via: 'Riot Client',
    exePath: client,
    launchArgs: [`--launch-product=${product}`, '--launch-patchline=live'],
    // Riot Client là launcher, giờ chơi chỉ tính khi game trong thư mục game chạy
    watchDirs: gameDir ? [gameDir] : undefined
  }
}

// ---------- Phần mềm đã cài (registry Uninstall) ----------

function detectUninstall(entry: CatalogGame, apps: InstalledApp[]): Detection | null {
  const rule = entry.uninstall
  if (!rule) return null
  for (const app of apps.filter((a) => rule.name.test(a.name))) {
    const base = app.installLocation && existsSync(app.installLocation) ? app.installLocation : null
    const exe =
      (base && firstExisting(base, rule.exe)) ??
      (isRunnableExe(app.displayIcon) ? app.displayIcon : null)
    if (!exe) continue
    const gameDir = base && rule.gameDir ? join(base, rule.gameDir) : null
    return {
      status: 'installed',
      via: null,
      exePath: exe,
      watchDirs: gameDir && existsSync(gameDir) ? [gameDir] : undefined
    }
  }
  return null
}

function detectHostLauncher(entry: CatalogGame, apps: InstalledApp[]): Detection | null {
  const rule = entry.hostLauncher
  if (!rule) return null
  for (const app of apps.filter((a) => rule.name.test(a.name))) {
    const base = app.installLocation
    if (!base || !existsSync(base)) continue
    const exe = firstExisting(base, rule.exe)
    if (!exe) continue
    const gameDir = rule.gameDir.map((d) => join(base, d)).find((d) => existsSync(d))
    // Có launcher nhưng chưa tải game => mở launcher để tải (thư mục game sẽ được gợi ý
    // tự động khi game chạy lần đầu, xem play-tracker)
    return gameDir
      ? { status: 'installed', via: app.name, exePath: exe, watchDirs: [gameDir] }
      : { status: 'available', via: app.name, exePath: exe }
  }
  return null
}

// ---------- Steam ----------

async function detectSteam(appId: string): Promise<Detection | null> {
  if (!(await steamPath())) return null
  const dir = await steamInstallDir(appId)
  return {
    status: dir ? 'installed' : 'available',
    via: 'Steam',
    exePath: `steam://rungameid/${appId}`
  }
}

// Thứ tự: bản đã cài trên máy (bất kể nguồn) > mở qua launcher để cài > không tìm thấy
async function detect(entry: CatalogGame, apps: InstalledApp[]): Promise<Detection> {
  const found = [
    entry.riotProduct ? await detectRiot(entry.riotProduct) : null,
    entry.steamAppId ? await detectSteam(entry.steamAppId) : null,
    detectUninstall(entry, apps),
    detectHostLauncher(entry, apps)
  ].filter((d): d is Detection => !!d)
  return found.find((d) => d.status === 'installed') ?? found[0] ?? MISSING
}

// Exe game thật trong thư mục game (lấy icon game thay cho icon launcher)
const gameExeOf = (entry: CatalogGame, d: Detection): string | undefined =>
  (d.watchDirs?.[0] && entry.gameExe && firstExisting(d.watchDirs[0], entry.gameExe)) || undefined

// ---------- API ----------

// Mở app: game từ danh mục chưa có exe game (thêm trước khi có cột game_exe, hoặc lúc thêm game
// chưa cài) => tìm trong thư mục game đã lưu. Chỉ kiểm tra vài file, không đọc registry
export function fillMissingGameExe(): void {
  for (const game of gameService.getAllGames()) {
    const entry = GAME_CATALOG.find((e) => e.id === game.catalog_id)
    if (!entry?.gameExe || (game.game_exe && existsSync(game.game_exe))) continue
    for (const dir of gameService.unpackDirs(game.watch_dirs)) {
      const exe = firstExisting(dir, entry.gameExe)
      if (exe) {
        gameService.setGameExe(game.id, exe)
        break
      }
    }
  }
}

const normalize = (title: string): string => title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function inLibrary(entry: CatalogGame, games: Game[]): boolean {
  return games.some(
    (g) =>
      g.catalog_id === entry.id ||
      normalize(g.title) === normalize(entry.title) ||
      (!!entry.steamAppId && (g.source_id ?? g.steam_app_id) === entry.steamAppId)
  )
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const apps = await listInstalledApps()
  const games = gameService.getAllGames()
  return Promise.all(
    GAME_CATALOG.map(async (entry) => {
      const d = await detect(entry, apps)
      return {
        id: entry.id,
        title: entry.title,
        genre: entry.genre,
        steamAppId: entry.steamAppId ?? null,
        status: d.status,
        via: d.via,
        inLibrary: inLibrary(entry, games)
      }
    })
  )
}

// Thêm các game đã chọn (bỏ qua game đã có trong thư viện). Không tìm thấy => game chưa liên kết
export async function addFromCatalog(ids: string[]): Promise<Game[]> {
  const apps = await listInstalledApps()
  const added: Game[] = []
  for (const entry of GAME_CATALOG.filter((e) => ids.includes(e.id))) {
    if (inLibrary(entry, gameService.getAllGames())) continue
    const d = await detect(entry, apps)
    added.push(
      gameService.createGame({
        title: entry.title,
        exe_path: d.exePath,
        genre: entry.genre,
        watch_dirs: d.watchDirs,
        launch_args: d.launchArgs,
        catalog_id: entry.id,
        steam_app_id: entry.steamAppId,
        game_exe: gameExeOf(entry, d)
      })
    )
  }
  return added
}

// Game chưa liên kết: thử tìm lại trên máy (vd người dùng vừa cài game). Tìm thấy => lưu và trả về game mới
export async function relink(game: Game): Promise<Game | null> {
  const entry = GAME_CATALOG.find((e) => e.id === game.catalog_id)
  if (!entry) return null
  const d = await detect(entry, await listInstalledApps())
  if (!d.exePath) return null
  gameService.updateGame(game.id, {
    exe_path: d.exePath,
    launch_args: d.launchArgs ?? [],
    ...(d.watchDirs ? { watch_dirs: d.watchDirs } : {})
  })
  const gameExe = gameExeOf(entry, d)
  return (
    (gameExe ? gameService.setGameExe(game.id, gameExe) : gameService.getGameById(game.id)) ?? null
  )
}
