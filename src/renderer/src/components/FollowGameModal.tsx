import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon, SearchIcon, XIcon } from './Icons'

interface FollowGameModalProps {
  onClose: () => void
  // Danh sách theo dõi vừa thay đổi
  onChanged: (list: FollowedGame[]) => void
}

type Lookup =
  | { term: string; status: 'searching' }
  | { term: string; status: 'done'; match: SteamAppMatch | null }

// Theo dõi tin tức của game không có trong thư viện (tìm trên Steam, không có thì theo dõi qua báo chí)
export function FollowGameModal({ onClose, onChanged }: FollowGameModalProps): React.JSX.Element {
  const api = window.electronAPI.news
  const [following, setFollowing] = useState<FollowedGame[]>([])
  const [suggestions, setSuggestions] = useState<FollowedGame[]>([])
  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<Lookup | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getFollowing().then(setFollowing)
    api.getSuggestions().then(setSuggestions)
  }, [api])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Gõ xong (nghỉ 500ms) thì tìm game trên Steam
  const term = query.trim()
  useEffect(() => {
    if (term.length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLookup({ term, status: 'searching' })
      window.electronAPI.games.findSteamApp(term).then((match) => {
        if (!cancelled) setLookup({ term, status: 'done', match })
      })
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term])

  const current = lookup?.term === term ? lookup : null

  const update = (list: FollowedGame[]): void => {
    setFollowing(list)
    onChanged(list)
  }

  const add = async (name: string, appId: string | null): Promise<void> => {
    setError(null)
    const result = await api.follow(name, appId)
    if (!result.ok) return setError(result.error)
    update(result.data)
    setQuery('')
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!term) return
    const match = current?.status === 'done' ? current.match : null
    void add(match?.name ?? term, match?.appId ?? null)
  }

  const followedIds = new Set(following.map((g) => g.id))
  const followedNames = new Set(following.map((g) => g.name.toLowerCase()))
  const freeSuggestions = suggestions.filter(
    (s) => !followedIds.has(s.id) && !followedNames.has(s.name.toLowerCase())
  )

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal follow-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Theo dõi tin tức game</h2>
          <button className="icon-button" onClick={onClose} title="Đóng">
            <XIcon />
          </button>
        </div>

        <div className="modal-body">
          <form className="sgdb-search" onSubmit={submit}>
            <label className="filter-search">
              <SearchIcon width={16} height={16} />
              <input
                autoFocus
                placeholder="Tên game, vd: Elden Ring, Valorant..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={!term}>
              <PlusIcon width={16} height={16} /> Theo dõi
            </button>
          </form>

          {term.length >= 2 && (
            <p className="field-hint follow-lookup">
              {!current || current.status === 'searching' ? (
                'Đang tìm trên Steam...'
              ) : current.match ? (
                <>
                  ✓ Có trên Steam: <strong>{current.match.name}</strong> · lấy thông báo chính thức
                  từ Steam
                </>
              ) : (
                'Không có trên Steam · sẽ lấy tin từ báo chí (Google News) theo tên game'
              )}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}

          {freeSuggestions.length > 0 && (
            <div className="follow-group">
              <span className="field-label">Gợi ý</span>
              <div className="follow-chips">
                {freeSuggestions.map((s) => (
                  <button key={s.id} className="genre-pill" onClick={() => add(s.name, s.appId)}>
                    <PlusIcon width={12} height={12} /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="follow-group">
            <span className="field-label">Đang theo dõi ({following.length})</span>
            {following.length === 0 ? (
              <p className="field-hint">Chưa theo dõi game nào.</p>
            ) : (
              <div className="follow-chips">
                {following.map((g) => (
                  <span key={g.id} className="follow-chip">
                    {g.name}
                    <small>{g.appId ? 'Steam' : 'Báo chí'}</small>
                    <button title="Bỏ theo dõi" onClick={() => api.unfollow(g.id).then(update)}>
                      <XIcon width={12} height={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
