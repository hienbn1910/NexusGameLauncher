import { useCallback, useEffect, useMemo, useState } from 'react'
import { AddGameModal } from './components/AddGameModal'
import { Sidebar, type PageKey } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { TopBar } from './components/TopBar'
import { HomePage } from './pages/HomePage'

const PAGE_TITLES: Record<PageKey, string> = {
  home: 'Trang chủ',
  catalogue: 'Kho game',
  downloads: 'Tải xuống',
  settings: 'Cài đặt'
}

function App(): React.JSX.Element {
  const [games, setGames] = useState<Game[]>([])
  const [page, setPage] = useState<PageKey>('home')
  const [search, setSearch] = useState('')
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const [showAddGame, setShowAddGame] = useState(false)

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

  const searchedGames = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return games
    return games.filter((g) => g.title.toLowerCase().includes(keyword))
  }, [games, search])

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

  const closeAddGame = useCallback(() => setShowAddGame(false), [])

  const handleGameCreated = (game: Game): void => {
    // Giữ danh sách sắp xếp theo tên giống query trong DB
    setGames((prev) => [...prev, game].sort((a, b) => a.title.localeCompare(b.title)))
    setShowAddGame(false)
    selectGame(game)
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        games={games}
        selectedGameId={featuredId}
        onSelectGame={selectGame}
        onAddGame={() => setShowAddGame(true)}
      />

      <main className="main">
        <TopBar title={PAGE_TITLES[page]} search={search} onSearchChange={setSearch} />
        <div className="content">
          {page === 'home' ? (
            <HomePage
              games={searchedGames}
              featured={search ? null : featured}
              onShuffle={shuffleFeatured}
              onSelectGame={selectGame}
              onAddGame={() => setShowAddGame(true)}
            />
          ) : (
            <div className="empty-state">
              <h2>{PAGE_TITLES[page]}</h2>
              <p>Trang này đang được phát triển.</p>
            </div>
          )}
        </div>
      </main>

      <StatusBar gameCount={games.length} />

      {showAddGame && <AddGameModal onClose={closeAddGame} onCreated={handleGameCreated} />}
    </div>
  )
}

export default App
