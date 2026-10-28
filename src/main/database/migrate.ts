import { getDb } from './index'

export function runMigrations() {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      exe_path TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      source_id TEXT,
      genre TEXT,
      cover_path TEXT,
      is_favorite INTEGER DEFAULT 0,
      total_playtime INTEGER DEFAULT 0,
      last_played TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Cài đặt dạng key-value (API key, tuỳ chọn...)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)

  // Thêm cột mới cho database đã tạo từ phiên bản trước
  const columns = db.prepare('PRAGMA table_info(games)').all() as { name: string }[]
  const has = (name: string): boolean => columns.some((c) => c.name === name)

  // Tên tiến trình game thật (vd Game.exe) khi exe_path chỉ là launcher của game
  if (!has('process_name')) {
    db.exec('ALTER TABLE games ADD COLUMN process_name TEXT')
  }
}
