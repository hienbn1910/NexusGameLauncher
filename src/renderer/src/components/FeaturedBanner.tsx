import { coverUrl, formatPlaytime, gameAccent, gameGradient, gameInitials } from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'
import { ClockIcon, PencilIcon, StarIcon } from './Icons'
import { PlayButton } from './PlayButton'

interface FeaturedBannerProps {
  game: Game
  onEdit: (game: Game) => void
}

export function FeaturedBanner({ game, onEdit }: FeaturedBannerProps): React.JSX.Element {
  const cover = coverUrl(game)

  return (
    <section className="featured" style={{ background: gameGradient(game.title) }}>
      {cover ? (
        <img className="featured-cover" src={cover} alt="" draggable={false} />
      ) : (
        <>
          <GameIconArt
            game={game}
            className="featured-icon"
            fallback={<span className="featured-watermark">{gameInitials(game.title)}</span>}
          />
          <div className="featured-glow" style={{ background: gameAccent(game.title) }} />
        </>
      )}

      <div className="featured-content">
        <span className="featured-badge">
          {game.is_favorite === 1 && <StarIcon width={12} height={12} />}
          Nổi bật
        </span>
        <h2 className="featured-title">{game.title}</h2>
        <div className="featured-meta">
          {game.source === 'steam' && <span className="tag">Steam</span>}
          {game.genre && <span className="tag">{game.genre}</span>}
          <span>
            <ClockIcon width={14} height={14} /> {formatPlaytime(game.total_playtime)}
          </span>
          {game.last_played && (
            <span>Lần cuối: {new Date(game.last_played).toLocaleDateString('vi-VN')}</span>
          )}
        </div>
        <div className="featured-actions">
          <PlayButton game={game} />
          <button className="btn btn-glass" onClick={() => onEdit(game)}>
            <PencilIcon width={16} height={16} /> Sửa
          </button>
        </div>
      </div>
    </section>
  )
}
