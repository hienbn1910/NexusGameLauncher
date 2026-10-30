import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'games.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
}

// Đóng database (trước khi xoá file khi reset dữ liệu)
export function closeDatabase(): void {
  if (db?.open) db.close()
}

export function getDb(): Database.Database {
  return db
}
