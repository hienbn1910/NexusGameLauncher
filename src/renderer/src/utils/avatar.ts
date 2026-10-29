// Bộ avatar có sẵn: chỉ lưu mã (vd "dragon") nên đồng bộ tài khoản sau này vẫn dùng được
export interface AvatarPreset {
  id: string
  glyph: string
  from: string
  to: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'gamepad', glyph: '🎮', from: '#8b5cf6', to: '#ec4899' },
  { id: 'alien', glyph: '👾', from: '#6366f1', to: '#22d3ee' },
  { id: 'dragon', glyph: '🐉', from: '#059669', to: '#84cc16' },
  { id: 'sword', glyph: '⚔️', from: '#475569', to: '#94a3b8' },
  { id: 'rocket', glyph: '🚀', from: '#1d4ed8', to: '#7c3aed' },
  { id: 'fox', glyph: '🦊', from: '#ea580c', to: '#facc15' },
  { id: 'cat', glyph: '🐱', from: '#db2777', to: '#f9a8d4' },
  { id: 'ninja', glyph: '🥷', from: '#111827', to: '#4b5563' },
  { id: 'fire', glyph: '🔥', from: '#dc2626', to: '#f97316' },
  { id: 'crown', glyph: '👑', from: '#b45309', to: '#fde047' },
  { id: 'moon', glyph: '🌙', from: '#1e1b4b', to: '#6366f1' },
  { id: 'robot', glyph: '🤖', from: '#0891b2', to: '#a5f3fc' }
]

export const findPreset = (id: string | null): AvatarPreset | undefined =>
  AVATAR_PRESETS.find((p) => p.id === id)

// "Nguyễn Văn An" => "NA", "Player" => "P"
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = [...words[0]][0] ?? ''
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : ''
  return (first + last).toUpperCase()
}

export const DEFAULT_PROFILE_NAME = 'Player'
export const MAX_PROFILE_NAME = 32
