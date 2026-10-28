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
  process_name: string | null
  created_at: string
  updated_at: string
}

// Kiểu dữ liệu khi thêm game mới (chỉ cần title và exe_path)
export interface CreateGameInput {
  title: string
  exe_path: string
  genre?: string
  process_name?: string
}

// Kiểu dữ liệu khi sửa game (genre / process_name = '' nghĩa là xoá giá trị)
export interface UpdateGameInput extends Partial<CreateGameInput> {
  is_favorite?: boolean
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

// Suy ra nguồn game từ đường dẫn: steam://rungameid/<appId> => Steam, còn lại là game tự thêm
function sourceFromPath(exePath: string): { source: string; source_id: string | null } {
  const match = exePath.match(/^steam:\/\/(?:rungameid|run)\/(\d+)/i)
  return match ? { source: 'steam', source_id: match[1] } : { source: 'manual', source_id: null }
}

export function createGame(input: CreateGameInput): Game {
  const id = randomUUID()
  const now = new Date().toISOString()
  const { source, source_id } = sourceFromPath(input.exe_path)

  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO games
      (id, title, exe_path, source, source_id, genre, process_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.title,
    input.exe_path,
    source,
    source_id,
    input.genre || null,
    input.process_name?.trim() || null,
    now,
    now
  )

  return getGameById(id)!
}

export function updateGame(id: string, input: UpdateGameInput): Game | undefined {
  // Lấy game hiện tại
  const existing = getGameById(id)
  if (!existing) return undefined

  const db = getDb()
  const now = new Date().toISOString()
  const exePath = input.exe_path ?? existing.exe_path
  const { source, source_id } = sourceFromPath(exePath)
  const stmt = db.prepare(`
    UPDATE games
    SET title = ?, exe_path = ?, source = ?, source_id = ?, genre = ?, process_name = ?,
        is_favorite = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    input.title ?? existing.title,
    exePath,
    source,
    source_id,
    input.genre !== undefined ? input.genre || null : existing.genre,
    input.process_name !== undefined
      ? input.process_name.trim() || null
      : existing.process_name,
    input.is_favorite !== undefined ? Number(input.is_favorite) : existing.is_favorite,
    now,
    id
  )

  return getGameById(id)
}

export function updateCoverPath(id: string, coverPath: string | null): Game | undefined {
  const db = getDb()
  db.prepare('UPDATE games SET cover_path = ?, updated_at = ? WHERE id = ?').run(
    coverPath,
    new Date().toISOString(),
    id
  )
  return getGameById(id)
}

// Cộng thêm giờ chơi và cập nhật lần chơi cuối (hours = 0 khi chỉ muốn đánh dấu vừa chơi)
export function recordPlaySession(id: string, hours: number): Game | undefined {
  const db = getDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    UPDATE games
    SET total_playtime = total_playtime + ?, last_played = ?, updated_at = ?
    WHERE id = ?
  `)
  stmt.run(hours, now, now, id)
  return getGameById(id)
}

export function deleteGame(id: string): boolean {
  const db = getDb()
  const stmt = db.prepare('DELETE FROM games WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}
