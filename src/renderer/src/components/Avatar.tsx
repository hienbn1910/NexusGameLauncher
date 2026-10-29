import { useState } from 'react'
import { findPreset, nameInitials } from '../utils/avatar'

interface AvatarProps {
  name: string
  type: AvatarType
  // preset: mã avatar; image: URL ảnh (game-media://avatar/... hoặc data URL xem trước)
  value: string | null
  size?: number
  className?: string
}

// Ảnh đại diện: ảnh tải lên => avatar có sẵn => chữ cái đầu của tên
export function Avatar({
  name,
  type,
  value,
  size = 36,
  className = ''
}: AvatarProps): React.JSX.Element {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }

  if (type === 'image' && value && failedSrc !== value) {
    return (
      <span className={`avatar avatar-image ${className}`} style={style}>
        <img src={value} alt="" draggable={false} onError={() => setFailedSrc(value)} />
      </span>
    )
  }

  const preset = type === 'preset' ? findPreset(value) : undefined
  if (preset) {
    return (
      <span
        className={`avatar ${className}`}
        style={{
          ...style,
          fontSize: Math.round(size * 0.5),
          background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`
        }}
      >
        {preset.glyph}
      </span>
    )
  }

  return (
    <span className={`avatar ${className}`} style={style}>
      {nameInitials(name)}
    </span>
  )
}
