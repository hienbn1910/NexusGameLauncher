import { useState } from 'react'
import { iconUrl } from '../utils/gameArt'

interface GameIconArtProps {
  game: Game
  className?: string
  // Hiển thị khi game không có icon (game Steam, file exe đã bị xoá...)
  fallback: React.ReactNode
  // Phóng to icon phủ kín khung (khung cha cần position + overflow: hidden) rồi làm mờ làm nền
  backdrop?: boolean
}

// Ảnh thay thế cho game không có ảnh bìa (game không phát hành trên Steam):
// icon lớn của file exe đặt giữa nền gradient hoặc nền mờ của chính nó
export function GameIconArt({
  game,
  className = '',
  fallback,
  backdrop = false
}: GameIconArtProps): React.JSX.Element {
  const icon = iconUrl(game)
  const [failedIcon, setFailedIcon] = useState<string | null>(null)

  if (!icon || failedIcon === icon) return <>{fallback}</>

  return (
    <>
      {backdrop && (
        <img
          className="icon-backdrop"
          src={icon}
          alt=""
          draggable={false}
          onError={() => setFailedIcon(icon)}
        />
      )}
      <span className={`icon-art ${className}`}>
        {!backdrop && (
          <img
            className="icon-art-glow"
            src={icon}
            alt=""
            draggable={false}
            onError={() => setFailedIcon(icon)}
          />
        )}
        <img className="icon-art-image" src={icon} alt="" draggable={false} />
      </span>
    </>
  )
}
