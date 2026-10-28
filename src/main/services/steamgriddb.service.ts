import { mkdirSync } from 'fs'
import { rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { app, net } from 'electron'
import { createPreview } from './cover.service'
import { getSecret, setSecret } from './settings.service'

const API_BASE = 'https://www.steamgriddb.com/api/v2'
const API_KEY_SETTING = 'steamgriddb_api_key'
// Chỉ tải ảnh từ CDN của SteamGridDB, không tải URL bất kỳ do renderer gửi lên
const ALLOWED_IMAGE_HOSTS = new Set(['cdn2.steamgriddb.com', 'cdn.steamgriddb.com'])
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export type ImageKind = 'poster' | 'grid' | 'hero'

export interface SgdbGame {
  id: number
  name: string
  year: number | null
  verified: boolean
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

async function request<T>(path: string, apiKey = getSecret(API_KEY_SETTING)): Promise<T> {
  if (!apiKey) throw new Error('Chưa nhập SteamGridDB API key (vào Cài đặt để thêm)')

  let res: Response
  try {
    res = await net.fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
  } catch {
    throw new Error('Không kết nối được tới SteamGridDB, kiểm tra lại mạng')
  }

  if (res.status === 401 || res.status === 403) throw new Error('SteamGridDB API key không hợp lệ')
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null
  if (res.status === 404) throw new Error('Không tìm thấy trên SteamGridDB')
  if (!res.ok || !json?.success) {
    throw new Error(json?.errors?.join(', ') || `SteamGridDB lỗi (${res.status})`)
  }
  return json.data
}

// ---------- API key ----------

export function isConfigured(): boolean {
  return !!getSecret(API_KEY_SETTING)
}

// Kiểm tra key bằng một request thật trước khi lưu; key rỗng = xoá
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
}

function mapGame(g: RawGame): SgdbGame {
  return {
    id: g.id,
    name: g.name,
    year: g.release_date ? new Date(g.release_date * 1000).getFullYear() : null,
    verified: !!g.verified
  }
}

export async function searchGames(term: string): Promise<SgdbGame[]> {
  const q = term.trim()
  if (!q) return []
  const data = await request<RawGame[]>(`/search/autocomplete/${encodeURIComponent(q)}`)
  return data.map(mapGame)
}

export async function getGameBySteamAppId(appId: string): Promise<SgdbGame | null> {
  if (!/^\d+$/.test(appId)) return null
  try {
    return mapGame(await request<RawGame>(`/games/steam/${appId}`))
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
  hero: (id) => `/heroes/game/${id}?`
}

export async function getImages(gameId: number, kind: ImageKind, page = 0): Promise<SgdbImage[]> {
  const filters = 'types=static&nsfw=false&humor=false'
  const base = (IMAGE_PATHS[kind] ?? IMAGE_PATHS.grid)(gameId)
  const path = `${base}${base.endsWith('?') ? '' : '&'}${filters}&page=${page}`

  let data: RawImage[]
  try {
    data = await request<RawImage[]>(path)
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

  const preview = await createPreview(path)
  if (!preview) throw new Error('Không đọc được ảnh vừa tải')
  return { path, preview }
}

// Dọn file tạm từ lần chạy trước
export async function cleanupTempDownloads(): Promise<void> {
  await rm(join(app.getPath('temp'), 'game-launcher-covers'), { recursive: true, force: true })
}
