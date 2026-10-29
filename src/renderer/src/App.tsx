import { useCallback, useEffect, useState } from 'react'
import { GameFormModal } from './components/GameFormModal'
import { ProfileModal } from './components/ProfileModal'
import { WatchDirSuggestionCard } from './components/WatchDirSuggestionCard'
import { Sidebar, type PageKey } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { Toast, type ToastMessage } from './components/Toast'
import { TopBar } from './components/TopBar'
import { LauncherContext } from './hooks/useLauncher'
import { CataloguePage } from './pages/CataloguePage'
import { HomePage } from './pages/HomePage'
import { GameDetailPage } from './pages/GameDetailPage'
import { SettingsPage } from './pages/SettingsPage'
import { withViewTransition } from './utils/viewTransition'

const PAGE_TITLES: Record<PageKey, string> = {
  home: 'Trang chủ',
  catalogue: 'Kho game',
  downloads: 'Tải xuống',
  settings: 'Cài đặt',
  game: 'Chi tiết game'
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
  // Mở form ở bước xác nhận xoá (từ menu chuột phải / trang chi tiết)
  const [formDelete, setFormDelete] = useState(false)
  // Trang chi tiết game: id game đang xem + trang trước đó để quay lại
  const [detailId, setDetailId] = useState<string | null>(null)
  const [backPage, setBackPage] = useState<PageKey>('home')
  const [runningIds, setRunningIds] = useState<Map<string, RunningInfo>>(new Map())
  // Gợi ý thư mục game đang hiện (launcher sinh ra exe ở thư mục lạ)
  const [suggestion, setSuggestion] = useState<WatchDirSuggestion | null>(null)
  const [stats, setStats] = useState<PlayStats | null>(null)
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editingProfile, setEditingProfile] = useState(false)

  useEffect(() => {
    window.electronAPI.profile.get().then(setProfile)
  }, [])

  useEffect(() => {
    window.electronAPI.games.getAll().then((list) => {
      setGames(list)
      // Mặc định: game chơi gần nhất, nếu chưa có thì game đầu tiên
      const recent = [...list]
        .filter((g) => g.last_played)
        .sort((a, b) => (b.last_played ?? '').localeCompare(a.last_played ?? ''))[0]
      setFeaturedId((recent ?? list[0])?.id ?? null)
    })
    // Lấy lại danh sách game đang chạy (vd sau khi reload cửa sổ)
    window.electronAPI.games
      .getRunning()
      .then((list) =>
        setRunningIds(
          new Map(list.map((s) => [s.gameId, { phase: s.phase, startedAt: s.startedAt }]))
        )
      )
    window.electronAPI.games.getStats().then(setStats)
  }, [])

  // Nhận sự kiện game bắt đầu/thoát từ main process
  useEffect(() => {
    return window.electronAPI.games.onSessionChanged((event) => {
      const { gameId, running, game } = event
      setRunningIds((prev) => {
        const next = new Map(prev)
        if (running) {
          next.set(gameId, { phase: event.phase ?? 'playing', startedAt: event.startedAt ?? null })
        } else {
          next.delete(gameId)
        }
        return next
      })
      if (game) setGames((prev) => prev.map((g) => (g.id === game.id ? game : g)))
      // Phiên chơi vừa kết thúc => cập nhật thống kê
      if (!running) window.electronAPI.games.getStats().then(setStats)
    })
  }, [])

  // Launcher sinh ra exe ở thư mục lạ => hỏi người dùng có dùng làm thư mục game không
  useEffect(() => {
    return window.electronAPI.games.onWatchDirSuggestion(setSuggestion)
  }, [])

  const answerSuggestion = async (accept: boolean): Promise<void> => {
    if (!suggestion) return
    setSuggestion(null)
    const { gameId, dir } = suggestion
    if (!accept) return window.electronAPI.games.dismissWatchDir(gameId, dir)
    const updated = await window.electronAPI.games.acceptWatchDir(gameId, dir)
    if (updated) {
      setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
      showToast('info', `Đã lưu thư mục game cho ${updated.title}`)
    }
  }

  // Main process tự lấy được ảnh bìa (Steam) cho game
  useEffect(() => {
    return window.electronAPI.games.onUpdated((game) => {
      setGames((prev) => prev.map((g) => (g.id === game.id ? game : g)))
    })
  }, [])

  const showToast = (type: ToastMessage['type'], text: string): void => {
    setToast({ id: Date.now(), type, text })
  }
  const dismissToast = useCallback(() => setToast(null), [])

  const launch = async (game: Game): Promise<void> => {
    if (launchingId) return
    setLaunchingId(game.id)
    try {
      const result = await window.electronAPI.games.launch(game.id)
      if (result.ok) {
        replaceGame(result.game)
        if (result.game.source === 'steam') showToast('info', `Đang mở ${game.title} qua Steam...`)
      } else {
        showToast('error', result.error)
      }
    } finally {
      setLaunchingId(null)
    }
  }

  const featured = games.find((g) => g.id === featuredId) ?? null

  // Đổi game trên banner (tự xoay vòng / bấm ảnh nhỏ) mà không đổi trang
  const featureGame = useCallback((game: Game) => setFeaturedId(game.id), [])

  // Mở trang chi tiết game. Từ trang khác: ảnh nhỏ ở sidebar "bay" thành ảnh lớn (View Transition);
  // đang ở trang chi tiết: ảnh game cũ chuyển mượt sang ảnh game mới
  const selectGame = useCallback(
    (game: Game): void => {
      const fromOtherPage = page !== 'game'
      withViewTransition(
        () => {
          if (fromOtherPage) setBackPage(page)
          setDetailId(game.id)
          setPage('game')
          document.querySelector('.content')?.scrollTo({ top: 0 })
        },
        () => {
          if (!fromOtherPage) return
          const thumb = document.querySelector<HTMLElement>(`[data-game-thumb="${game.id}"]`)
          if (!thumb) return
          thumb.style.viewTransitionName = 'game-hero-art'
          return () => {
            thumb.style.viewTransitionName = ''
          }
        }
      )
    },
    [page]
  )

  const leaveDetail = (): void => {
    withViewTransition(() => setPage(backPage === 'game' ? 'home' : backPage))
  }

  // Gõ tìm kiếm ở topbar thì chuyển sang Kho game để xem kết quả
  const handleSearchChange = (value: string): void => {
    setSearch(value)
    if (value && page !== 'catalogue') setPage('catalogue')
  }

  const openForm = (game: Game, startWithDelete = false): void => {
    setFormDelete(startWithDelete)
    setForm(game)
  }

  const openFolder = async (game: Game): Promise<void> => {
    const error = await window.electronAPI.games.openFolder(game.id)
    if (error) showToast('error', error)
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
  const closeProfile = useCallback(() => setEditingProfile(false), [])

  const handleProfileSaved = (saved: UserProfile): void => {
    setProfile(saved)
    setEditingProfile(false)
  }

  // Lần đầu mở app => hỏi tên; sau đó chỉ mở khi người dùng muốn sửa hồ sơ
  const profileMode = profile && !profile.onboarded ? 'welcome' : editingProfile ? 'edit' : null

  const handleSaved = (saved: Game): void => {
    if (form === 'new') {
      setGames((prev) => [...prev, saved].sort(byTitle))
      selectGame(saved)
    } else {
      replaceGame(saved)
    }
    setForm(null)
    // Ảnh Steam có thể đã được lấy xong trong lúc form đang lưu => đọc lại từ DB cho chắc
    window.electronAPI.games.getById(saved.id).then((fresh) => fresh && replaceGame(fresh))
  }

  const handleDeleted = (id: string): void => {
    const remaining = games.filter((g) => g.id !== id)
    setGames(remaining)
    if (featuredId === id) setFeaturedId(remaining[0]?.id ?? null)
    // Đang xem trang của game vừa xoá => quay lại trang trước
    if (page === 'game' && detailId === id) setPage(backPage === 'game' ? 'home' : backPage)
    setForm(null)
  }

  const openAddForm = (): void => {
    setFormDelete(false)
    setForm('new')
  }

  const detailGame = page === 'game' ? games.find((g) => g.id === detailId) : undefined

  const titlesIn = (phase: SessionPhase): string[] =>
    games.filter((g) => runningIds.get(g.id)?.phase === phase).map((g) => g.title)

  return (
    <LauncherContext.Provider value={{ runningIds, launchingId, launch }}>
      <div className="app-shell">
        <Sidebar
          page={page}
          onNavigate={setPage}
          games={games}
          selectedGameId={detailGame?.id ?? null}
          onSelectGame={selectGame}
          onAddGame={openAddForm}
          onEditGame={(g) => openForm(g)}
          onDeleteGame={(g) => openForm(g, true)}
          onToggleFavorite={toggleFavorite}
          onOpenFolder={openFolder}
          profile={profile}
          onEditProfile={() => setEditingProfile(true)}
        />

        <main className="main">
          <TopBar
            title={detailGame?.title ?? PAGE_TITLES[page]}
            search={search}
            onSearchChange={handleSearchChange}
            showSearch={page !== 'catalogue'}
          />
          <div className="content">
            {page === 'home' && (
              <HomePage
                games={games}
                featured={featured}
                stats={stats}
                onFeature={featureGame}
                onOpenSettings={() => setPage('settings')}
                onSelectGame={selectGame}
                onAddGame={openAddForm}
                onEditGame={(g) => openForm(g)}
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
                onEditGame={(g) => openForm(g)}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {detailGame && (
              <GameDetailPage
                game={detailGame}
                games={games}
                onBack={leaveDetail}
                onNavigate={selectGame}
                onEdit={(g) => openForm(g)}
                onDelete={(g) => openForm(g, true)}
                onToggleFavorite={toggleFavorite}
                onGameUpdated={replaceGame}
                onNotify={showToast}
              />
            )}
            {page === 'game' && !detailGame && (
              <div className="empty-state">
                <h2>Không tìm thấy game</h2>
                <button className="btn btn-primary" onClick={() => setPage('home')}>
                  Về trang chủ
                </button>
              </div>
            )}
            {page === 'settings' && (
              <SettingsPage profile={profile} onEditProfile={() => setEditingProfile(true)} />
            )}
            {page === 'downloads' && (
              <div className="empty-state">
                <h2>{PAGE_TITLES[page]}</h2>
                <p>Trang này đang được phát triển.</p>
              </div>
            )}
          </div>
        </main>

        <StatusBar
          gameCount={games.length}
          playingTitles={titlesIn('playing')}
          openTitles={titlesIn('launcher')}
        />

        {form && (
          <GameFormModal
            // key để reset state khi chuyển từ sửa game này sang game khác
            key={form === 'new' ? 'new' : form.id}
            game={form === 'new' ? undefined : form}
            startWithDelete={formDelete}
            onClose={closeForm}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}

        {profile && profileMode && (
          <ProfileModal
            key={profileMode}
            profile={profile}
            mode={profileMode}
            onClose={closeProfile}
            onSaved={handleProfileSaved}
          />
        )}

        {suggestion && (
          <WatchDirSuggestionCard
            key={`${suggestion.gameId}:${suggestion.dir}`}
            suggestion={suggestion}
            onAnswer={answerSuggestion}
            onClose={() => setSuggestion(null)}
          />
        )}

        {toast && <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />}
      </div>
    </LauncherContext.Provider>
  )
}

export default App
