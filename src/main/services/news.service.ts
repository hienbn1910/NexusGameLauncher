import { getDb } from '../database'
import * as gameService from './game.service'
import {
  fetchWithTimeout,
  isSteamBlocked,
  markSteamBlocked,
  markSteamReachable,
  NetworkError
} from './network.service'
import { proxiedImageUrl } from './news-image.service'
import { parseFeed, type FeedItem } from './rss.service'
import { getSetting, setSetting } from './settings.service'

// Tin tức game, đọc hoàn toàn bằng RSS (không cần API key):
// - Game có trên Steam: RSS tin chính thức của Steam
// - Game ngoài Steam, hoặc khi Steam bị chặn: Google News (tiếng Việt + tiếng Anh, 30 ngày)
// - Tab "Tin game": RSS các trang báo game
// Mỗi nguồn được lưu vào bảng news_cache để mất mạng vẫn có tin cũ.

export type NewsTab = 'library' | 'following' | 'sites'
export type NewsLang = 'vi' | 'en'

export interface NewsItem {
  id: string
  title: string
  url: string
  date: number
  summary: string
  image: string | null // game-media://news-image/...
  origin: 'steam' | 'press' // Thông báo chính thức Steam / báo chí
  sourceName: string
  lang: NewsLang | null
  isPatch: boolean
  gameId: string | null // Game trong thư viện (tab "Game của bạn")
  gameName: string | null
}

export interface NewsResult {
  items: NewsItem[]
  updatedAt: number | null // Lần tải thành công gần nhất
  stale: boolean // Có nguồn không tải được, đang hiện tin cũ
  steamBlocked: boolean
}

export interface FollowedGame {
  id: string
  name: string
  appId: string | null
}

export interface NewsSite {
  id: string
  name: string
  lang: NewsLang
  url: string
  enabled: boolean
}

const CACHE_MS = 30 * 60_000
const MAX_TARGETS = 15 // Số game tối đa lấy tin mỗi tab
const PER_GAME = 3 // Tin Steam mỗi game
const PER_LANG = 2 // Tin báo chí mỗi ngôn ngữ, mỗi game
const PER_SITE = 10
const MAX_ITEMS = 30
const STEAM_MAX_AGE_DAYS = 180
const PRESS_MAX_AGE_DAYS = 30
const CONCURRENCY = 4

const FOLLOWING_KEY = 'news_following'
const SITES_KEY = 'news_sites'

// Các trang báo game có RSS ổn định (đã kiểm tra)
const SITES: Omit<NewsSite, 'enabled'>[] = [
  { id: 'gamek', name: 'GameK', lang: 'vi', url: 'https://gamek.vn/home.rss' },
  { id: 'pcgamer', name: 'PC Gamer', lang: 'en', url: 'https://www.pcgamer.com/rss/' },
  { id: 'ign', name: 'IGN', lang: 'en', url: 'https://feeds.ign.com/ign/games-all' },
  {
    id: 'gamespot',
    name: 'GameSpot',
    lang: 'en',
    url: 'https://www.gamespot.com/feeds/game-news/'
  },
  { id: 'gamesradar', name: 'GamesRadar+', lang: 'en', url: 'https://www.gamesradar.com/rss/' },
  { id: 'eurogamer', name: 'Eurogamer', lang: 'en', url: 'https://www.eurogamer.net/feed' },
  {
    id: 'rps',
    name: 'Rock Paper Shotgun',
    lang: 'en',
    url: 'https://www.rockpapershotgun.com/feed'
  }
]
const DEFAULT_SITES = ['gamek', 'pcgamer', 'ign']

// Game nổi tiếng gợi ý trong hộp thoại "Theo dõi game"
export const SUGGESTED_GAMES: FollowedGame[] = [
  { id: 'steam-730', name: 'Counter-Strike 2', appId: '730' },
  { id: 'steam-570', name: 'Dota 2', appId: '570' },
  { id: 'steam-578080', name: 'PUBG: BATTLEGROUNDS', appId: '578080' },
  { id: 'steam-1172470', name: 'Apex Legends', appId: '1172470' },
  { id: 'steam-271590', name: 'Grand Theft Auto V', appId: '271590' },
  { id: 'steam-1245620', name: 'ELDEN RING', appId: '1245620' },
  { id: 'steam-2767030', name: 'Marvel Rivals', appId: '2767030' },
  { id: 'steam-1086940', name: "Baldur's Gate 3", appId: '1086940' },
  { id: 'name-lien-minh-huyen-thoai', name: 'Liên Minh Huyền Thoại', appId: null },
  { id: 'name-valorant', name: 'Valorant', appId: null },
  { id: 'name-genshin-impact', name: 'Genshin Impact', appId: null },
  { id: 'name-honkai-star-rail', name: 'Honkai: Star Rail', appId: null }
]

const PATCH_STEAM = /update|patch|hotfix|bản cập nhật/i
const PATCH_PRESS = /patch notes|hotfix|bản cập nhật|cập nhật phiên bản/i

// ---------- Tải nguồn RSS (có cache) ----------

interface FeedSpec {
  key: string
  url: string
}

interface FeedResult {
  items: FeedItem[]
  fetchedAt: number
  stale: boolean
}

function readCache(key: string): FeedResult | null {
  const row = getDb()
    .prepare('SELECT fetched_at, items FROM news_cache WHERE feed_key = ?')
    .get(key) as { fetched_at: number; items: string } | undefined
  if (!row) return null
  try {
    return { items: JSON.parse(row.items) as FeedItem[], fetchedAt: row.fetched_at, stale: false }
  } catch {
    return null
  }
}

function writeCache(key: string, items: FeedItem[]): void {
  getDb()
    .prepare(
      `INSERT INTO news_cache (feed_key, fetched_at, items) VALUES (?, ?, ?)
       ON CONFLICT(feed_key) DO UPDATE SET fetched_at = excluded.fetched_at, items = excluded.items`
    )
    .run(key, Date.now(), JSON.stringify(items))
}

// Cache còn mới => dùng luôn; không thì tải lại, lỗi thì trả cache cũ (stale)
// Lỗi mạng mà không có cache => ném NetworkError
async function loadFeed(spec: FeedSpec, force: boolean): Promise<FeedResult> {
  const cached = readCache(spec.key)
  if (cached && !force && Date.now() - cached.fetchedAt < CACHE_MS) return cached

  try {
    const res = await fetchWithTimeout(spec.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 NexusLauncher', Accept: 'application/rss+xml, */*' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const items = parseFeed(await res.text())
    writeCache(spec.key, items)
    return { items, fetchedAt: Date.now(), stale: false }
  } catch (err) {
    if (cached) return { ...cached, stale: true }
    throw err
  }
}

const steamFeed = (appId: string): FeedSpec => ({
  key: `steam:${appId}`,
  url: `https://store.steampowered.com/feeds/news/app/${appId}/`
})

function googleFeed(name: string, lang: NewsLang): FeedSpec {
  const q = encodeURIComponent(`"${name}" game when:${PRESS_MAX_AGE_DAYS}d`)
  const region = lang === 'vi' ? 'hl=vi&gl=VN&ceid=VN:vi' : 'hl=en-US&gl=US&ceid=US:en'
  return {
    key: `google:${lang}:${name.toLowerCase()}`,
    url: `https://news.google.com/rss/search?q=${q}&${region}`
  }
}

// Chạy song song nhưng giới hạn số request cùng lúc
async function mapLimit<T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(list.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++
      results[i] = await fn(list[i])
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- Tin của một game ----------

interface Target {
  name: string
  appId: string | null
  gameId: string | null
}

interface Collected {
  items: NewsItem[]
  fetchedAt: number | null
  stale: boolean
}

const daysAgo = (days: number): number => Date.now() - days * 86_400_000

function toNewsItem(
  item: FeedItem,
  extra: Pick<NewsItem, 'origin' | 'sourceName' | 'lang' | 'gameId' | 'gameName'>,
  fallbackImage: string | null
): NewsItem {
  // Google News ghi "Tiêu đề - Tên báo" => bỏ phần tên báo ở cuối
  const title =
    item.source && item.title.endsWith(` - ${item.source}`)
      ? item.title.slice(0, -item.source.length - 3)
      : item.title
  const patchRule = extra.origin === 'steam' ? PATCH_STEAM : PATCH_PRESS
  return {
    id: item.url,
    title,
    url: item.url,
    date: item.date,
    // Tóm tắt của Google News chỉ lặp lại tiêu đề => bỏ
    summary: item.source ? '' : item.summary,
    image: proxiedImageUrl(item.image ?? fallbackImage),
    isPatch: patchRule.test(title),
    ...extra,
    sourceName: item.source ?? extra.sourceName
  }
}

interface Limits {
  steam: number
  lang: number
}
const DEFAULT_LIMITS: Limits = { steam: PER_GAME, lang: PER_LANG }

async function collectGoogle(
  target: Target,
  force: boolean,
  limits = DEFAULT_LIMITS
): Promise<Collected> {
  const out: Collected = { items: [], fetchedAt: null, stale: false }
  for (const lang of ['vi', 'en'] as NewsLang[]) {
    try {
      const feed = await loadFeed(googleFeed(target.name, lang), force)
      out.fetchedAt = Math.max(out.fetchedAt ?? 0, feed.fetchedAt)
      out.stale ||= feed.stale
      out.items.push(
        ...feed.items
          .filter((i) => i.date >= daysAgo(PRESS_MAX_AGE_DAYS))
          .sort((a, b) => b.date - a.date)
          // Mỗi ngôn ngữ vài tin để luôn có cả tin tiếng Việt lẫn tiếng Anh
          .slice(0, limits.lang)
          .map((i) =>
            toNewsItem(
              i,
              {
                origin: 'press',
                sourceName: 'Google News',
                lang,
                gameId: target.gameId,
                gameName: target.name
              },
              null
            )
          )
      )
    } catch {
      out.stale = true
    }
  }
  out.items.sort((a, b) => b.date - a.date)
  return out
}

async function collectTarget(
  target: Target,
  force: boolean,
  limits = DEFAULT_LIMITS
): Promise<Collected> {
  if (target.appId && !isSteamBlocked()) {
    try {
      const feed = await loadFeed(steamFeed(target.appId), force)
      if (!feed.stale) markSteamReachable()
      const header = `https://cdn.cloudflare.steamstatic.com/steam/apps/${target.appId}/header.jpg`
      const items = feed.items
        .filter((i) => i.date >= daysAgo(STEAM_MAX_AGE_DAYS))
        .slice(0, limits.steam)
        .map((i) =>
          toNewsItem(
            i,
            {
              origin: 'steam',
              sourceName: 'Steam',
              lang: null,
              gameId: target.gameId,
              gameName: target.name
            },
            // Game trong thư viện đã có ảnh bìa trên máy; game theo dõi thì dùng ảnh header Steam
            target.gameId ? null : header
          )
        )
      // Game có trên Steam nhưng không có thông báo gần đây => thử báo chí
      if (items.length > 0) return { items, fetchedAt: feed.fetchedAt, stale: feed.stale }
    } catch (err) {
      if (err instanceof NetworkError) markSteamBlocked()
    }
  }
  return collectGoogle(target, force, limits)
}

// ---------- Theo dõi & trang báo ----------

export function getFollowing(): FollowedGame[] {
  try {
    const list = JSON.parse(getSetting(FOLLOWING_KEY) ?? '[]') as FollowedGame[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function follow(name: string, appId: string | null): FollowedGame[] {
  const cleanName = name.trim().slice(0, 100)
  if (!cleanName) throw new Error('Tên game không được để trống')
  const id = appId && /^\d+$/.test(appId) ? `steam-${appId}` : `name-${slug(cleanName)}`
  const list = getFollowing().filter((g) => g.id !== id)
  list.push({ id, name: cleanName, appId: id.startsWith('steam-') ? appId : null })
  setSetting(FOLLOWING_KEY, JSON.stringify(list))
  return list
}

export function unfollow(id: string): FollowedGame[] {
  const list = getFollowing().filter((g) => g.id !== id)
  setSetting(FOLLOWING_KEY, JSON.stringify(list))
  return list
}

export function getSites(): NewsSite[] {
  let enabled = DEFAULT_SITES
  try {
    const saved = JSON.parse(getSetting(SITES_KEY) ?? 'null') as string[] | null
    if (Array.isArray(saved)) enabled = saved
  } catch {
    // Dùng mặc định
  }
  return SITES.map((s) => ({ ...s, enabled: enabled.includes(s.id) }))
}

export function setSiteEnabled(id: string, enabled: boolean): NewsSite[] {
  const current = getSites()
    .filter((s) => s.enabled && s.id !== id)
    .map((s) => s.id)
  if (enabled && SITES.some((s) => s.id === id)) current.push(id)
  setSetting(SITES_KEY, JSON.stringify(current))
  return getSites()
}

// ---------- Lấy tin theo tab ----------

function finish(parts: Collected[]): NewsResult {
  const seenUrl = new Set<string>()
  const seenTitle = new Set<string>()
  const items: NewsItem[] = []
  // Bỏ tin trùng: cùng link, hoặc (với báo chí) cùng tiêu đề đăng lại ở nhiều báo.
  // Tin Steam không xét tiêu đề vì nhiều bản cập nhật trùng tên (vd "Counter-Strike 2 Update")
  for (const item of parts.flatMap((p) => p.items).sort((a, b) => b.date - a.date)) {
    const titleKey = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    if (seenUrl.has(item.url)) continue
    if (item.origin === 'press' && seenTitle.has(titleKey)) continue
    seenUrl.add(item.url)
    if (item.origin === 'press') seenTitle.add(titleKey)
    items.push(item)
  }
  const times = parts.map((p) => p.fetchedAt).filter((t): t is number => t !== null)
  return {
    items: items.slice(0, MAX_ITEMS),
    updatedAt: times.length > 0 ? Math.min(...times) : null,
    stale: parts.some((p) => p.stale),
    steamBlocked: isSteamBlocked()
  }
}

async function libraryTargets(): Promise<Target[]> {
  return gameService
    .getAllGames()
    .sort(
      (a, b) =>
        (b.last_played ?? '').localeCompare(a.last_played ?? '') || b.is_favorite - a.is_favorite
    )
    .slice(0, MAX_TARGETS)
    .map((g) => ({ name: g.title, appId: g.steam_app_id, gameId: g.id }))
}

// Tin của một game (trang chi tiết game): lấy nhiều hơn so với trang chủ
export async function getGameNews(gameId: string, force = false): Promise<NewsResult> {
  const game = gameService.getGameById(gameId)
  if (!game) return finish([])
  const target: Target = {
    name: game.title,
    appId: game.steam_app_id ?? game.source_id,
    gameId: game.id
  }
  return finish([await collectTarget(target, force, { steam: 12, lang: 6 })])
}

export async function getNews(tab: NewsTab, force = false): Promise<NewsResult> {
  if (tab === 'sites') {
    const sites = getSites().filter((s) => s.enabled)
    const parts = await mapLimit(sites, CONCURRENCY, async (site): Promise<Collected> => {
      try {
        const feed = await loadFeed({ key: `site:${site.id}`, url: site.url }, force)
        return {
          items: feed.items.slice(0, PER_SITE).map((i) =>
            toNewsItem(
              i,
              {
                origin: 'press',
                sourceName: site.name,
                lang: site.lang,
                gameId: null,
                gameName: null
              },
              null
            )
          ),
          fetchedAt: feed.fetchedAt,
          stale: feed.stale
        }
      } catch {
        return { items: [], fetchedAt: null, stale: true }
      }
    })
    return finish(parts)
  }

  const targets =
    tab === 'library'
      ? await libraryTargets()
      : getFollowing()
          .slice(0, MAX_TARGETS)
          .map((g) => ({ name: g.name, appId: g.appId, gameId: null }))

  return finish(await mapLimit(targets, CONCURRENCY, (t) => collectTarget(t, force)))
}
