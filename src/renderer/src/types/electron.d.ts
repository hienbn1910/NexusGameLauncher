export {}

declare global {
  interface GameInput {
    title: string
    exe_path: string
    genre?: string
  }

  // genre = '' để xoá thể loại
  interface GameUpdateInput extends Partial<GameInput> {
    is_favorite?: boolean
  }

  interface Game {
    id: string
    title: string
    exe_path: string
    source: string
    genre: string | null
    cover_path: string | null
    is_favorite: number
    total_playtime: number
    last_played: string | null
  }

  type LaunchResult = { ok: true; game: Game } | { ok: false; error: string }

  interface GameSessionEvent {
    gameId: string
    running: boolean
    game?: Game
  }

  interface ElectronAPI {
    games: {
      getAll: () => Promise<Game[]>
      getById: (id: string) => Promise<Game | undefined>
      create: (input: GameInput) => Promise<Game>
      update: (id: string, input: GameUpdateInput) => Promise<Game | undefined>
      delete: (id: string) => Promise<boolean>
      selectExe: () => Promise<string | null>
      launch: (id: string) => Promise<LaunchResult>
      getRunning: () => Promise<string[]>
      onSessionChanged: (callback: (event: GameSessionEvent) => void) => () => void
    }
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}
