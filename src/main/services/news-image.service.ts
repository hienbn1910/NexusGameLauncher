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

const MAX_BYTES = 8 * 1024 * 1024
const KEEP_DAYS = 14
const SAFE_ID = /^[a-f0-9]{20}$/

// id => URL gốc (nạp lại mỗi khi đọc tin, kể cả tin lấy từ cache)
const registry = new Map<string, string>()

function imagesDir(): string {
  const dir = join(app.getPath('userData'), 'news-images')
  mkdirSync(dir, { recursive: true })
  return dir
}

const notFound = (): Response => new Response('Not found', { status: 404 })

// Đăng ký URL ảnh, trả về địa chỉ nội bộ để giao diện dùng
export function proxiedImageUrl(url: string | null): string | null {
  if (!url || !/^https:\/\//i.test(url)) return null
  const id = createHash('sha1').update(url).digest('hex').slice(0, 20)
  registry.set(id, url)
  return `game-media://news-image/${id}`
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

  const url = registry.get(id)
  if (!url) return notFound()
  try {
    const res = await fetchWithTimeout(url)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!res.ok || !type.startsWith('image/')) return notFound()
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length === 0 || data.length > MAX_BYTES) return notFound()

    await writeFile(file, data)
    await writeFile(`${file}.type`, type)
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': type } })
  } catch {
    return notFound() // Lỗi mạng / bị chặn: giao diện tự dùng ảnh bìa game thay thế
  }
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
