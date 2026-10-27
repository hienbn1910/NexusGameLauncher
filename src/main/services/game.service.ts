import { randomUUID } from 'crypto'
import { getDb } from '../database'

// Kiểu dữ liệu cho một game

export interface Game {
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
  created_at: string
  updated_at: string
}

// Kiểu dữ liệu khi thêm game mới (chỉ cần title và exe_path)
export interface CreateGameInput {
  title: string
  exe_path: string
  genre?: string
}

// better-sqlite3 dùng prepared statement
// Giống repository pattern mà bạn quen trong NestJS

export function getAllGames(): Game[] {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM games ORDER BY title')
  return stmt.all() as Game[]
}

export function getGameById(id: string): Game | undefined {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM games WHERE id = ?')
  return stmt.get(id) as Game | undefined
}

export function createGame(input: CreateGameInput): Game {
  const id = randomUUID()
  const now = new Date().toISOString()

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO games (id, title, exe_path, genre, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, input.title, input.exe_path, input.genre ?? null, now, now)

  return getGameById(id)!
}

export function updateGame(id: string, input: Partial<CreateGameInput>): Game | undefined {
  // Lấy game hiện tại
  const existing = getGameById(id)
  if (!existing) return undefined

  const db = getDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    UPDATE games
    SET title = ?, exe_path = ?, genre = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    input.title ?? existing.title,
    input.exe_path ?? existing.exe_path,
    input.genre ?? existing.genre,
    now,
    id
  )

  return getGameById(id)
}

export function deleteGame(id: string): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM games WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}
