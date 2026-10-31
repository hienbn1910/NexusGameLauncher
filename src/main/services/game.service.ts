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
  notes: string | null
  watch_dirs: string | null // Thư mục theo dõi giờ chơi, mỗi dòng một thư mục
  launch_args: string | null // Tham số khi chạy exe (JSON mảng chuỗi)
  catalog_id: string | null // Mã trong danh mục game phổ biến
  game_exe: string | null // Exe game thật (lấy icon), khác exe_path khi exe_path là launcher
  sgdb_id: number | null // Mã game trên SteamGridDB (chọn từ gợi ý tên game)
  created_at: string
  updated_at: string
}

// Kiểu dữ liệu khi thêm game mới (chỉ cần title và exe_path).
// exe_path = '' => game chưa liên kết (thêm từ danh mục nhưng chưa tìm thấy trên máy)
export interface CreateGameInput {
  title: string
  exe_path: string
  genre?: string
  process_name?: string
  watch_dirs?: string[]
  launch_args?: string[]
  catalog_id?: string
  steam_app_id?: string
  game_exe?: string
  sgdb_id?: number | null // null = bỏ liên kết (vd đổi tên game mà không chọn gợi ý)
}

const toSgdbId = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null

// Game chưa có file chạy (chưa liên kết)
export const isLinked = (game: Pick<Game, 'exe_path'>): boolean => game.exe_path.trim() !== ''

// Tham số chạy đã lưu => mảng chuỗi (dữ liệu hỏng => không có tham số)
export function parseLaunchArgs(value: string | null): string[] {
  try {
    const list: unknown = JSON.parse(value ?? '[]')
    return Array.isArray(list) ? list.filter((a): a is string => typeof a === 'string') : []
  } catch {
    return []
  }
}

const packArgs = (args: string[] | undefined): string | null =>
  args && args.length > 0 ? JSON.stringify(args) : null

// Danh sách thư mục => chuỗi lưu DB (bỏ trùng, bỏ dòng trống; rỗng => null = tự động)
function packDirs(dirs: unknown): string | null {
  if (!Array.isArray(dirs)) return null
  const seen = new Set<string>()
  const list: string[] = []
  for (const dir of dirs) {
    const value = typeof dir === 'string' ? dir.trim() : ''
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase())
      list.push(value)
    }
  }
  return list.length > 0 ? list.slice(0, 10).join('\n') : null
}

export function unpackDirs(value: string | null): string[] {
  return value ? value.split('\n').filter(Boolean) : []
}

// Kiểu dữ liệu khi sửa game (genre / process_name = '', watch_dirs = [] nghĩa là xoá giá trị)
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
      (id, title, exe_path, source, source_id, genre, process_name, watch_dirs,
       launch_args, catalog_id, steam_app_id, game_exe, sgdb_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.title,
    input.exe_path,
    source,
    source_id,
    input.genre || null,
    input.process_name?.trim() || null,
    packDirs(input.watch_dirs),
    packArgs(input.launch_args),
    input.catalog_id ?? null,
    input.steam_app_id ?? null,
    input.game_exe ?? null,
    toSgdbId(input.sgdb_id),
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
  // Tham số chạy gắn với file chạy cũ: đổi file chạy (người dùng tự chọn) thì bỏ tham số
  const launchArgs =
    input.launch_args !== undefined
      ? packArgs(input.launch_args)
      : exePath === existing.exe_path
        ? existing.launch_args
        : null
  const stmt = db.prepare(`
    UPDATE games
    SET title = ?, exe_path = ?, source = ?, source_id = ?, genre = ?, process_name = ?,
        watch_dirs = ?, launch_args = ?, sgdb_id = ?, is_favorite = ?, updated_at = ?
    WHERE id = ?
  `)

  stmt.run(
    input.title ?? existing.title,
    exePath,
    source,
    source_id,
    input.genre !== undefined ? input.genre || null : existing.genre,
    input.process_name !== undefined ? input.process_name.trim() || null : existing.process_name,
    input.watch_dirs !== undefined ? packDirs(input.watch_dirs) : existing.watch_dirs,
    launchArgs,
    input.sgdb_id !== undefined ? toSgdbId(input.sgdb_id) : existing.sgdb_id,
    input.is_favorite !== undefined ? Number(input.is_favorite) : existing.is_favorite,
    now,
    id
  )

  return getGameById(id)
}

// Exe game thật (để lấy icon); không đổi updated_at vì người dùng không sửa gì
export function setGameExe(id: string, exePath: string | null): Game | undefined {
  getDb().prepare('UPDATE games SET game_exe = ? WHERE id = ?').run(exePath, id)
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

const MAX_NOTES = 20_000

export function setNotes(id: string, notes: string): Game | undefined {
  getDb()
    .prepare('UPDATE games SET notes = ? WHERE id = ?')
    .run(notes.slice(0, MAX_NOTES) || null, id)
  return getGameById(id)
}

export interface GameStats {
  sessions: number
  longestHours: number
  averageHours: number
  firstPlayed: string | null // Phiên chơi đầu tiên được ghi lại
  share: number // Tỉ lệ giờ chơi so với cả thư viện (0..1)
  weeks: { start: string; hours: number }[] // 12 tuần gần nhất (bắt đầu từ thứ 2), cũ => mới
  recent: { startedAt: string; endedAt: string; hours: number }[] // 15 phiên gần nhất
}

const WEEKS = 12

// Thứ 2 của tuần chứa ngày d (giờ máy)
function startOfWeek(d: Date): Date {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7))
  return day
}

export function getGameStats(gameId: string): GameStats {
  const db = getDb()
  const summary = db
    .prepare(
      `SELECT COUNT(*) AS count, MAX(hours) AS longest, AVG(hours) AS average, MIN(started_at) AS first
       FROM play_sessions WHERE game_id = ? AND hours > 0`
    )
    .get(gameId) as {
    count: number
    longest: number | null
    average: number | null
    first: string | null
  }

  const game = getGameById(gameId)
  const total = (
    db.prepare('SELECT SUM(total_playtime) AS total FROM games').get() as {
      total: number | null
    }
  ).total
  const share = game && total ? game.total_playtime / total : 0

  const firstWeek = startOfWeek(new Date())
  firstWeek.setDate(firstWeek.getDate() - (WEEKS - 1) * 7)
  const rows = db
    .prepare('SELECT started_at, hours FROM play_sessions WHERE game_id = ? AND started_at >= ?')
    .all(gameId, firstWeek.toISOString()) as { started_at: string; hours: number }[]

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(firstWeek)
    start.setDate(start.getDate() + i * 7)
    return { start, hours: 0 }
  })
  for (const r of rows) {
    const index = Math.floor(
      (startOfWeek(new Date(r.started_at)).getTime() - firstWeek.getTime()) / (7 * 86_400_000) + 0.5
    )
    if (weeks[index]) weeks[index].hours += r.hours
  }

  const recent = db
    .prepare(
      `SELECT started_at AS startedAt, ended_at AS endedAt, hours FROM play_sessions
       WHERE game_id = ? ORDER BY started_at DESC LIMIT 15`
    )
    .all(gameId) as GameStats['recent']

  return {
    sessions: summary.count,
    longestHours: summary.longest ?? 0,
    averageHours: summary.average ?? 0,
    firstPlayed: summary.first,
    share,
    weeks: weeks.map((w) => ({ start: localDate(w.start), hours: w.hours })),
    recent
  }
}

export function deleteGame(id: string): boolean {
  const db = getDb()
  db.prepare('DELETE FROM play_sessions WHERE game_id = ?').run(id)
  const stmt = db.prepare('DELETE FROM games WHERE id = ?')
  const result = stmt.run(id)
  return result.changes > 0
}
