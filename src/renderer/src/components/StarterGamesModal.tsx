import { useEffect, useState } from 'react'
import { gameGradient, gameInitials } from '../utils/gameArt'
import { SaveIcon, XIcon } from './Icons'

interface StarterGamesModalProps {
  onClose: () => void
  onAdded: (games: Game[]) => void
}

const STATUS_LABEL: Record<CatalogStatus, string> = {
  installed: 'Đã cài trên máy',
  available: 'Cài qua',
  missing: 'Chưa tìm thấy'
}

// Ảnh dọc của game Steam (game khác dùng chữ viết tắt trên nền gradient)
const steamPoster = (appId: string): string =>
  `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`

function CatalogCard({
  item,
  checked,
  onToggle
}: {
  item: CatalogItem
  checked: boolean
  onToggle: () => void
}): React.JSX.Element {
  const [failedArt, setFailedArt] = useState(false)
  const art = item.steamAppId && !failedArt ? steamPoster(item.steamAppId) : null
  const status =
    item.status === 'available' && item.via
      ? `${STATUS_LABEL.available} ${item.via}`
      : STATUS_LABEL[item.status]

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={item.inLibrary}
      className={`starter-card ${checked ? 'checked' : ''} ${item.inLibrary ? 'in-library' : ''}`}
      onClick={onToggle}
    >
      <span className="starter-art" style={{ background: gameGradient(item.title) }}>
        {art ? (
          <img src={art} alt="" draggable={false} onError={() => setFailedArt(true)} />
        ) : (
          <span className="starter-initials">{gameInitials(item.title)}</span>
        )}
        <span className="starter-check" aria-hidden>
          {(checked || item.inLibrary) && <SaveIcon width={14} height={14} />}
        </span>
      </span>
      <span className="starter-title">{item.title}</span>
      <span className={`starter-status ${item.status}`}>
        {item.inLibrary ? 'Đã có trong thư viện' : status}
      </span>
    </button>
  )
}

// Lần đầu mở app (sau khi nhập tên): chọn nhanh vài game phổ biến để thêm vào thư viện.
// Game tìm thấy trên máy được chọn sẵn và chơi được ngay; game chưa thấy sẽ hỏi file chạy khi bấm Chơi
export function StarterGamesModal({ onClose, onAdded }: StarterGamesModalProps): React.JSX.Element {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    window.electronAPI.games.getCatalog().then((list) => {
      setItems(list)
      setSelected(
        new Set(list.filter((i) => i.status === 'installed' && !i.inLibrary).map((i) => i.id))
      )
    })
  }, [])

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const add = async (): Promise<void> => {
    if (selected.size === 0 || adding) return
    setAdding(true)
    const added = await window.electronAPI.games.addFromCatalog([...selected])
    onAdded(added)
  }

  const installed = items?.filter((i) => i.status === 'installed').length ?? 0
  const unlinked = items?.filter((i) => selected.has(i.id) && i.status === 'missing').length ?? 0

  return (
    <div className="modal-overlay">
      <div className="modal starter-modal" role="dialog" aria-labelledby="starter-title">
        <div className="modal-header">
          <div>
            <h2 id="starter-title">Thêm game phổ biến</h2>
            <p className="starter-subtitle">
              {items === null
                ? 'Đang tìm game trên máy...'
                : installed > 0
                  ? `Tìm thấy ${installed} game trên máy, đã chọn sẵn. Chọn thêm game bạn muốn chơi.`
                  : 'Chọn game bạn muốn có trong thư viện. Bạn có thể thêm game khác sau.'}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="starter-grid">
            {items === null
              ? Array.from({ length: 10 }, (_, i) => <span key={i} className="starter-skeleton" />)
              : items.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    checked={selected.has(item.id)}
                    onToggle={() => toggle(item.id)}
                  />
                ))}
          </div>
          {unlinked > 0 && (
            <p className="field-hint">
              {unlinked} game chưa tìm thấy trên máy: khi bấm Chơi, Nexus sẽ tìm lại, không thấy thì
              hỏi bạn chọn file chạy.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Bỏ qua
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.size === 0 || adding}
            onClick={add}
          >
            {adding ? 'Đang thêm...' : `Thêm ${selected.size} game`}
          </button>
        </div>
      </div>
    </div>
  )
}
