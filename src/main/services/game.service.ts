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
  poster_path: string | null
  logo_path: string | null
  steam_app_id: string | null
  is_favorite: number
  total_playtime: number
  last_played: string | null
  process_name: string | null
  art_lookup: string | null
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
    input.process_name !== undefined ? input.process_name.trim() || null : existing.process_name,
    input.is_favorite !== undefined ? Number(input.is_favorite) : existing.is_favorite,
    now,
    id
  )

  return getGameById(id)
}

export type ImageColumn = 'cover_path' | 'poster_path' | 'logo_path'

// column: cover_path (ảnh ngang), poster_path (ảnh dọc) hoặc logo_path (logo trong suốt)
export function updateCoverPath(
  id: string,
  coverPath: string | null,
  column: ImageColumn = 'cover_path'
): Game | undefined {
  const db = getDb()
  db.prepare(`UPDATE games SET ${column} = ?, updated_at = ? WHERE id = ?`).run(
    coverPath,
    new Date().toISOString(),
    id
  )
  return getGameById(id)
}

export function setArtLookup(id: string, key: string, steamAppId: string | null): void {
  getDb()
    .prepare('UPDATE games SET art_lookup = ?, steam_app_id = ? WHERE id = ?')
    .run(key, steamAppId, id)
}

// ---------- Phiên chơi & thống kê ----------

export function addPlaySession(
  gameId: string,
  startedAt: Date,
  endedAt: Date,
  hours: number
): void {
  getDb()
    .prepare('INSERT INTO play_sessions (game_id, started_at, ended_at, hours) VALUES (?, ?, ?, ?)')
    .run(gameId, startedAt.toISOString(), endedAt.toISOString(), hours)
}

export interface PlayStats {
  // Giờ chơi từng ngày (giờ địa phương), 14 ngày gần nhất, cũ => mới
  days: { date: string; hours: number }[]
  weekHours: number // 7 ngày gần nhất (tính cả hôm nay)
  prevWeekHours: number // 7 ngày trước đó
  streak: number // Số ngày chơi liên tiếp tới hôm nay (hoặc hôm qua nếu hôm nay chưa chơi)
  topGame: { gameId: string; hours: number } | null // Chơi nhiều nhất 7 ngày gần nhất
}

// YYYY-MM-DD theo giờ máy
function localDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export function getPlayStats(): PlayStats {
  const db = getDb()
  const since = daysAgo(13)

  // Phiên chơi được tính vào ngày bắt đầu
  const rows = db
    .prepare(
      `SELECT date(started_at, 'localtime') AS day, game_id, SUM(hours) AS hours
       FROM play_sessions WHERE started_at >= ? GROUP BY day, game_id`
    )
    .all(since.toISOString()) as { day: string; game_id: string; hours: number }[]

  const byDay = new Map<string, number>()
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.hours)

  const days = Array.from({ length: 14 }, (_, i) => {
    const date = localDate(daysAgo(13 - i))
    return { date, hours: byDay.get(date) ?? 0 }
  })
  const sum = (list: typeof days): number => list.reduce((s, d) => s + d.hours, 0)

  const weekStart = localDate(daysAgo(6))
  const byGame = new Map<string, number>()
  for (const r of rows) {
    if (r.day >= weekStart) byGame.set(r.game_id, (byGame.get(r.game_id) ?? 0) + r.hours)
  }
  const top = [...byGame].sort((a, b) => b[1] - a[1])[0]

  // Chuỗi ngày chơi: đếm lùi từ hôm nay (hoặc hôm qua) qua các ngày có chơi
  const played = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT date(started_at, 'localtime') AS day FROM play_sessions
           WHERE started_at >= ? AND hours > 0`
        )
        .all(daysAgo(400).toISOString()) as { day: string }[]
    ).map((r) => r.day)
  )
  let streak = 0
  let offset = played.has(localDate(daysAgo(0))) ? 0 : 1
  while (played.has(localDate(daysAgo(offset)))) {
    streak++
    offset++
  }

  return {
    days,
    weekHours: sum(days.slice(7)),
    prevWeekHours: sum(days.slice(0, 7)),
    streak,
    topGame: top ? { gameId: top[0], hours: top[1] } : null
  }
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
  db.prepare('DELETE FROM play_sessions WHERE game_id = ?').run(id)
  const stmt = db.prepare('DELETE FROM games WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}
