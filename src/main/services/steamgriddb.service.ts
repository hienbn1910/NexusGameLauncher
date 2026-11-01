import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { app, net } from 'electron'
import { createPreview } from './cover.service'
import { getSecret, getSetting, setSecret, setSetting } from './settings.service'

const API_BASE = 'https://www.steamgriddb.com/api/v2'
const API_KEY_SETTING = 'steamgriddb_api_key'
// Chỉ tải ảnh từ CDN của SteamGridDB, không tải URL bất kỳ do renderer gửi lên
const ALLOWED_IMAGE_HOSTS = new Set(['cdn2.steamgriddb.com', 'cdn.steamgriddb.com'])
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export type ImageKind = 'poster' | 'grid' | 'hero' | 'logo'

export interface SgdbGame {
  id: number
  name: string
  year: number | null
  verified: boolean
  platforms: string[] // Nền tảng có game, vd ['steam', 'gog']
}

export interface SgdbImage {
  id: number
  url: string
  thumb: string
  width: number
  height: number
  style: string
  author: string | null
}

interface ApiResponse<T> {
  success: boolean
  data: T
  errors?: string[]
}

// ---------- Key: key người dùng tự nhập > key mặc định của Nexus ----------

// Key mặc định chèn vào lúc build từ .env (MAIN_VITE_SGDB_KEY), không nằm trong mã nguồn/git.
// Chỉ main process biết key, giao diện chỉ biết đang dùng loại key nào.
const DEFAULT_KEY = (import.meta.env?.MAIN_VITE_SGDB_KEY ?? '').trim()
// SteamGridDB từ chối key mặc định => ghi lại dấu của key đó và thôi dùng
// (bản phát hành sau đổi key mới thì dấu khác, tự dùng lại)
const DEFAULT_BROKEN_SETTING = 'sgdb_default_key_broken'
const defaultKeyMark = (): string =>
  createHash('sha256').update(DEFAULT_KEY).digest('hex').slice(0, 16)

// Key mặc định dùng chung cho mọi người dùng => giới hạn số lượt gọi trên mỗi máy
const DEFAULT_KEY_LIMIT = 40
const DEFAULT_KEY_WINDOW_MS = 60_000
const defaultKeyCalls: number[] = []

export type KeySource = 'user' | 'default' | 'none'

export interface KeyStatus {
  source: KeySource
  defaultBroken: boolean // Có key mặc định nhưng SteamGridDB đã từ chối
}

function isDefaultBroken(): boolean {
  return !!DEFAULT_KEY && getSetting(DEFAULT_BROKEN_SETTING) === defaultKeyMark()
}

function activeKey(): { key: string; source: Exclude<KeySource, 'none'> } | null {
  const userKey = getSecret(API_KEY_SETTING)
  if (userKey) return { key: userKey, source: 'user' }
  if (DEFAULT_KEY && !isDefaultBroken()) return { key: DEFAULT_KEY, source: 'default' }
  return null
}

export function getKeyStatus(): KeyStatus {
  return { source: activeKey()?.source ?? 'none', defaultBroken: isDefaultBroken() }
}

function takeDefaultKeySlot(): void {
  const now = Date.now()
  while (defaultKeyCalls.length && now - defaultKeyCalls[0] > DEFAULT_KEY_WINDOW_MS) {
    defaultKeyCalls.shift()
  }
  if (defaultKeyCalls.length >= DEFAULT_KEY_LIMIT) {
    throw new Error('Đang tìm trên SteamGridDB quá nhiều, đợi khoảng một phút rồi thử lại')
  }
  defaultKeyCalls.push(now)
}

// apiKey = kiểm tra một key cụ thể (lúc người dùng lưu key)
async function request<T>(path: string, apiKey?: string): Promise<T> {
  const active = apiKey ? { key: apiKey, source: 'user' as const } : activeKey()
  if (!active) throw new Error('Chưa có SteamGridDB API key (vào Cài đặt để thêm)')
  if (active.source === 'default') takeDefaultKeySlot()

  let res: Response
  try {
    res = await net.fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${active.key}` }
    })
  } catch {
    throw new Error('Không kết nối được tới SteamGridDB, kiểm tra lại mạng')
  }

  if (res.status === 401 || res.status === 403) {
    if (active.source === 'default') {
      setSetting(DEFAULT_BROKEN_SETTING, defaultKeyMark())
      throw new Error(
        'Key SteamGridDB mặc định của Nexus không còn dùng được. Hãy nhập key của bạn trong Cài đặt'
      )
    }
    throw new Error('SteamGridDB API key không hợp lệ')
  }
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null
  if (res.status === 404) throw new Error('Không tìm thấy trên SteamGridDB')
  if (!res.ok || !json?.success) {
    throw new Error(json?.errors?.join(', ') || `SteamGridDB lỗi (${res.status})`)
  }
  return json.data
}

// ---------- API key ----------

// Có key dùng được (của người dùng hoặc mặc định)
export function isConfigured(): boolean {
  return activeKey() !== null
}

// Kiểm tra key bằng một request thật trước khi lưu; key rỗng = xoá (quay về key mặc định)
export async function saveApiKey(apiKey: string): Promise<void> {
  const key = apiKey.trim()
  if (!key) return setSecret(API_KEY_SETTING, null)
  await request('/search/autocomplete/portal', key)
  setSecret(API_KEY_SETTING, key)
}

// ---------- Tìm game ----------

interface RawGame {
  id: number
  name: string
  release_date?: number
  verified?: boolean
  types?: string[]
  external_platform_data?: { steam?: { id?: string }[] }
}

function mapGame(g: RawGame): SgdbGame {
  return {
    id: g.id,
    name: g.name,
    year: g.release_date ? new Date(g.release_date * 1000).getFullYear() : null,
    verified: !!g.verified,
    platforms: Array.isArray(g.types) ? g.types : []
  }
}

// Kết quả API giữ trong bộ nhớ: gõ lại từ khoá cũ, mở lại hộp tìm ảnh... không gọi API lần nữa
// (bớt lượt gọi, nhất là với key mặc định dùng chung)
const apiCache = new Map<string, unknown>()
const API_CACHE_MAX = 300

async function cachedRequest<T>(path: string): Promise<T> {
  if (apiCache.has(path)) return apiCache.get(path) as T
  const data = await request<T>(path)
  if (apiCache.size >= API_CACHE_MAX) apiCache.clear()
  apiCache.set(path, data)
  return data
}

export async function searchGames(term: string): Promise<SgdbGame[]> {
  const q = term.trim().toLowerCase()
  if (!q) return []
  const data = await cachedRequest<RawGame[]>(`/search/autocomplete/${encodeURIComponent(q)}`)
  return data.map(mapGame)
}

// Steam App ID của game trên SteamGridDB; null = game không có trên Steam
export async function getSteamAppId(gameId: number): Promise<string | null> {
  if (!Number.isInteger(gameId) || gameId <= 0) return null
  const data = await cachedRequest<RawGame>(`/games/id/${gameId}?platformdata=steam`)
  const id = data.external_platform_data?.steam?.[0]?.id
  return id && /^\d+$/.test(id) ? id : null
}

export async function getGameBySteamAppId(appId: string): Promise<SgdbGame | null> {
  if (!/^\d+$/.test(appId)) return null
  try {
    return mapGame(await cachedRequest<RawGame>(`/games/steam/${appId}`))
  } catch {
    return null // App ID không có trên SteamGridDB
  }
}

// ---------- Ảnh ----------

interface RawImage {
  id: number
  url: string
  thumb: string
  width: number
  height: number
  style: string
  author?: { name?: string }
}

// poster: ảnh dọc kiểu thư viện Steam (600x900) - hợp với lưới ảnh bìa
// grid: ảnh ngang kiểu header Steam (920x430) - hợp với thẻ game
// hero: ảnh banner lớn (1920x620) - hợp với banner nổi bật
const IMAGE_PATHS: Record<ImageKind, (gameId: number) => string> = {
  poster: (id) => `/grids/game/${id}?dimensions=600x900,342x482,660x930`,
  grid: (id) => `/grids/game/${id}?dimensions=920x430,460x215`,
  hero: (id) => `/heroes/game/${id}?`,
  logo: (id) => `/logos/game/${id}?`
}

export async function getImages(gameId: number, kind: ImageKind, page = 0): Promise<SgdbImage[]> {
  const filters = 'types=static&nsfw=false&humor=false'
  const base = (IMAGE_PATHS[kind] ?? IMAGE_PATHS.grid)(gameId)
  const path = `${base}${base.endsWith('?') ? '' : '&'}${filters}&page=${page}`

  let data: RawImage[]
  try {
    data = await cachedRequest<RawImage[]>(path)
  } catch (err) {
    // Game chưa có ảnh loại này
    if (err instanceof Error && err.message.startsWith('Không tìm thấy')) return []
    throw err
  }

  return data.map((img) => ({
    id: img.id,
    url: img.url,
    thumb: img.thumb,
    width: img.width,
    height: img.height,
    style: img.style,
    author: img.author?.name ?? null
  }))
}

// ---------- Tải ảnh ----------

function tempDir(): string {
  const dir = join(app.getPath('temp'), 'game-launcher-covers')
  mkdirSync(dir, { recursive: true })
  return dir
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
}

// Tải ảnh về file tạm; form sẽ copy vào thư mục covers khi người dùng bấm Lưu
export async function downloadImage(url: string): Promise<{ path: string; preview: string }> {
  const path = await downloadToTemp(url)
  const preview = await createPreview(path)
  if (!preview) throw new Error('Không đọc được ảnh vừa tải')
  return { path, preview }
}

// Ảnh đầu tiên (điểm cao nhất) của game => file tạm; null nếu game chưa có ảnh loại này
export async function downloadTopImage(gameId: number, kind: ImageKind): Promise<string | null> {
  const [first] = await getImages(gameId, kind)
  return first ? downloadToTemp(first.url) : null
}

async function downloadToTemp(url: string): Promise<string> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(parsed.host)) {
    throw new Error('URL ảnh không hợp lệ')
  }

  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`Không tải được ảnh (${res.status})`)

  const ext = MIME_EXT[(res.headers.get('content-type') ?? '').split(';')[0].trim()]
  if (!ext) throw new Error('Định dạng ảnh không được hỗ trợ')

  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Ảnh quá lớn')

  const path = join(tempDir(), `sgdb-${Date.now()}.${ext}`)
  await writeFile(path, buffer)
  return path
}

// Dọn file tạm từ lần chạy trước
export async function cleanupTempDownloads(): Promise<void> {
  await rm(join(app.getPath('temp'), 'game-launcher-covers'), { recursive: true, force: true })
}
