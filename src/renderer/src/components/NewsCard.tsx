import { useState } from 'react'
import placeholder from '../assets/news-placeholder.svg'
import { coverUrl, formatRelative } from '../utils/gameArt'

// Ảnh tin tức, lần lượt thử: ảnh của tin => ảnh bìa game trên máy => ảnh nền Nexus
function NewsImage({ item, game }: { item: NewsItem; game?: Game }): React.JSX.Element {
  const sources = [item.image, game ? coverUrl(game) : null, placeholder].filter(
    (s): s is string => !!s
  )
  const [failed, setFailed] = useState(0)
  const src = sources[Math.min(failed, sources.length - 1)]

  return (
    <span className="news-image">
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed((n) => n + 1)}
      />
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
