import { useEffect, useState } from 'react'
import { FollowGameModal } from './FollowGameModal'
import { PlusIcon } from './Icons'
import { NewsCard } from './NewsCard'
import { Shelf } from './Shelf'

interface NewsSectionProps {
  games: Game[]
  // Tin của game trong thư viện (để gắn nhãn "Có cập nhật" lên ảnh bìa)
  onLibraryNews: (items: NewsItem[]) => void
  onOpenSettings: () => void
}

const TABS: { key: NewsTab; label: string }[] = [
  { key: 'sites', label: 'Tin game' },
  { key: 'library', label: 'Game của bạn' },
  { key: 'following', label: 'Đang theo dõi' }
]

const EMPTY_TEXT: Record<NewsTab, string> = {
  library: 'Chưa có tin mới nào về các game trong thư viện.',
  following: 'Bạn chưa theo dõi game nào. Theo dõi để xem tin của game không có trong thư viện.',
  sites: 'Chưa bật trang báo game nào.'
}

const timeOf = (ms: number): string =>
  new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

// Tin tức game: 3 tab, đọc RSS ở main process (Steam / Google News / trang báo)
export function NewsSection({
  games,
  onLibraryNews,
  onOpenSettings
}: NewsSectionProps): React.JSX.Element {
  const api = window.electronAPI.news
  const [tab, setTab] = useState<NewsTab>(TABS[0].key)
  const [results, setResults] = useState<Partial<Record<NewsTab, NewsResult>>>({})
  const [errors, setErrors] = useState<Partial<Record<NewsTab, string>>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [showFollow, setShowFollow] = useState(false)
  // Tải lại tab "Game của bạn" khi thêm/xoá game hoặc vừa tìm được Steam App ID
  const libraryKey = games.map((g) => `${g.id}:${g.steam_app_id ?? ''}`).join('|')

  const apply = (which: NewsTab, result: ApiResult<NewsResult>): void => {
    if (result.ok) {
      setResults((prev) => ({ ...prev, [which]: result.data }))
      setErrors((prev) => ({ ...prev, [which]: undefined }))
      if (which === 'library') onLibraryNews(result.data.items)
    } else {
      setErrors((prev) => ({ ...prev, [which]: result.error }))
    }
  }

  const load = (which: NewsTab): (() => void) => {
    let cancelled = false
    api.get(which).then((result) => {
      if (!cancelled) apply(which, result)
    })
    return () => {
      cancelled = true
    }
  }

  // Tin của game trong thư viện luôn được tải (kể cả khi đang xem tab khác)
  // để gắn nhãn "Có cập nhật" lên ảnh bìa
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load('library'), [libraryKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => (tab === 'library' ? undefined : load(tab)), [tab])

  const refresh = async (which = tab, force = true): Promise<void> => {
    setRefreshing(true)
    apply(which, await api.get(which, force))
    setRefreshing(false)
  }

  const result = results[tab]
  const error = errors[tab]
  const byId = new Map(games.map((g) => [g.id, g]))

  const status = (): React.ReactNode => {
    if (error) return <span className="news-status warn">Không tải được tin: {error}</span>
    if (!result) return null
    const parts: React.ReactNode[] = []
    if (result.steamBlocked && tab !== 'sites') {
      parts.push(
        <span key="blocked" className="news-status warn">
          Không vào được Steam, đang hiện tin từ báo chí.{' '}
          <button className="link-button" onClick={onOpenSettings}>
            Cài đặt mạng
          </button>
        </span>
      )
    } else if (result.stale && result.updatedAt) {
      parts.push(
        <span key="stale" className="news-status warn">
          Không tải được tin mới, đang hiện tin lúc {timeOf(result.updatedAt)}.
        </span>
      )
    }
    if (result.updatedAt && !result.stale) {
      parts.push(
        <span key="time" className="news-status">
          Cập nhật lúc {timeOf(result.updatedAt)}
        </span>
      )
    }
    return parts.length > 0 ? parts : null
  }

  const tools = (
    <>
      <div className="segmented news-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'following' && (
        <button className="chip chip-accent" onClick={() => setShowFollow(true)}>
          <PlusIcon /> Theo dõi game
        </button>
      )}
      <button
        className="icon-button news-refresh"
        title="Làm mới"
        disabled={refreshing}
        onClick={() => refresh()}
      >
        <span className={refreshing ? 'spinning' : ''}>⟳</span>
      </button>
    </>
  )

  return (
    <>
      <Shelf title="Tin tức game" action={tools} subtitle={status()}>
        {!result &&
          !error &&
          // Khung chờ trong lúc tải lần đầu
          [0, 1, 2].map((i) => <div key={i} className="news-card news-skeleton" />)}

        {result?.items.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            game={item.gameId ? byId.get(item.gameId) : undefined}
          />
        ))}

        {result && result.items.length === 0 && (
          <div className="shelf-empty news-empty">
            <p>{EMPTY_TEXT[tab]}</p>
            {tab === 'following' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowFollow(true)}>
                <PlusIcon width={14} height={14} /> Theo dõi game
              </button>
            )}
            {tab === 'sites' && (
              <button className="btn btn-secondary btn-sm" onClick={onOpenSettings}>
                Chọn trang báo trong Cài đặt
              </button>
            )}
          </div>
        )}
      </Shelf>

      {showFollow && (
        <FollowGameModal
          onClose={() => setShowFollow(false)}
          onChanged={() => void refresh('following', false)}
        />
      )}
    </>
  )
}
