import { app, net, session } from 'electron'
import { getSetting, setSetting } from './settings.service'

// Cài đặt mạng của riêng app (không ảnh hưởng tới mạng của cả máy):
// - DNS bảo mật (DNS over HTTPS) qua Cloudflare/Google: vượt chặn kiểu DNS của nhà mạng
// - Proxy HTTP/SOCKS (vd chế độ proxy của Cloudflare WARP)

export type DnsProvider = 'off' | 'cloudflare' | 'google'
export type ProxyMode = 'system' | 'direct' | 'custom'

export interface NetworkSettings {
  dns: DnsProvider
  proxyMode: ProxyMode
  proxyUrl: string
}

const SETTINGS_KEY = 'network'
const DEFAULT_SETTINGS: NetworkSettings = { dns: 'off', proxyMode: 'system', proxyUrl: '' }

const DOH_SERVERS: Record<Exclude<DnsProvider, 'off'>, string> = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  google: 'https://dns.google/dns-query'
}

// http://host:port, socks5://127.0.0.1:40000 ...
const PROXY_URL = /^(https?|socks4|socks5):\/\/[a-z0-9.-]+(:\d{1,5})?\/?$/i

export const REQUEST_TIMEOUT_MS = 6000

const isDohProvider = (value: unknown): value is Exclude<DnsProvider, 'off'> =>
  typeof value === 'string' && Object.hasOwn(DOH_SERVERS, value)

export function getNetworkSettings(): NetworkSettings {
  try {
    const saved = JSON.parse(getSetting(SETTINGS_KEY) ?? '{}') as Partial<NetworkSettings>
    return validate({ ...DEFAULT_SETTINGS, ...saved })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function validate(settings: NetworkSettings): NetworkSettings {
  const dns = isDohProvider(settings.dns) ? settings.dns : 'off'
  const proxyMode: ProxyMode = ['system', 'direct', 'custom'].includes(settings.proxyMode)
    ? settings.proxyMode
    : 'system'
  const proxyUrl = String(settings.proxyUrl ?? '').trim()
  if (proxyMode === 'custom' && !PROXY_URL.test(proxyUrl)) {
    throw new Error('Địa chỉ proxy không hợp lệ. Ví dụ: socks5://127.0.0.1:40000')
  }
  return { dns, proxyMode, proxyUrl }
}

// Áp dụng cho mọi request của app (net.fetch ở main process và ảnh ở giao diện)
export async function applyNetworkSettings(settings = getNetworkSettings()): Promise<void> {
  if (settings.dns === 'off') {
    app.configureHostResolver({ secureDnsMode: 'automatic', secureDnsServers: [] })
  } else {
    app.configureHostResolver({
      secureDnsMode: 'secure',
      secureDnsServers: [DOH_SERVERS[settings.dns]]
    })
  }

  const ses = session.defaultSession
  if (settings.proxyMode === 'custom') {
    await ses.setProxy({ mode: 'fixed_servers', proxyRules: settings.proxyUrl })
  } else {
    await ses.setProxy({ mode: settings.proxyMode })
  }

  // Bỏ kết nối/DNS cũ để cài đặt mới có hiệu lực ngay
  await ses.clearHostResolverCache()
  await ses.closeAllConnections()
  steamBlockedUntil = 0
}

export async function saveNetworkSettings(input: NetworkSettings): Promise<NetworkSettings> {
  const settings = validate(input)
  setSetting(SETTINGS_KEY, JSON.stringify(settings))
  await applyNetworkSettings(settings)
  return settings
}

// ---------- Request có giới hạn thời gian ----------

export class NetworkError extends Error {}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  try {
    return await net.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new NetworkError(`Không kết nối được: ${new URL(url).host}`)
  }
}

// ---------- Theo dõi Steam bị chặn ----------

// Khi request tới Steam lỗi mạng: tạm coi Steam bị chặn một lúc để các game sau
// chuyển thẳng sang nguồn khác thay vì chờ hết thời gian từng lần
const STEAM_BLOCK_MS = 10 * 60_000
let steamBlockedUntil = 0

export function isSteamBlocked(): boolean {
  return Date.now() < steamBlockedUntil
}

export function markSteamBlocked(): void {
  steamBlockedUntil = Date.now() + STEAM_BLOCK_MS
}

export function markSteamReachable(): void {
  steamBlockedUntil = 0
}

export interface ConnectionTest {
  ok: boolean
  ms: number
  error?: string
}

export async function testSteamConnection(): Promise<ConnectionTest> {
  const start = Date.now()
  try {
    const res = await fetchWithTimeout('https://store.steampowered.com/feeds/news/app/730/', {
      method: 'HEAD'
    })
    const ms = Date.now() - start
    if (!res.ok) return { ok: false, ms, error: `Steam trả về lỗi ${res.status}` }
    markSteamReachable()
    return { ok: true, ms }
  } catch {
    markSteamBlocked()
    return { ok: false, ms: Date.now() - start, error: 'Không kết nối được tới Steam' }
  }
}
