import { getDb } from '../database'
import * as gameService from './game.service'
import { fetchWithTimeout, markSteamBlocked, NetworkError } from './network.service'
import { proxiedImageUrl } from './news-image.service'
import { toSummary } from './rss.service'

// Thông tin game từ Steam Store (appdetails, không cần key): mô tả, nhà phát triển,
// ảnh chụp màn hình, trailer. Lưu vào bảng steam_details 7 ngày; lỗi mạng thì dùng bản cũ.

const CACHE_MS = 7 * 86_400_000
const MAX_SCREENSHOTS = 12
const MAX_MOVIES = 4

interface RawDetails {
  name: string
  description: string
  developers: string[]
  publishers: string[]
  releaseDate: string | null
  genres: string[]
  website: string | null
  metacritic: number | null
  screenshots: { thumb: string; full: string }[]
  movies: { name: string; thumb: string; src: string | null }[]
}

export interface SteamDetails extends RawDetails {
  appId: string
}

export interface SteamDetailsResult {
  details: SteamDetails | null
  stale: boolean // Không tải được bản mới, đang dùng bản đã lưu
  error: string | null
}

const httpsOnly = (url: unknown): string | null =>
  typeof url === 'string' && /^https:\/\//i.test(url) ? url : null

interface RawMovie {
  name?: string
  thumbnail?: string
  mp4?: Record<string, string>
  webm?: Record<string, string>
}

// Trailer: ưu tiên mp4 / webm (Chromium phát được). Steam mới chỉ có HLS/DASH với một số game
// => src = null, giao diện hiện ảnh kèm link xem trên Steam
function movieSource(movie: RawMovie): string | null {
  return (
    httpsOnly(movie.mp4?.['480']) ??
    httpsOnly(movie.mp4?.max) ??
    httpsOnly(movie.webm?.['480']) ??
    httpsOnly(movie.webm?.max)
  )
}

function parseDetails(data: Record<string, unknown>): RawDetails {
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
  const screenshots = Array.isArray(data.screenshots) ? data.screenshots : []
  const movies = Array.isArray(data.movies) ? (data.movies as RawMovie[]) : []
  const release = data.release_date as { date?: string; coming_soon?: boolean } | undefined

  return {
    name: String(data.name ?? ''),
    description: toSummary(String(data.short_description ?? ''), 600),
    developers: list(data.developers),
    publishers: list(data.publishers),
    releaseDate: release?.date || null,
    genres: Array.isArray(data.genres)
      ? (data.genres as { description?: string }[]).map((g) => g.description ?? '').filter(Boolean)
      : [],
    website: httpsOnly(data.website),
    metacritic: (data.metacritic as { score?: number } | undefined)?.score ?? null,
    screenshots: (screenshots as { path_thumbnail?: string; path_full?: string }[])
      .map((s) => ({ thumb: httpsOnly(s.path_thumbnail), full: httpsOnly(s.path_full) }))
      .filter((s): s is { thumb: string; full: string } => !!s.thumb && !!s.full)
      .slice(0, MAX_SCREENSHOTS),
    movies: movies
      .map((m) => ({
        name: m.name ?? 'Trailer',
        thumb: httpsOnly(m.thumbnail),
        src: movieSource(m)
      }))
      .filter((m): m is { name: string; thumb: string; src: string | null } => !!m.thumb)
      .slice(0, MAX_MOVIES)
  }
}

function readCache(appId: string): { at: number; data: RawDetails } | null {
  const row = getDb()
    .prepare('SELECT fetched_at, data FROM steam_details WHERE app_id = ?')
    .get(appId) as { fetched_at: number; data: string } | undefined
  if (!row) return null
  try {
    return { at: row.fetched_at, data: JSON.parse(row.data) as RawDetails }
  } catch {
    return null
  }
}

function writeCache(appId: string, data: RawDetails): void {
  getDb()
    .prepare(
      `INSERT INTO steam_details (app_id, fetched_at, data) VALUES (?, ?, ?)
       ON CONFLICT(app_id) DO UPDATE SET fetched_at = excluded.fetched_at, data = excluded.data`
    )
    .run(appId, Date.now(), JSON.stringify(data))
}

// Ảnh đi qua game-media://news-image (tải hộ + lưu trên máy) như ảnh tin tức
function withProxiedImages(appId: string, raw: RawDetails): SteamDetails {
  return {
    ...raw,
    appId,
    screenshots: raw.screenshots.map((s) => ({
      thumb: proxiedImageUrl(s.thumb) ?? s.thumb,
      full: proxiedImageUrl(s.full) ?? s.full
    })),
    movies: raw.movies.map((m) => ({ ...m, thumb: proxiedImageUrl(m.thumb) ?? m.thumb }))
  }
}

async function fetchDetails(appId: string): Promise<RawDetails | null> {
  // Ưu tiên mô tả tiếng Việt, Steam tự trả tiếng Anh nếu game không có bản dịch
  const res = await fetchWithTimeout(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&l=vietnamese`
  )
  if (!res.ok) throw new Error(`Steam trả về lỗi ${res.status}`)
  const json = (await res.json()) as Record<
    string,
    { success?: boolean; data?: Record<string, unknown> }
  >
  const entry = json[appId]
  return entry?.success && entry.data ? parseDetails(entry.data) : null
}

export async function getSteamDetails(gameId: string, force = false): Promise<SteamDetailsResult> {
  const game = gameService.getGameById(gameId)
  const appId = game?.steam_app_id ?? game?.source_id
  if (!appId || !/^\d+$/.test(appId)) return { details: null, stale: false, error: null }

  const cached = readCache(appId)
  if (cached && !force && Date.now() - cached.at < CACHE_MS) {
    return { details: withProxiedImages(appId, cached.data), stale: false, error: null }
  }

  try {
    const data = await fetchDetails(appId)
    if (!data)
      return { details: null, stale: false, error: 'Steam không có thông tin cho game này' }
    writeCache(appId, data)
    return { details: withProxiedImages(appId, data), stale: false, error: null }
  } catch (err) {
    if (err instanceof NetworkError) markSteamBlocked()
    const error =
      err instanceof NetworkError ? 'Không kết nối được tới Steam' : (err as Error).message
    if (cached) return { details: withProxiedImages(appId, cached.data), stale: true, error }
    return { details: null, stale: false, error }
  }
}
