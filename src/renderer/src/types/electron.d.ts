export {}

declare global {
  interface GameInput {
    title: string
    exe_path: string
    genre?: string
    process_name?: string
    // Thư mục theo dõi giờ chơi thêm vào (ngoài thư mục cài game)
    watch_dirs?: string[]
    // Mã game SteamGridDB khi chọn từ gợi ý tên game (null = bỏ liên kết)
    sgdb_id?: number | null
  }

  // genre / process_name = '', watch_dirs = [] để xoá giá trị
  interface GameUpdateInput extends Partial<GameInput> {
    is_favorite?: boolean
  }

  interface Game {
    id: string
    title: string
    exe_path: string // '' = chưa liên kết (thêm từ danh mục nhưng chưa tìm thấy trên máy)
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
    watch_dirs: string | null // Mỗi dòng một thư mục
    launch_args: string | null // Tham số khi chạy (JSON mảng chuỗi), vd của Riot Client
    catalog_id: string | null
    game_exe: string | null // Exe game thật (lấy icon) khi exe_path là launcher
    sgdb_id: number | null // Mã game trên SteamGridDB (chọn từ gợi ý tên game)
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

  // code 'unlinked': game chưa có file chạy => mở form để người dùng chọn file
  type LaunchResult =
    { ok: true; game: Game } | { ok: false; error: string; code?: 'unlinked'; game?: Game }

  // Game trong danh mục game phổ biến + trạng thái trên máy
  // installed = đã cài; available = mở qua launcher (Steam, Riot Client) để cài; missing = không thấy
  type CatalogStatus = 'installed' | 'available' | 'missing'
  interface CatalogItem {
    id: string
    title: string
    genre: string
    steamAppId: string | null
    status: CatalogStatus
    via: string | null // Mở qua đâu: Steam, Riot Client, HoYoPlay...
    inLibrary: boolean
  }

  // launcher: mới mở launcher, chưa vào game (không đếm giờ); playing: game thật đang chạy
  type SessionPhase = 'launcher' | 'playing'

  interface GameSessionEvent {
    gameId: string
    running: boolean
    phase?: SessionPhase
    game?: Game
    // Mốc cho đồng hồ phiên chơi (now - startedAt = thời gian đã chơi), null khi chưa vào game
    startedAt?: number | null
  }

  // Trạng thái game đang mở trên giao diện
  interface RunningInfo {
    phase: SessionPhase
    startedAt: number | null
  }

  // Launcher sinh ra exe ở thư mục lạ chạy lâu => gợi ý dùng làm thư mục game
  interface WatchDirSuggestion {
    gameId: string
    title: string
    dir: string
    exeName: string
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

  interface RunningSession extends RunningInfo {
    gameId: string
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

  // Key SteamGridDB đang dùng: của người dùng, mặc định của Nexus, hoặc chưa có
  interface SgdbKeyStatus {
    source: 'user' | 'default' | 'none'
    defaultBroken: boolean // Key mặc định đã bị SteamGridDB từ chối
  }

  // cover: ảnh ngang, poster: ảnh dọc 2:3
  type CoverKind = 'cover' | 'poster'

  interface SgdbGame {
    id: number
    name: string
    year: number | null
    verified: boolean
    platforms: string[] // Nền tảng có game, vd ['steam', 'gog']
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

  // Hồ sơ người dùng (hiện lưu trên máy; accountType 'remote' dành cho tài khoản online sau này)
  type AvatarType = 'initials' | 'preset' | 'image'

  interface UserProfile {
    id: string
    displayName: string
    // preset: mã avatar có sẵn, image: game-media://avatar/...
    avatar: { type: AvatarType; value: string | null }
    accountType: 'local' | 'remote'
    onboarded: boolean
    createdAt: string
  }

  // image: path = ảnh mới chọn; không có path = giữ ảnh hiện tại
  type AvatarInput =
    { type: 'initials' } | { type: 'preset'; value: string } | { type: 'image'; path?: string }

  interface ProfileInput {
    displayName: string
    avatar: AvatarInput
  }

  interface TrackingInfo {
    autoDetect: boolean // Tự nhận game mở ngoài Nexus
    nativeProcessApi: boolean // Đang dùng API Windows (false = tasklist, chậm hơn)
  }

  // Giao diện: Tối giản (mặc định), Cân bằng (miễn phí), Neon (cần mở khoá)
  type ThemeId = 'minimal' | 'balanced' | 'neon'
  interface Appearance {
    theme: ThemeId
    unlocked: ThemeId[] // Các theme dùng được
  }

  // Cập nhật tự động từ GitHub Releases (bản dev: disabled)
  interface UpdateStatus {
    currentVersion: string
    state: 'disabled' | 'idle' | 'checking' | 'downloading' | 'ready' | 'latest' | 'error'
    version: string | null // Phiên bản mới
    progress: number | null // % đã tải
    error: string | null
  }

  // Chạy nền ở khay hệ thống
  interface BackgroundSettings {
    closeToTray: boolean // Đóng cửa sổ => ẩn xuống khay, vẫn tính giờ chơi
    openAtLogin: boolean // Khởi động cùng Windows (chạy ẩn)
    canAutoStart: boolean // Chỉ bản cài đặt mới bật được
  }

  // Dữ liệu người dùng của app (%APPDATA%\game-launcher)
  interface DataInfo {
    path: string
    bytes: number
    files: number
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
      getCatalog: () => Promise<CatalogItem[]>
      // Thêm game đã chọn từ danh mục (game không tìm thấy trên máy => chưa liên kết)
      addFromCatalog: (ids: string[]) => Promise<Game[]>
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
      // null = huỷ; error = thư mục không dùng được (quá chung, không tồn tại)
      selectWatchDir: () => Promise<{ path: string; error: string | null } | null>
      validateWatchDir: (path: string) => Promise<string | null>
      getTrackingInfo: () => Promise<TrackingInfo>
      acceptWatchDir: (id: string, dir: string) => Promise<Game | undefined>
      dismissWatchDir: (id: string, dir: string) => Promise<void>
      onWatchDirSuggestion: (callback: (suggestion: WatchDirSuggestion) => void) => () => void
      setAutoDetect: (enabled: boolean) => Promise<boolean>
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
    profile: {
      get: () => Promise<UserProfile>
      save: (input: ProfileInput) => Promise<ApiResult<UserProfile>>
      skipOnboarding: () => Promise<UserProfile>
      pickAvatar: () => Promise<{ path: string; preview: string } | null>
      previewAvatar: (imagePath: string) => Promise<{ path: string; preview: string } | null>
    }
    app: {
      getDataInfo: () => Promise<DataInfo>
      openDataFolder: () => Promise<ApiResult<void>>
      // Xoá toàn bộ dữ liệu, về như mới cài (giao diện tự tải lại sau đó)
      resetData: () => Promise<ApiResult<void>>
      getAppearance: () => Promise<Appearance>
      // Lỗi nếu theme chưa mở khoá
      setTheme: (theme: ThemeId) => Promise<ApiResult<Appearance>>
      getBackgroundSettings: () => Promise<BackgroundSettings>
      setCloseToTray: (enabled: boolean) => Promise<BackgroundSettings>
      // Lỗi nếu chạy bản dev
      setOpenAtLogin: (enabled: boolean) => Promise<ApiResult<BackgroundSettings>>
      getUpdateStatus: () => Promise<UpdateStatus>
      checkForUpdates: () => Promise<UpdateStatus>
      installUpdate: () => Promise<void>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
    }
    network: {
      getSettings: () => Promise<NetworkSettings>
      saveSettings: (settings: NetworkSettings) => Promise<ApiResult<NetworkSettings>>
      testSteam: () => Promise<ConnectionTest>
    }
    steamGridDb: {
      isConfigured: () => Promise<boolean>
      getKeyStatus: () => Promise<SgdbKeyStatus>
      saveApiKey: (apiKey: string) => Promise<ApiResult<void>>
      search: (term: string) => Promise<ApiResult<SgdbGame[]>>
      getBySteamAppId: (appId: string) => Promise<ApiResult<SgdbGame | null>>
      // null = game không có trên Steam
      getSteamAppId: (gameId: number) => Promise<ApiResult<string | null>>
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
