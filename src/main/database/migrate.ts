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
}
