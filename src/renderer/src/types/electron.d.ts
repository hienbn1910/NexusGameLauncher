export {}

declare global {
  interface GameInput {
    title: string
    exe_path: string
    genre?: string
    process_name?: string
  }

  // genre / process_name = '' để xoá giá trị
  interface GameUpdateInput extends Partial<GameInput> {
    is_favorite?: boolean
  }

  interface Game {
    id: string
    title: string
    exe_path: string
    source: string
    source_id: string | null
    genre: string | null
    cover_path: string | null
    poster_path: string | null
    logo_path: string | null
    steam_app_id: string | null
    is_favorite: number
    total_playtime: number
    last_played: string | null
    process_name: string | null
    notes: string | null
    created_at: string
  }

  interface GameStats {
    sessions: number
    longestHours: number
    averageHours: number
    firstPlayed: string | null
    share: number // 0..1
    weeks: { start: string; hours: number }[] // 12 tuần, cũ => mới
    recent: { startedAt: string; endedAt: string; hours: number }[]
  }

  interface SteamDetails {
    appId: string
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

  interface SteamDetailsResult {
    details: SteamDetails | null
    stale: boolean
    error: string | null
  }

  interface InstallInfo {
    path: string | null
    size: { path: string; bytes: number; files: number; partial: boolean } | null
  }

  type LaunchResult = { ok: true; game: Game } | { ok: false; error: string }

  interface GameSessionEvent {
    gameId: string
    running: boolean
    game?: Game
    startedAt?: number
  }

  type NewsTab = 'library' | 'following' | 'sites'

  interface NewsItem {
    id: string
    title: string
    url: string
    date: number // ms
    summary: string
    image: string | null // game-media://news-image/...
    origin: 'steam' | 'press' // Thông báo chính thức Steam / báo chí
    sourceName: string
    lang: 'vi' | 'en' | null
    isPatch: boolean
    gameId: string | null
    gameName: string | null
  }

  interface NewsResult {
    items: NewsItem[]
    updatedAt: number | null
    stale: boolean
    steamBlocked: boolean
  }

  interface FollowedGame {
    id: string
    name: string
    appId: string | null
  }

  interface NewsSite {
    id: string
    name: string
    lang: 'vi' | 'en'
    url: string
    enabled: boolean
  }

  type DnsProvider = 'off' | 'cloudflare' | 'google'
  type ProxyMode = 'system' | 'direct' | 'custom'

  interface NetworkSettings {
    dns: DnsProvider
    proxyMode: ProxyMode
    proxyUrl: string
  }

  interface ConnectionTest {
    ok: boolean
    ms: number
    error?: string
  }

  interface RunningSession {
    gameId: string
    startedAt: number // ms
  }

  interface PlayStats {
    days: { date: string; hours: number }[] // 14 ngày gần nhất, cũ => mới
    weekHours: number
    prevWeekHours: number
    streak: number
    topGame: { gameId: string; hours: number } | null
  }

  // Kết quả gọi SteamGridDB: lỗi được trả về dạng message thay vì throw
  type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

  type SgdbImageKind = 'poster' | 'grid' | 'hero'

  // cover: ảnh ngang, poster: ảnh dọc 2:3
  type CoverKind = 'cover' | 'poster'

  interface SgdbGame {
    id: number
    name: string
    year: number | null
    verified: boolean
  }

  interface SgdbImage {
    id: number
    url: string
    thumb: string
    width: number
    height: number
    style: string
    author: string | null
  }

  interface SteamAppMatch {
    appId: string
    name: string
    installed: boolean // Tìm thấy trong thư viện Steam trên máy
  }

  interface NameSuggestion {
    name: string
    source: 'metadata' | 'folder' | 'file'
  }

  interface ElectronAPI {
    games: {
      getAll: () => Promise<Game[]>
      getById: (id: string) => Promise<Game | undefined>
      create: (input: GameInput) => Promise<Game>
      update: (id: string, input: GameUpdateInput) => Promise<Game | undefined>
      delete: (id: string) => Promise<boolean>
      selectExe: () => Promise<string | null>
      inspectExe: (exePath: string) => Promise<{ suggestions: NameSuggestion[] }>
      findSteamApp: (title: string) => Promise<SteamAppMatch | null>
      selectCover: () => Promise<{ path: string; preview: string } | null>
      previewCover: (imagePath: string) => Promise<string | null>
      setCover: (
        id: string,
        imagePath: string | null,
        kind?: CoverKind
      ) => Promise<Game | undefined>
      getPathForFile: (file: File) => string
      launch: (id: string) => Promise<LaunchResult>
      getRunning: () => Promise<RunningSession[]>
      getStats: () => Promise<PlayStats>
      // Màu chủ đạo của ảnh game dạng "r, g, b"
      getArtColor: (id: string) => Promise<string | null>
      getGameStats: (id: string) => Promise<GameStats>
      setNotes: (id: string, notes: string) => Promise<Game | undefined>
      getSteamDetails: (id: string, force?: boolean) => Promise<SteamDetailsResult>
      getInstallInfo: (id: string, withSize?: boolean) => Promise<InstallInfo>
      // null = mở được, chuỗi = thông báo lỗi
      openFolder: (id: string) => Promise<string | null>
      onSessionChanged: (callback: (event: GameSessionEvent) => void) => () => void
      onUpdated: (callback: (game: Game) => void) => () => void
    }
    news: {
      get: (tab: NewsTab, force?: boolean) => Promise<ApiResult<NewsResult>>
      getGame: (gameId: string, force?: boolean) => Promise<ApiResult<NewsResult>>
      getFollowing: () => Promise<FollowedGame[]>
      getSuggestions: () => Promise<FollowedGame[]>
      follow: (name: string, appId: string | null) => Promise<ApiResult<FollowedGame[]>>
      unfollow: (id: string) => Promise<FollowedGame[]>
      getSites: () => Promise<NewsSite[]>
      setSiteEnabled: (id: string, enabled: boolean) => Promise<NewsSite[]>
    }
    network: {
      getSettings: () => Promise<NetworkSettings>
      saveSettings: (settings: NetworkSettings) => Promise<ApiResult<NetworkSettings>>
      testSteam: () => Promise<ConnectionTest>
    }
    steamGridDb: {
      isConfigured: () => Promise<boolean>
      saveApiKey: (apiKey: string) => Promise<ApiResult<void>>
      search: (term: string) => Promise<ApiResult<SgdbGame[]>>
      getBySteamAppId: (appId: string) => Promise<ApiResult<SgdbGame | null>>
      getImages: (
        gameId: number,
        kind: SgdbImageKind,
        page: number
      ) => Promise<ApiResult<SgdbImage[]>>
      download: (url: string) => Promise<ApiResult<{ path: string; preview: string }>>
    }
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}
