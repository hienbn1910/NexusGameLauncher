export {}

declare global {
  interface GameInput {
    title: string
    exe_path: string
    genre?: string
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

  interface ElectronAPI {
    games: {
      getAll: () => Promise<Game[]>
      getById: (id: string) => Promise<Game | undefined>
      create: (input: GameInput) => Promise<Game>
      update: (id: string, input: Partial<GameInput>) => Promise<Game | undefined>
      delete: (id: string) => Promise<boolean>
      selectExe: () => Promise<string | null>
    }
  }

  interface Window {
    electronAPI: ElectronAPI
  }
}
