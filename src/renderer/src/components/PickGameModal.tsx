import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLauncher } from '../hooks/useLauncher'
import { useNow } from '../hooks/useNow'
import { coverUrl, formatPlaytime, formatRelative, gameGradient, posterUrl } from '../utils/gameArt'
import { GameIconArt } from './GameIconArt'
import { PlayIcon, ShuffleIcon, XIcon } from './Icons'

type PickFilter = 'all' | 'unplayed' | 'favorite' | 'stale'

const FILTERS: { key: PickFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unplayed', label: 'Chưa chơi' },
  { key: 'favorite', label: 'Yêu thích' },
  { key: 'stale', label: 'Lâu chưa chơi' }
]

const STALE_MS = 30 * 86_400_000
const TILE_H = 240 // Chiều cao 1 ô trên cuộn quay (khớp CSS)
const WINDOW_H = 300 // Chiều cao khung nhìn
const SPIN_MS = 3200
const REEL_LENGTH = 28

function matches(game: Game, filter: PickFilter, now: number): boolean {
  switch (filter) {
    case 'unplayed':
      return !game.last_played
    case 'favorite':
      return game.is_favorite === 1
    case 'stale':
      return !!game.last_played && now - new Date(game.last_played).getTime() > STALE_MS
    default:
      return true
  }
}

const pickRandom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

function ReelTile({ game }: { game: Game }): React.JSX.Element {
  const art = posterUrl(game) ?? coverUrl(game)
  return (
    <div className="reel-tile" style={{ background: gameGradient(game.title) }}>
      {art ? (
        <img src={art} alt="" draggable={false} />
      ) : (
        <>
          <GameIconArt game={game} className="reel-icon" fallback={null} />
          <span className="reel-title">{game.title}</span>
        </>
      )}
    </div>
  )
}

interface PickGameModalProps {
  games: Game[]
  onClose: () => void
  onSelect: (game: Game) => void
}

// "Hôm nay chơi gì?": cuộn ảnh bìa như máy quay số rồi dừng ở một game ngẫu nhiên
export function PickGameModal({ games, onClose, onSelect }: PickGameModalProps): React.JSX.Element {
  const { launch } = useLauncher()
  const [filter, setFilter] = useState<PickFilter>('all')
  const [reel, setReel] = useState<Game[]>([])
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle')
  const frameRef = useRef(0)
  const now = useNow(60_000)

  const pool = useMemo(() => games.filter((g) => matches(g, filter, now)), [games, filter, now])

  const winner = phase === 'done' ? reel[reel.length - 1] : null

  const spin = useCallback((list: Game[]) => {
    if (list.length === 0) return
    const result = pickRandom(list)
    const nextReel = [...Array.from({ length: REEL_LENGTH }, () => pickRandom(list)), result]
    // Đặt cuộn về đầu (không hiệu ứng), khung hình sau mới cuộn tới game trúng
    setReel(nextReel)
    setOffset(0)
    setPhase('spinning')
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        setOffset((nextReel.length - 1) * TILE_H)
      })
    })
  }, [])

  // Mở hộp thoại là quay luôn
  useEffect(() => {
    const frame = requestAnimationFrame(() => spin(games))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      cancelAnimationFrame(frameRef.current)
    }
  }, [onClose])

  const changeFilter = (next: PickFilter): void => {
    setFilter(next)
    spin(games.filter((g) => matches(g, next, now)))
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal pick-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Hôm nay chơi gì?</h2>
          <button className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body pick-body">
          <div className="pick-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`genre-pill ${filter === f.key ? 'active' : ''}`}
                disabled={phase === 'spinning'}
                onClick={() => changeFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {pool.length === 0 ? (
            <p className="pick-empty">Không có game nào phù hợp bộ lọc này.</p>
          ) : (
            <div className="reel-window" style={{ height: WINDOW_H }}>
              <div
                className="reel-strip"
                style={{
                  transform: `translateY(${(WINDOW_H - TILE_H) / 2 - offset}px)`,
                  transition:
                    offset === 0 ? 'none' : `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.2, 1)`
                }}
                onTransitionEnd={() => setPhase('done')}
              >
                {reel.map((g, i) => (
                  <ReelTile key={i} game={g} />
                ))}
              </div>
            </div>
          )}

          <div className={`pick-result ${winner ? 'visible' : ''}`}>
            {winner && (
              <>
                <strong>{winner.title}</strong>
                <span>
                  {formatPlaytime(winner.total_playtime)}
                  {winner.last_played && ` · chơi lần cuối ${formatRelative(winner.last_played)}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-ghost footer-left"
            disabled={phase === 'spinning' || pool.length === 0}
            onClick={() => spin(pool)}
          >
            <ShuffleIcon width={16} height={16} /> Quay lại
          </button>
          <button
            className="btn btn-secondary"
            disabled={!winner}
            onClick={() => winner && onSelect(winner)}
          >
            Xem game
          </button>
          <button
            className="btn btn-primary"
            disabled={!winner}
            onClick={() => {
              if (!winner) return
              launch(winner)
              onClose()
            }}
          >
            <PlayIcon width={16} height={16} /> Chơi ngay
          </button>
        </div>
      </div>
    </div>
  )
}
