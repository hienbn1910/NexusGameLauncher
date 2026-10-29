import { useState } from 'react'
import { coverUrl, formatRelative, gameGradient } from '../utils/gameArt'

// Ảnh tin tức; lỗi (bị chặn, ảnh hỏng) thì dùng ảnh bìa game trên máy hoặc nền gradient
function NewsImage({ item, game }: { item: NewsItem; game?: Game }): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  const fallback = game ? coverUrl(game) : null
  const src = !failed && item.image ? item.image : fallback

  return (
    <span className="news-image" style={{ background: gameGradient(item.gameName ?? item.title) }}>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => (src === fallback ? undefined : setFailed(true))}
        />
      )}
      {item.isPatch && <span className="news-tag">Cập nhật</span>}
    </span>
  )
}

interface NewsCardProps {
  item: NewsItem
  game?: Game
}

// Thẻ tin kích thước cố định (trang chủ, trang chi tiết game)
export function NewsCard({ item, game }: NewsCardProps): React.JSX.Element {
  return (
    // target=_blank: main process mở link bằng trình duyệt mặc định
    <a className="news-card" href={item.url} target="_blank" rel="noreferrer">
      <NewsImage item={item} game={game} />
      <span className="news-body">
        <span className="news-meta">
          <span className={`news-origin ${item.origin}`}>
            {item.origin === 'steam' ? 'Steam' : item.sourceName}
          </span>
          {item.lang && <span className="news-lang">{item.lang.toUpperCase()}</span>}
          {item.date > 0 && <span>{formatRelative(new Date(item.date).toISOString())}</span>}
        </span>
        {/* Luôn giữ chỗ cho từng dòng để mọi thẻ cao bằng nhau */}
        <span className="news-game">{item.gameName ?? ' '}</span>
        <span className="news-title">{item.title}</span>
        <span className="news-summary">{item.summary}</span>
      </span>
    </a>
  )
}
