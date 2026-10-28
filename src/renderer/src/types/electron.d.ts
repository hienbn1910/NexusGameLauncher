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
    is_favorite: number
    total_playtime: number
    last_played: string | null
    process_name: string | null
  }

  type LaunchResult = { ok: true; game: Game } | { ok: false; error: string }

  interface GameSessionEvent {
    gameId: string
    running: boolean
    game?: Game
  }

  // Kết quả gọi SteamGridDB: lỗi được trả về dạng message thay vì throw
  type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

  type SgdbImageKind = 'grid' | 'hero'

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
      selectCover: () => Promise<{ path: string; preview: string } | null>
      previewCover: (imagePath: string) => Promise<string | null>
      setCover: (id: string, imagePath: string | null) => Promise<Game | undefined>
      getPathForFile: (file: File) => string
      launch: (id: string) => Promise<LaunchResult>
      getRunning: () => Promise<string[]>
      onSessionChanged: (callback: (event: GameSessionEvent) => void) => () => void
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
