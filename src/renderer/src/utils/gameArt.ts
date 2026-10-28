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
export function coverUrl(game: Pick<Game, 'cover_path'>): string | null {
  if (!game.cover_path) return null
  const fileName = game.cover_path.split(/[\\/]/).pop() ?? ''
  return `game-media://cover/${encodeURIComponent(fileName)}`
}

export function gameInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// total_playtime được lưu theo đơn vị giờ, hiển thị 1 chữ số thập phân: 12.5 giờ, 3 giờ
export function formatPlaytime(hours: number): string {
  if (!hours) return 'Chưa chơi'
  if (hours < 0.1) return '< 0.1 giờ'
  const rounded = Math.round(hours * 10) / 10
  return `${rounded.toFixed(1).replace(/\.0$/, '')} giờ`
}
