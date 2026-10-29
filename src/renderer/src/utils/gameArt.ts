// Sinh "ảnh bìa" từ tên game khi chưa có cover thật.
// Cùng một tên luôn ra cùng một màu nên giao diện ổn định giữa các lần mở.

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function gameGradient(title: string): string {
  const hue = hashString(title) % 360
  const hue2 = (hue + 40) % 360
  return `linear-gradient(135deg, hsl(${hue} 65% 38%) 0%, hsl(${hue2} 70% 22%) 60%, hsl(${hue2} 60% 12%) 100%)`
}

export function gameAccent(title: string): string {
  return `hsl(${hashString(title) % 360} 70% 55%)`
}

// URL ảnh bìa qua giao thức riêng game-media:// (main process phục vụ file trong thư mục covers)
function mediaUrl(path: string | null): string | null {
  if (!path) return null
  const fileName = path.split(/[\\/]/).pop() ?? ''
  return `game-media://cover/${encodeURIComponent(fileName)}`
}

export function coverUrl(game: Pick<Game, 'cover_path'>): string | null {
  return mediaUrl(game.cover_path)
}

// Ảnh bìa dọc 2:3 cho lưới kiểu Steam (file nằm chung thư mục covers)
export function posterUrl(game: Pick<Game, 'poster_path'>): string | null {
  return mediaUrl(game.poster_path)
}

// Logo nền trong suốt (banner trang chủ)
export function logoUrl(game: Pick<Game, 'logo_path'>): string | null {
  return mediaUrl(game.logo_path)
}

// Icon của game: lấy từ exe tiến trình game, không có thì từ file launcher.
// null với game Steam (không có file exe để đọc icon).
// Thêm đường dẫn + tên tiến trình vào query để icon tự cập nhật khi đổi một trong hai
export function iconUrl(game: Pick<Game, 'id' | 'exe_path' | 'process_name'>): string | null {
  if (/^steam:\/\//i.test(game.exe_path.trim())) return null
  const version = `${game.exe_path}|${game.process_name ?? ''}`
  return `game-media://icon/${game.id}?v=${encodeURIComponent(version)}`
}

export function gameInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// "Vừa xong", "15 phút trước", "3 giờ trước", "Hôm qua", "5 ngày trước", "12/03/2026"
export function formatRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Chưa chơi'
  const time = new Date(iso).getTime()
  const minutes = Math.floor((now - time) / 60_000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`

  // So theo ngày lịch để "Hôm qua" đúng cả khi chưa đủ 48 giờ
  const startOfDay = (t: number): number => new Date(t).setHours(0, 0, 0, 0)
  const days = Math.round((startOfDay(now) - startOfDay(time)) / 86_400_000)
  if (days <= 1) return 'Hôm qua'
  if (days < 30) return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

// Đồng hồ phiên chơi: 42:15 hoặc 1:42:15
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// Dùng cho thống kê: 0 => "0 giờ", dưới 1 giờ => "45 phút", còn lại "12.5 giờ"
export function formatHours(hours: number): string {
  if (hours <= 0) return '0 giờ'
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} phút`
  return `${(Math.round(hours * 10) / 10).toFixed(1).replace(/\.0$/, '')} giờ`
}

// total_playtime được lưu theo đơn vị giờ, hiển thị 1 chữ số thập phân: 12.5 giờ, 3 giờ
export function formatPlaytime(hours: number): string {
  if (!hours) return 'Chưa chơi'
  if (hours < 0.1) return '< 0.1 giờ'
  const rounded = Math.round(hours * 10) / 10
  return `${rounded.toFixed(1).replace(/\.0$/, '')} giờ`
}
