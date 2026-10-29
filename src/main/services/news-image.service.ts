import { createHash } from 'crypto'
import { mkdirSync } from 'fs'
import { readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { fetchWithTimeout } from './network.service'

// Ảnh trong tin tức được main process tải hộ qua game-media://news-image/<id>:
// - Không phải mở CSP cho từng trang báo
// - Chỉ tải được URL có trong tin đã đọc (renderer không tự yêu cầu URL bất kỳ)
// - Lưu vào ổ đĩa nên mất mạng / Steam bị chặn vẫn hiện được ảnh cũ
// Tin không kèm ảnh: đăng ký link bài viết, khi cần mới đọc trang để lấy og:image.

const MAX_BYTES = 8 * 1024 * 1024
const MAX_PAGE_BYTES = 768 * 1024 // Thẻ og:image nằm trong <head>, không cần đọc hết trang
const KEEP_DAYS = 14
const SAFE_ID = /^[a-f0-9]{20}$/

interface Source {
  url: string
  page: boolean // true: url là trang bài viết, ảnh lấy từ og:image
}

// id => nguồn gốc (nạp lại mỗi khi đọc tin, kể cả tin lấy từ cache)
const registry = new Map<string, Source>()
// Nhiều thẻ cùng xin một ảnh => chỉ tải một lần
const inflight = new Map<string, Promise<Response>>()

function imagesDir(): string {
  const dir = join(app.getPath('userData'), 'news-images')
  mkdirSync(dir, { recursive: true })
  return dir
}

const notFound = (): Response => new Response('Not found', { status: 404 })

function register(url: string | null, page: boolean): string | null {
  if (!url || !/^https:\/\//i.test(url)) return null
  const id = createHash('sha1')
    .update(page ? `page:${url}` : url)
    .digest('hex')
    .slice(0, 20)
  registry.set(id, { url, page })
  return `game-media://news-image/${id}`
}

// Đăng ký URL ảnh, trả về địa chỉ nội bộ để giao diện dùng
export function proxiedImageUrl(url: string | null): string | null {
  return register(url, false)
}

// Đăng ký trang bài viết: ảnh là og:image của trang, chỉ đọc khi giao diện thật sự hiển thị
export function proxiedPageImageUrl(pageUrl: string): string | null {
  return register(pageUrl, true)
}

// Đọc phần đầu trang (đủ để có <head>) rồi dừng tải
async function readPageHead(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml'
    }
  })
  if (!res.ok || !res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_PAGE_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
    if (Buffer.from(value).includes('</head>')) break
  }
  void reader.cancel().catch(() => undefined)
  return Buffer.concat(chunks).toString('utf8')
}

const META_KEYS = [
  'og:image:secure_url',
  'og:image',
  'og:image:url',
  'twitter:image',
  'twitter:image:src'
]

// Tìm ảnh đại diện trong các thẻ <meta> (thứ tự thuộc tính mỗi trang mỗi khác)
export function findPageImage(html: string, pageUrl: string): string | null {
  const found = new Map<string, string>()
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = new Map<string, string>()
    for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
      attrs.set(m[1].toLowerCase(), m[3] ?? m[4] ?? '')
    }
    const key = (attrs.get('property') ?? attrs.get('name') ?? '').toLowerCase()
    const content = attrs.get('content')
    if (content && META_KEYS.includes(key) && !found.has(key)) found.set(key, content)
  }
  for (const key of META_KEYS) {
    const raw = found.get(key)?.replace(/&amp;/g, '&').trim()
    if (!raw) continue
    try {
      // Ảnh ghi đường dẫn tương đối hoặc http => đưa về https tuyệt đối
      const url = new URL(raw, pageUrl)
      url.protocol = 'https:'
      return url.toString()
    } catch {
      // Thử thẻ tiếp theo
    }
  }
  return null
}

async function downloadImage(url: string): Promise<{ data: Buffer; type: string } | null> {
  const res = await fetchWithTimeout(url)
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!res.ok || !type.startsWith('image/')) return null
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length === 0 || data.length > MAX_BYTES) return null
  return { data, type }
}

async function fetchAndStore(id: string, source: Source): Promise<Response> {
  const file = join(imagesDir(), id)
  try {
    const imageUrl = source.page
      ? findPageImage(await readPageHead(source.url), source.url)
      : source.url
    const image = imageUrl ? await downloadImage(imageUrl) : null
    if (!image) {
      // Trang không có ảnh đại diện => ghi nhớ để không đọc lại trang mỗi lần mở tin
      if (source.page) await writeFile(`${file}.none`, '')
      return notFound()
    }
    await writeFile(file, image.data)
    await writeFile(`${file}.type`, image.type)
    return new Response(new Uint8Array(image.data), { headers: { 'Content-Type': image.type } })
  } catch {
    // Lỗi mạng / bị chặn / quá thời gian: không ghi nhớ, lần sau thử lại.
    // Giao diện tự dùng ảnh thay thế
    return notFound()
  }
}

export async function newsImageResponse(id: string): Promise<Response> {
  if (!SAFE_ID.test(id)) return notFound()
  const file = join(imagesDir(), id)

  // Đã có trên máy
  try {
    const data = await readFile(file)
    const type = (await readFile(`${file}.type`, 'utf8').catch(() => 'image/jpeg')).trim()
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': type } })
  } catch {
    // Chưa tải, tải bên dưới
  }

  const source = registry.get(id)
  if (!source) return notFound()
  if (source.page) {
    const none = await stat(`${file}.none`).catch(() => null)
    if (none) return notFound()
  }

  let task = inflight.get(id)
  if (!task) {
    task = fetchAndStore(id, source).finally(() => inflight.delete(id))
    inflight.set(id, task)
  }
  // Response chỉ đọc được một lần => trả bản sao cho mỗi yêu cầu
  return (await task).clone()
}

// Xoá ảnh tin tức cũ khi mở app
export async function cleanupNewsImages(): Promise<void> {
  const dir = imagesDir()
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000
  for (const name of await readdir(dir).catch(() => [] as string[])) {
    const path = join(dir, name)
    try {
      if ((await stat(path)).mtimeMs < cutoff) await rm(path, { force: true })
    } catch {
      // Bỏ qua file đang bị khoá
    }
  }
}
