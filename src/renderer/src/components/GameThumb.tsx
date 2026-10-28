import { useState } from 'react'
import { coverUrl, gameGradient, gameInitials, iconUrl } from '../utils/gameArt'

interface GameThumbProps {
  game: Game
}

// Ảnh nhỏ của game trong sidebar: ưu tiên icon file exe, rồi tới ảnh bìa, cuối cùng là chữ viết tắt
export function GameThumb({ game }: GameThumbProps): React.JSX.Element {
  const icon = iconUrl(game)
  const cover = coverUrl(game)
  // Lưu URL icon bị lỗi (game Steam, file exe đã bị xoá...) để chuyển sang phương án dự phòng
  const [failedIcon, setFailedIcon] = useState<string | null>(null)

  if (icon && failedIcon !== icon) {
    return (
      <span className="library-thumb has-icon">
        <img src={icon} alt="" draggable={false} onError={() => setFailedIcon(icon)} />
      </span>
    )
  }

  return (
    <span className="library-thumb" style={{ background: gameGradient(game.title) }}>
      {cover ? <img src={cover} alt="" draggable={false} /> : gameInitials(game.title)}
    </span>
  )
}
