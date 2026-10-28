import { useState } from 'react'
import { iconUrl } from '../utils/gameArt'

interface GameIconArtProps {
  game: Game
  className?: string
  // Hiển thị khi game không có icon (game Steam, file exe đã bị xoá...)
  fallback: React.ReactNode
}

// Ảnh thay thế cho game không có ảnh bìa (game không phát hành trên Steam):
// icon lớn của file exe đặt giữa nền gradient
export function GameIconArt({
  game,
  className = '',
  fallback
}: GameIconArtProps): React.JSX.Element {
  const icon = iconUrl(game)
  const [failedIcon, setFailedIcon] = useState<string | null>(null)

  if (!icon || failedIcon === icon) return <>{fallback}</>

  return (
    <span className={`icon-art ${className}`}>
      <img
        className="icon-art-glow"
        src={icon}
        alt=""
        draggable={false}
        onError={() => setFailedIcon(icon)}
      />
      <img className="icon-art-image" src={icon} alt="" draggable={false} />
    </span>
  )
}
