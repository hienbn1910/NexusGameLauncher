import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '../Icons'

interface MediaTabProps {
  details: SteamDetailsResult | undefined
  appId: string | null
}

// Xem ảnh lớn, chuyển ảnh bằng ← →, Esc để đóng
function Lightbox({
  images,
  index,
  onChange,
  onClose
}: {
  images: { full: string }[]
  index: number
  onChange: (i: number) => void
  onClose: () => void
}): React.JSX.Element {
  const go = useCallback(
    (delta: number) => onChange((index + delta + images.length) % images.length),
    [index, images.length, onChange]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else return
      // Không để phím mũi tên chuyển sang game khác ở trang chi tiết
      e.stopPropagation()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [go, onClose])

  return createPortal(
    <div className="lightbox" onMouseDown={onClose}>
      <img src={images[index].full} alt="" onMouseDown={(e) => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose} title="Đóng (Esc)">
        <XIcon />
      </button>
      {images.length > 1 && (
        <>
          <button
            className="lightbox-nav prev"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            className="lightbox-nav next"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => go(1)}
          >
            ›
          </button>
          <span className="lightbox-count">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>,
    document.body
  )
}

export function MediaTab({ details, appId }: MediaTabProps): React.JSX.Element {
  const [viewing, setViewing] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewing(null), [])

  if (!appId) {
    return <p className="detail-muted">Ảnh và video chỉ có với game phát hành trên Steam.</p>
  }
  if (details === undefined) return <p className="detail-muted">Đang tải ảnh & video...</p>
  const steam = details.details
  if (!steam) return <p className="detail-muted">{details.error ?? 'Không có ảnh & video.'}</p>

  return (
    <div className="detail-media">
      {steam.movies.length > 0 && (
        <section>
          <h3 className="detail-section-title">Video</h3>
          <div className="media-videos">
            {steam.movies.map((m) =>
              m.src ? (
                <figure key={m.thumb} className="media-video">
                  <video src={m.src} poster={m.thumb} controls preload="none" />
                  <figcaption>{m.name}</figcaption>
                </figure>
              ) : (
                // Trailer chỉ có dạng HLS/DASH => mở trên Steam
                <a
                  key={m.thumb}
                  className="media-video link"
                  href={`https://store.steampowered.com/app/${appId}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={m.thumb} alt="" loading="lazy" />
                  <span className="media-play">▶ Xem trên Steam</span>
                  <figcaption>{m.name}</figcaption>
                </a>
              )
            )}
          </div>
        </section>
      )}

      {steam.screenshots.length > 0 && (
        <section>
          <h3 className="detail-section-title">Ảnh chụp màn hình</h3>
          <div className="media-screens">
            {steam.screenshots.map((s, i) => (
              <button key={s.thumb} className="media-screen" onClick={() => setViewing(i)}>
                <img src={s.thumb} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        </section>
      )}

      {steam.movies.length === 0 && steam.screenshots.length === 0 && (
        <p className="detail-muted">Steam không có ảnh hay video cho game này.</p>
      )}

      {viewing !== null && (
        <Lightbox
          images={steam.screenshots}
          index={viewing}
          onChange={setViewing}
          onClose={closeViewer}
        />
      )}
    </div>
  )
}
