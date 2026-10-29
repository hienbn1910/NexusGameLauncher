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

  // Từng phiên chơi (để vẽ thống kê theo ngày, tính chuỗi ngày chơi...)
  // hours = thời gian game thực sự chạy, có thể ít hơn ended_at - started_at
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      hours REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_play_sessions_started ON play_sessions (started_at);
    CREATE INDEX IF NOT EXISTS idx_play_sessions_game ON play_sessions (game_id);
  `)

  // Tin tức tải lần gần nhất của từng nguồn RSS (hiện lại khi mất mạng / bị chặn)
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_cache (
      feed_key TEXT PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      items TEXT NOT NULL
    )
  `)

  // Thông tin game từ Steam (mô tả, ảnh, trailer...) để không phải tải lại mỗi lần mở trang game
  db.exec(`
    CREATE TABLE IF NOT EXISTS steam_details (
      app_id TEXT PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      data TEXT NOT NULL
    )
  `)

  // Thêm cột mới cho database đã tạo từ phiên bản trước
  const columns = db.prepare('PRAGMA table_info(games)').all() as { name: string }[]
  const has = (name: string): boolean => columns.some((c) => c.name === name)

  // Tên tiến trình game thật (vd Game.exe) khi exe_path chỉ là launcher của game
  if (!has('process_name')) {
    db.exec('ALTER TABLE games ADD COLUMN process_name TEXT')
  }

  // Ảnh bìa dọc (tỉ lệ 2:3) cho chế độ lưới kiểu Steam
  if (!has('poster_path')) {
    db.exec('ALTER TABLE games ADD COLUMN poster_path TEXT')
  }

  // Lần tự tìm ảnh Steam gần nhất (tên + đường dẫn lúc tìm) để không tìm lại khi không có gì đổi
  if (!has('art_lookup')) {
    db.exec('ALTER TABLE games ADD COLUMN art_lookup TEXT')
  }

  // Logo trong suốt của game (Steam logo.png) để hiển thị trên banner
  if (!has('logo_path')) {
    db.exec('ALTER TABLE games ADD COLUMN logo_path TEXT')
  }

  // Steam App ID tìm được (kể cả game không thêm qua Steam) để lấy tin tức game
  if (!has('steam_app_id')) {
    db.exec('ALTER TABLE games ADD COLUMN steam_app_id TEXT')
  }

  // Ghi chú cá nhân của người dùng cho từng game
  if (!has('notes')) {
    db.exec('ALTER TABLE games ADD COLUMN notes TEXT')
  }
}
