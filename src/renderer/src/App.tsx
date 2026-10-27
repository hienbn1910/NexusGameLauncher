import { useCallback, useEffect, useState } from 'react'
import { GameFormModal } from './components/GameFormModal'
import { Sidebar, type PageKey } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { TopBar } from './components/TopBar'
import { CataloguePage } from './pages/CataloguePage'
import { HomePage } from './pages/HomePage'

const PAGE_TITLES: Record<PageKey, string> = {
  home: 'Trang chủ',
  catalogue: 'Kho game',
  downloads: 'Tải xuống',
  settings: 'Cài đặt'
}

// null = đóng, 'new' = thêm game, Game = sửa game đó
type FormState = null | 'new' | Game

const byTitle = (a: Game, b: Game): number => a.title.localeCompare(b.title)

function App(): React.JSX.Element {
  const [games, setGames] = useState<Game[]>([])
  const [page, setPage] = useState<PageKey>('home')
  const [search, setSearch] = useState('')
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(null)

  useEffect(() => {
    window.electronAPI.games.getAll().then((list) => {
      setGames(list)
      // Mặc định: game chơi gần nhất, nếu chưa có thì game đầu tiên
      const recent = [...list]
        .filter((g) => g.last_played)
        .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))[0]
      setFeaturedId((recent ?? list[0])?.id ?? null)
    })
  }, [])

  const featured = games.find((g) => g.id === featuredId) ?? null

  const shuffleFeatured = useCallback(() => {
    if (games.length === 0) return
    const others = games.filter((g) => g.id !== featuredId)
    const pool = others.length > 0 ? others : games
    setFeaturedId(pool[Math.floor(Math.random() * pool.length)].id)
  }, [games, featuredId])

  const selectGame = (game: Game): void => {
    setFeaturedId(game.id)
    setPage('home')
  }

  // Gõ tìm kiếm ở topbar thì chuyển sang Kho game để xem kết quả
  const handleSearchChange = (value: string): void => {
    setSearch(value)
    if (value && page !== 'catalogue') setPage('catalogue')
  }

  const replaceGame = (updated: Game): void => {
    setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)).sort(byTitle))
  }

  const toggleFavorite = async (game: Game): Promise<void> => {
    const updated = await window.electronAPI.games.update(game.id, {
      is_favorite: game.is_favorite !== 1
    })
    if (updated) replaceGame(updated)
  }

  const closeForm = useCallback(() => setForm(null), [])

  const handleSaved = (saved: Game): void => {
    if (form === 'new') {
      setGames((prev) => [...prev, saved].sort(byTitle))
      selectGame(saved)
    } else {
      replaceGame(saved)
    }
    setForm(null)
  }

  const handleDeleted = (id: string): void => {
    const remaining = games.filter((g) => g.id !== id)
    setGames(remaining)
    if (featuredId === id) setFeaturedId(remaining[0]?.id ?? null)
    setForm(null)
  }

  const openAddForm = (): void => setForm('new')

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        games={games}
        selectedGameId={featuredId}
        onSelectGame={selectGame}
        onAddGame={openAddForm}
      />

      <main className="main">
        <TopBar
          title={PAGE_TITLES[page]}
          search={search}
          onSearchChange={handleSearchChange}
          showSearch={page !== 'catalogue'}
        />
        <div className="content">
          {page === 'home' && (
            <HomePage
              games={games}
              featured={featured}
              onShuffle={shuffleFeatured}
              onSelectGame={selectGame}
              onAddGame={openAddForm}
              onEditGame={setForm}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {page === 'catalogue' && (
            <CataloguePage
              games={games}
              search={search}
              onSearchChange={setSearch}
              onSelectGame={selectGame}
              onAddGame={openAddForm}
              onEditGame={setForm}
              onToggleFavorite={toggleFavorite}
            />
          )}
          {(page === 'downloads' || page === 'settings') && (
            <div className="empty-state">
              <h2>{PAGE_TITLES[page]}</h2>
              <p>Trang này đang được phát triển.</p>
            </div>
          )}
        </div>
      </main>

      <StatusBar gameCount={games.length} />

      {form && (
        <GameFormModal
          // key để reset state khi chuyển từ sửa game này sang game khác
          key={form === 'new' ? 'new' : form.id}
          game={form === 'new' ? undefined : form}
          onClose={closeForm}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}

export default App
