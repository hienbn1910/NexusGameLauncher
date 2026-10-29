import type { ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { basename, dirname, extname, isAbsolute, parse, resolve, sep } from 'path'
import { app, BrowserWindow } from 'electron'
import * as gameService from './game.service'
import type { Game } from './game.service'
import { processExePaths } from './exe-icon.service'
import { getInstallDir } from './game-files.service'
import { collectExeNames, listProcesses } from './process.service'
import type { ProcessInfo } from './process.service'
import { getSetting, setSetting } from './settings.service'
import { isNativeAvailable } from './win-process'

// Theo dõi giờ chơi theo thư mục:
// - Thư mục game (người dùng chọn + thư mục exe tiến trình cũ): exe trong đó chạy => "Đang chơi",
//   chỉ lúc này mới đếm giờ
// - Thư mục launcher (thư mục chứa file Nexus mở): chỉ launcher chạy => "Đang mở", không đếm giờ
// - Game chưa có thư mục game riêng: mọi exe trong thư mục cài đều tính là đang chơi (như cũ)
// - Tự nhận game mở ngoài Nexus khi exe game chạy (có thể tắt trong Cài đặt)
// - Launcher sinh ra exe ở thư mục lạ chạy lâu => gợi ý người dùng dùng thư mục đó làm thư mục game
// Không mở handle tới tiến trình nào (xem win-process.ts) để không đụng anti-cheat của game.

export type SessionPhase = 'launcher' | 'playing'

export interface SessionEvent {
  gameId: string
  running: boolean
  phase?: SessionPhase
  game?: Game
  // Mốc để giao diện tính đồng hồ phiên chơi (đã trừ thời gian không chơi), chỉ có khi đang chơi
  startedAt?: number | null
}

export interface WatchDirSuggestion {
  gameId: string
  title: string
  dir: string
  exeName: string
}

const ACTIVE_POLL_MS = 5_000 // Đang có game chạy
const IDLE_POLL_MS = 15_000 // Không có game nào: chỉ dò game mở ngoài Nexus
// Số lần kiểm tra liên tiếp không thấy tiến trình thì coi như đã tắt
// (chừa thời gian cho khoảng trống giữa lúc launcher tắt và game bật lên)
const MISS_LIMIT = 4
// Bấm Chơi nhưng mãi không thấy gì chạy (game lỗi, người dùng tắt launcher...)
const NOT_SEEN_TIMEOUT_MS = 5 * 60_000
// Phiên ngắn hơn mức này (mở nhầm, game lỗi) không ghi vào lịch sử
export const MIN_SESSION_MS = 60_000
// Exe lạ do launcher sinh ra chạy liên tục lâu hơn mức này => gợi ý thư mục game
const SUGGEST_AFTER_MS = 60_000
const MAX_ANCESTRY_DEPTH = 8

const AUTO_DETECT_KEY = 'play_auto_detect'
const DISMISSED_KEY = 'watch_dir_dismissed'

// Tiến trình phụ không tính là đang chơi: báo lỗi, gỡ cài đặt, cập nhật, anti-cheat,
// và launcher của các nền tảng (thường chạy nền suốt ngày)
const IGNORED_PROCESS =
  /^(unitycrashhandler(32|64)?|crashpad_handler|crashreport\w*|\w*crashhandler\w*|unins\d*|uninstall\w*|\w*updater\w*|easyanticheat\w*|beservice\w*|battleye\w*|vc_?redist\S*|dxsetup|ue\dprereqsetup\S*|steam|steamservice|steamwebhelper|epicgameslauncher|epicwebhelper|riotclient\w*|battle\.net\w*|agent|origin\w*|eadesktop|eabackgroundservice|upc|ubisoftconnect|uplaywebcore|galaxyclient\w*|cefsharp\.browsersubprocess|qtwebengineprocess)\.exe$/i

// Tiến trình phụ của launcher (trình duyệt nhúng, tải, cập nhật...): không gợi ý làm game
const HELPER_PROCESS =
  /(cef|webhelper|webview|browser|chrome|electron|update|patch|download|install|setup|crash|report|helper|service|overlay|launcher|bootstrap|conhost|cmd|powershell|werfault|dllhost|rundll32|xigncode|xcoronahost|gameguard|nprotect|anticheat)/i

// ---------- Thư mục theo dõi ----------

const normalizeDir = (dir: string): string => {
  const full = resolve(dir).toLowerCase()
  return full.endsWith(sep) ? full : full + sep
}

// Thư mục dùng chung: không được làm thư mục theo dõi (sẽ tính nhầm mọi chương trình trong đó)
let commonDirs: string[] | null = null
function getCommonDirs(): string[] {
  if (commonDirs) return commonDirs
  const env = process.env
  const candidates = [
    env.SystemRoot,
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
    env.ProgramW6432,
    env.ProgramData,
    env.APPDATA,
    env.LOCALAPPDATA,
    homedir(),
    tmpdir(),
    dirname(process.execPath) // Thư mục của chính Nexus
  ]
  for (const name of ['desktop', 'documents', 'downloads'] as const) {
    try {
      candidates.push(app.getPath(name))
    } catch {
      // Hệ điều hành không có thư mục này
    }
  }
  commonDirs = candidates.filter((d): d is string => !!d).map(normalizeDir)
  return commonDirs
}

// null = dùng được, còn lại là lý do không dùng được
export function validateWatchDir(dir: string): string | null {
  if (!dir || !isAbsolute(dir) || !existsSync(dir)) return 'Thư mục không tồn tại'
  const norm = normalizeDir(dir)
  const tooBroad =
    normalizeDir(parse(norm).root) === norm ||
    /[\\/]steamapps([\\/]common)?[\\/]$/i.test(norm) ||
    // Thư mục chung, hoặc thư mục cha của thư mục chung (vd C:\Users)
    getCommonDirs().some((common) => common.startsWith(norm))
  return tooBroad
    ? 'Thư mục này quá chung (ổ đĩa, Program Files, Desktop, steamapps...). Hãy chọn đúng thư mục của game.'
    : null
}

type DirKind = 'game' | 'launcher'

interface Target {
  gameDirs: string[]
  launcherDirs: string[]
  // Có thư mục game riêng => phân biệt được launcher và game
  split: boolean
  // File Nexus mở (luôn là launcher khi split, kể cả khi nằm trong thư mục game)
  launcherExe: string | null
}

// Thư mục cài có thể đổi mà không qua form (vừa tìm được Steam App ID, game được cài lại...)
// => tính lại định kỳ
const TARGETS_TTL_MS = 5 * 60_000

let targets: Map<string, Target> | null = null
let targetsBuiltAt = 0
let targetsGeneration = 0
let building: Promise<Map<string, Target>> | null = null

const validDirs = (dirs: (string | null | undefined)[]): string[] => [
  ...new Set(dirs.filter((d): d is string => !!d && !validateWatchDir(d)).map(normalizeDir))
]

async function buildTarget(game: Game): Promise<Target> {
  const exePath = game.exe_path.trim()
  const isSteam = /^steam:\/\//i.test(exePath)
  const auto = await getInstallDir(game.id).catch(() => null)
  // Thư mục game riêng: thư mục người dùng chọn + thư mục exe tiến trình cũ (form cũ)
  const processDirs = (await processExePaths(game).catch(() => [])).map((p) => dirname(p))
  const extra = validDirs([...processDirs, ...gameService.unpackDirs(game.watch_dirs)])
  const autoDirs = validDirs([auto])

  // Game Steam: Steam là launcher (đã bỏ qua), thư mục cài chính là thư mục game
  const split = extra.length > 0 && !isSteam
  return {
    gameDirs: split ? extra : [...new Set([...autoDirs, ...extra])],
    launcherDirs: split ? autoDirs.filter((d) => !extra.includes(d)) : [],
    split,
    launcherExe:
      !isSteam && isAbsolute(exePath) && extname(exePath).toLowerCase() === '.exe'
        ? resolve(exePath).toLowerCase()
        : null
  }
}

function getTargets(): Promise<Map<string, Target>> {
  if (targets && Date.now() - targetsBuiltAt < TARGETS_TTL_MS) return Promise.resolve(targets)
  building ??= (async () => {
    const generation = targetsGeneration
    try {
      const map = new Map<string, Target>()
      for (const game of gameService.getAllGames()) map.set(game.id, await buildTarget(game))
      // Game bị sửa trong lúc đang tính => kết quả này đã cũ, lần sau tính lại
      if (generation === targetsGeneration) {
        targets = map
        targetsBuiltAt = Date.now()
      }
      return map
    } finally {
      building = null
    }
  })()
  return building
}

// Gọi khi thêm / sửa / xoá game
export function invalidateTargets(): void {
  targets = null
  targetsGeneration++
}

interface Owner {
  gameId: string
  kind: DirKind
}

// Tiến trình thuộc game nào, là launcher hay game: thư mục khớp dài nhất thắng (thư mục lồng nhau)
function ownerResolver(map: Map<string, Target>): (path: string) => Owner | null {
  const entries: [string, Owner][] = []
  for (const [gameId, t] of map) {
    for (const dir of t.gameDirs) entries.push([dir, { gameId, kind: 'game' }])
    for (const dir of t.launcherDirs) entries.push([dir, { gameId, kind: 'launcher' }])
  }
  entries.sort((a, b) => b[0].length - a[0].length)
  return (path) => {
    const owner = entries.find(([dir]) => path.startsWith(dir))?.[1] ?? null
    if (!owner) return null
    const target = map.get(owner.gameId)
    // Đúng file Nexus mở luôn là launcher (khi game có thư mục game riêng)
    if (target?.split && target.launcherExe === path) return { ...owner, kind: 'launcher' }
    return owner
  }
}

// ---------- Phiên chơi ----------

interface Candidate {
  firstSeen: number
  dir: string
  exeName: string
}

interface Session {
  origin: 'nexus' | 'detected'
  phase: SessionPhase
  // Tên exe trong thư mục launcher (khi không đọc được đường dẫn tiến trình)
  fallbackNames: Set<string>
  childPid: number | null
  childAlive: boolean
  waitingSince: number // Mốc để tính timeout khi chưa thấy gì chạy
  seenAny: boolean
  missCount: number // Số lượt liên tiếp không thấy cả launcher lẫn game
  gameMissCount: number // Số lượt liên tiếp không thấy game (khi đang chơi)
  gameActive: boolean // Lượt kiểm tra trước có thấy game không (để cộng giờ)
  lastTick: number
  playedMs: number
  firstPlayAt: number | null // Lúc game thật chạy lần đầu (mốc phiên chơi trong thống kê)
  candidates: Map<string, Candidate> // pid:path => exe lạ do launcher sinh ra
  suggested: Set<string> // Thư mục đã gợi ý trong phiên này
}

const sessions = new Map<string, Session>()
let timer: NodeJS.Timeout | null = null
let polling = false
let started = false

export function isTracking(gameId: string): boolean {
  return sessions.has(gameId)
}

// Mốc cho đồng hồ trên giao diện: now - startedAt = tổng thời gian đã chơi trong phiên
const clockStart = (s: Session): number | null =>
  s.phase === 'playing' ? Date.now() - s.playedMs : null

export function getRunningSessions(): {
  gameId: string
  phase: SessionPhase
  startedAt: number | null
}[] {
  return [...sessions].map(([gameId, s]) => ({
    gameId,
    phase: s.phase,
    startedAt: clockStart(s)
  }))
}

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, payload)
}

function broadcast(gameId: string, session: Session | null, game?: Game): void {
  const event: SessionEvent = session
    ? { gameId, running: true, phase: session.phase, game, startedAt: clockStart(session) }
    : { gameId, running: false, game }
  send('games:sessionChanged', event)
}

function endSession(gameId: string): void {
  const session = sessions.get(gameId)
  if (!session) return
  sessions.delete(gameId)

  // Cộng nốt khoảng thời gian từ lần kiểm tra cuối nếu game vẫn đang chạy
  if (session.gameActive) session.playedMs += Date.now() - session.lastTick

  // Chỉ mở launcher mà không vào game => không ghi gì
  let game: Game | undefined
  if (session.playedMs > 0 && session.firstPlayAt) {
    const hours = session.playedMs / 3_600_000
    if (session.playedMs >= MIN_SESSION_MS) {
      gameService.addPlaySession(gameId, new Date(session.firstPlayAt), new Date(), hours)
    }
    game = gameService.recordPlaySession(gameId, hours)
  }
  broadcast(gameId, null, game ?? gameService.getGameById(gameId))
}

function newSession(origin: Session['origin'], child: ChildProcess | null): Session {
  const now = Date.now()
  return {
    origin,
    phase: 'launcher',
    fallbackNames: new Set(),
    childPid: child?.pid ?? null,
    childAlive: !!child,
    waitingSince: now,
    seenAny: false,
    missCount: 0,
    gameMissCount: 0,
    gameActive: false,
    lastTick: now,
    playedMs: 0,
    firstPlayAt: null,
    candidates: new Map(),
    suggested: new Set()
  }
}

// Chuyển sang "Đang chơi"; since = lúc game thật bắt đầu (mặc định là bây giờ)
function startPlaying(gameId: string, session: Session, since = Date.now()): void {
  const now = Date.now()
  if (session.phase === 'playing') return
  session.phase = 'playing'
  session.gameActive = true
  session.gameMissCount = 0
  session.playedMs += Math.max(0, now - since)
  session.lastTick = now
  session.firstPlayAt ??= since
  const game = gameService.recordPlaySession(gameId, 0) // Cập nhật "chơi lần cuối"
  broadcast(gameId, session, game)
}

interface Presence {
  game: boolean
  launcher: boolean
}

function presenceOf(
  gameId: string,
  session: Session | null,
  target: Target | undefined,
  procs: ProcessInfo[],
  owner: (path: string) => Owner | null
): Presence {
  const result: Presence = { game: false, launcher: false }
  for (const p of procs) {
    if (IGNORED_PROCESS.test(p.name)) continue
    let kind: DirKind | null = null
    if (p.path) {
      const o = owner(p.path)
      if (o?.gameId === gameId) kind = o.kind
    } else if (session?.fallbackNames.has(p.name)) {
      kind = target?.split ? 'launcher' : 'game'
    }
    if (kind) result[kind] = true
    if (result.game && result.launcher) break
  }
  // Launcher do Nexus mở còn chạy: là launcher nếu phân biệt được, không thì tính là đang chơi
  if (session?.childAlive) result[target?.split ? 'launcher' : 'game'] = true
  return result
}

function updateSession(gameId: string, session: Session, presence: Presence): void {
  const now = Date.now()
  if (session.gameActive) session.playedMs += now - session.lastTick
  session.gameActive = presence.game
  session.lastTick = now

  if (presence.game) {
    session.seenAny = true
    session.missCount = 0
    session.gameMissCount = 0
    if (session.phase === 'launcher') startPlaying(gameId, session, now)
    return
  }

  if (session.phase === 'playing') session.gameMissCount++

  if (presence.launcher) {
    session.seenAny = true
    session.missCount = 0
    // Tắt game nhưng launcher còn: chờ vài lượt rồi quay về "Đang mở"
    if (session.phase === 'playing' && session.gameMissCount >= MISS_LIMIT) {
      session.phase = 'launcher'
      broadcast(gameId, session)
    }
    return
  }

  if (session.seenAny) {
    // Đã từng chạy, giờ không còn gì: chờ thêm vài lượt rồi mới kết thúc
    if (++session.missCount >= MISS_LIMIT) endSession(gameId)
  } else if (!session.childAlive && now - session.waitingSince > NOT_SEEN_TIMEOUT_MS) {
    endSession(gameId)
  }
}

// ---------- Gợi ý thư mục game từ cây tiến trình ----------

function getDismissed(): Record<string, string[]> {
  try {
    const value = JSON.parse(getSetting(DISMISSED_KEY) ?? '{}') as Record<string, string[]>
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

// Exe do launcher sinh ra (con, cháu...), nằm ngoài các thư mục của game, chạy lâu => gợi ý
function checkSuggestions(
  gameId: string,
  session: Session,
  target: Target | undefined,
  procs: ProcessInfo[],
  owner: (path: string) => Owner | null
): void {
  // Chỉ gợi ý khi chưa phân biệt được game (chưa có thư mục game) hoặc đang kẹt ở "Đang mở"
  if (!target || (target.split && session.phase === 'playing')) {
    session.candidates.clear()
    return
  }
  const byPid = new Map(procs.map((p) => [p.pid, p]))
  // Gốc: tiến trình launcher của game này (theo thư mục) + tiến trình Nexus đã mở
  const roots = new Set<number>()
  if (session.childPid) roots.add(session.childPid)
  for (const p of procs) {
    const o = p.path ? owner(p.path) : null
    if (o?.gameId === gameId && (o.kind === 'launcher' || !target.split)) roots.add(p.pid)
  }
  if (roots.size === 0) return

  const isDescendant = (p: ProcessInfo): boolean => {
    let current = byPid.get(p.parentPid)
    for (let depth = 0; current && depth < MAX_ANCESTRY_DEPTH; depth++) {
      if (roots.has(current.pid)) return true
      current = byPid.get(current.parentPid)
    }
    return false
  }

  const now = Date.now()
  const windowsDir = normalizeDir(process.env.SystemRoot ?? 'C:\\Windows')
  const dismissed = new Set(getDismissed()[gameId] ?? [])
  const alive = new Set<string>()

  for (const p of procs) {
    if (!p.path || roots.has(p.pid)) continue
    if (IGNORED_PROCESS.test(p.name) || HELPER_PROCESS.test(p.name)) continue
    if (owner(p.path) || p.path.startsWith(windowsDir)) continue // Đã thuộc thư mục nào đó
    if (!isDescendant(p)) continue

    const key = `${p.pid}:${p.path}`
    alive.add(key)
    let candidate = session.candidates.get(key)
    if (!candidate) {
      const display = p.rawPath ?? p.path // Giữ chữ hoa/thường gốc để hiển thị
      candidate = { firstSeen: now, dir: dirname(display), exeName: basename(display) }
      session.candidates.set(key, candidate)
    }
    const dir = normalizeDir(candidate.dir)
    if (
      now - candidate.firstSeen >= SUGGEST_AFTER_MS &&
      !session.suggested.has(dir) &&
      !dismissed.has(dir) &&
      !validateWatchDir(candidate.dir)
    ) {
      session.suggested.add(dir)
      const game = gameService.getGameById(gameId)
      if (game) {
        const suggestion: WatchDirSuggestion = {
          gameId,
          title: game.title,
          dir: candidate.dir,
          exeName: candidate.exeName
        }
        send('games:watchDirSuggestion', suggestion)
      }
    }
  }
  for (const key of session.candidates.keys()) if (!alive.has(key)) session.candidates.delete(key)
}

// Người dùng đồng ý dùng thư mục gợi ý làm thư mục game
export function acceptWatchDir(gameId: string, dir: string): Game | undefined {
  const game = gameService.getGameById(gameId)
  if (!game || validateWatchDir(dir)) return undefined
  const dirs = gameService.unpackDirs(game.watch_dirs)
  const updated = gameService.updateGame(gameId, { watch_dirs: [...dirs, dir] })
  invalidateTargets()

  // Đang mở launcher => chuyển ngay sang "Đang chơi", tính giờ từ lúc exe đó xuất hiện
  const session = sessions.get(gameId)
  const norm = normalizeDir(dir)
  const since = session
    ? Math.min(
        ...[...session.candidates.values()]
          .filter((c) => normalizeDir(c.dir) === norm)
          .map((c) => c.firstSeen),
        Date.now()
      )
    : Date.now()
  if (session && session.phase === 'launcher') startPlaying(gameId, session, since)
  schedule(0)
  return updated
}

export function dismissWatchDir(gameId: string, dir: string): void {
  const dismissed = getDismissed()
  const list = new Set(dismissed[gameId] ?? [])
  list.add(normalizeDir(dir))
  dismissed[gameId] = [...list].slice(-20)
  setSetting(DISMISSED_KEY, JSON.stringify(dismissed))
}

// ---------- Vòng kiểm tra ----------

export function isAutoDetectEnabled(): boolean {
  return getSetting(AUTO_DETECT_KEY) !== '0'
}

async function poll(): Promise<void> {
  if (polling) return
  polling = true
  try {
    const autoDetect = isAutoDetectEnabled()
    if (sessions.size === 0 && !autoDetect) return
    const [map, procs] = await Promise.all([getTargets(), listProcesses()])
    const owner = ownerResolver(map)

    for (const [gameId, session] of [...sessions]) {
      const target = map.get(gameId)
      updateSession(gameId, session, presenceOf(gameId, session, target, procs, owner))
      if (sessions.has(gameId)) checkSuggestions(gameId, session, target, procs, owner)
    }

    // Game mở ngoài Nexus: chỉ nhận khi exe game chạy (launcher ngồi sẵn ở khay hệ thống thì bỏ qua)
    if (autoDetect) {
      for (const [gameId, target] of map) {
        if (sessions.has(gameId) || target.gameDirs.length === 0) continue
        if (presenceOf(gameId, null, target, procs, owner).game) {
          const session = newSession('detected', null)
          session.seenAny = true
          sessions.set(gameId, session)
          startPlaying(gameId, session)
        }
      }
    }
  } catch {
    // Lỗi tạm thời (đọc DB / tiến trình): thử lại ở lượt sau
  } finally {
    polling = false
    schedule()
  }
}

// Có game chạy: kiểm tra mỗi 5 giây; không có: 15 giây (nếu bật tự nhận game), hoặc dừng hẳn
function schedule(delay?: number): void {
  if (!started) return
  if (timer) clearTimeout(timer)
  timer = null
  const wait =
    delay ?? (sessions.size > 0 ? ACTIVE_POLL_MS : isAutoDetectEnabled() ? IDLE_POLL_MS : null)
  if (wait !== null) timer = setTimeout(() => void poll(), wait)
}

export function startTracker(): void {
  started = true
  schedule(3_000) // Đợi app mở xong rồi mới dò game đang chạy sẵn
}

export function setAutoDetect(enabled: boolean): boolean {
  setSetting(AUTO_DETECT_KEY, enabled ? '1' : '0')
  schedule()
  return enabled
}

export function getTrackingInfo(): { autoDetect: boolean; nativeProcessApi: boolean } {
  return { autoDetect: isAutoDetectEnabled(), nativeProcessApi: isNativeAvailable() }
}

// Bắt đầu theo dõi một game vừa được bấm Chơi (trạng thái "Đang mở" cho tới khi game thật chạy).
// Trả về false nếu không có cách nào theo dõi (game Steam chưa tìm thấy thư mục cài...)
export async function trackLaunch(game: Game, child: ChildProcess | null): Promise<boolean> {
  const map = await getTargets()
  const target = map.get(game.id) ?? (await buildTarget(game))
  map.set(game.id, target)
  if (!child && target.gameDirs.length === 0) return false

  const session = newSession('nexus', child)
  child?.once('exit', () => {
    session.childAlive = false
    session.waitingSince = Date.now()
    schedule(0) // Kiểm tra ngay để không phải chờ hết chu kỳ
  })

  // Tên exe trong thư mục launcher: dùng khi không đọc được đường dẫn tiến trình
  const exePath = game.exe_path.trim()
  if (child) {
    session.fallbackNames.add(basename(exePath).toLowerCase())
    if (!validateWatchDir(dirname(exePath))) {
      void collectExeNames(dirname(exePath)).then((names) => {
        for (const name of names) session.fallbackNames.add(name)
      })
    }
  }

  sessions.set(game.id, session)
  broadcast(game.id, session)
  schedule(0)
  return true
}

// Thoát launcher khi game còn chạy: lưu lại giờ chơi tính tới thời điểm này
app.on('before-quit', () => {
  started = false
  if (timer) clearTimeout(timer)
  for (const id of [...sessions.keys()]) endSession(id)
})
