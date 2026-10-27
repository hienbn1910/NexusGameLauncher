import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'games.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
}

export function getDb(): Database.Database {
  return db
}
