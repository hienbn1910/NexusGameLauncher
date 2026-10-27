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

export function gameInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// total_playtime được lưu theo đơn vị giờ (có thể là số lẻ, vd 1.5 = 1 giờ 30 phút)
export function formatPlaytime(hours: number): string {
  if (!hours) return 'Chưa chơi'
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} phút`
  return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`
}
