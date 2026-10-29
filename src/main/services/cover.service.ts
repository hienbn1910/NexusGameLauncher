import { mkdirSync } from 'fs'
import { copyFile, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { pathToFileURL } from 'url'
import { app, nativeImage, net, protocol } from 'electron'
import { getGameIcon } from './exe-icon.service'
import * as gameService from './game.service'
import type { Game } from './game.service'
import { newsImageResponse } from './news-image.service'

export const MEDIA_SCHEME = 'game-media'
export const COVER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp']

// Ảnh rộng hơn mức này sẽ được thu nhỏ để app nhẹ
const MAX_COVER_WIDTH = 1600
const PREVIEW_WIDTH = 480
// Tên file ảnh bìa hợp lệ: <gameId>-<timestamp>.<ext>
const SAFE_FILE_NAME = /^[\w-]+\.(jpg|png|webp)$/i

function coversDir(): string {
  const dir = join(app.getPath('userData'), 'covers')
  mkdirSync(dir, { recursive: true })
  return dir
}

// Phải gọi trước app.whenReady() để scheme được coi là an toàn như https
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

const notFound = (): Response => new Response('Not found', { status: 404 })

// Icon game lấy từ file exe (ưu tiên exe tiến trình game, sau đó tới file launcher)
async function exeIcon(gameId: string): Promise<Response> {
  const game = gameService.getGameById(gameId)
  const png = game ? await getGameIcon(game) : null
  if (!png) return notFound()
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
}

// game-media://cover/<tên file>: chỉ phục vụ file nằm trong thư mục covers
// game-media://icon/<gameId>: icon của file exe game
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url)
    const name = decodeURIComponent(url.pathname.replace(/^\//, ''))

    if (url.host === 'icon' && /^[\w-]+$/.test(name)) return exeIcon(name)
    if (url.host === 'news-image') return newsImageResponse(name)
    if (url.host === 'cover' && SAFE_FILE_NAME.test(name)) {
      return net.fetch(pathToFileURL(join(coversDir(), name)).toString())
    }
    return notFound()
  })
}

// Ảnh xem trước nhỏ (data URL) cho form, trước khi người dùng bấm Lưu
export async function createPreview(imagePath: string): Promise<string | null> {
  const ext = extname(imagePath).slice(1).toLowerCase()
  if (!COVER_EXTENSIONS.includes(ext)) return null

  const image = nativeImage.createFromPath(imagePath)
  if (!image.isEmpty()) {
    return image.resize({ width: PREVIEW_WIDTH, quality: 'good' }).toDataURL()
  }
  // nativeImage không đọc được webp => gửi nguyên file
  if (ext === 'webp') {
    return `data:image/webp;base64,${(await readFile(imagePath)).toString('base64')}`
  }
  return null
}

async function removeCoverFile(coverPath: string | null): Promise<void> {
  if (!coverPath) return
  // Chỉ xoá file nằm trong thư mục covers của app
  const fileName = basename(coverPath)
  if (SAFE_FILE_NAME.test(fileName)) {
    await rm(join(coversDir(), fileName), { force: true })
  }
}

// cover: ảnh ngang (thẻ game, banner), poster: ảnh dọc 2:3 (lưới kiểu Steam),
// logo: logo nền trong suốt (banner trang chủ)
export type CoverKind = 'cover' | 'poster' | 'logo'

const COVER_COLUMN: Record<CoverKind, gameService.ImageColumn> = {
  cover: 'cover_path',
  poster: 'poster_path',
  logo: 'logo_path'
}

// Copy ảnh người dùng chọn vào thư mục covers (không trỏ tới file gốc vì có thể bị xoá/di chuyển)
export async function setCover(
  gameId: string,
  imagePath: string | null,
  kind: CoverKind = 'cover'
): Promise<Game | undefined> {
  const game = gameService.getGameById(gameId)
  if (!game) return undefined

  let newPath: string | null = null
  if (imagePath) {
    const ext = extname(imagePath).slice(1).toLowerCase()
    if (!COVER_EXTENSIONS.includes(ext)) throw new Error('Định dạng ảnh không được hỗ trợ')

    // Tên file đổi mỗi lần cập nhật để trình duyệt không dùng ảnh cũ trong cache
    const stamp = Date.now()
    const image = nativeImage.createFromPath(imagePath)

    if (!image.isEmpty()) {
      const resized =
        image.getSize().width > MAX_COVER_WIDTH
          ? image.resize({ width: MAX_COVER_WIDTH, quality: 'best' })
          : image
      // Logo cần giữ nền trong suốt => PNG, còn lại JPEG cho nhẹ
      if (kind === 'logo') {
        newPath = join(coversDir(), `${gameId}-${stamp}.png`)
        await writeFile(newPath, resized.toPNG())
      } else {
        newPath = join(coversDir(), `${gameId}-${stamp}.jpg`)
        await writeFile(newPath, resized.toJPEG(88))
      }
    } else if (ext === 'webp') {
      newPath = join(coversDir(), `${gameId}-${stamp}.webp`)
      await copyFile(imagePath, newPath)
    } else {
      throw new Error('Không đọc được file ảnh')
    }
  }

  const column = COVER_COLUMN[kind]
  await removeCoverFile(game[column])
  colorCache.delete(gameId)
  return gameService.updateCoverPath(gameId, newPath, column)
}

export async function deleteCover(game: Game): Promise<void> {
  await removeCoverFile(game.cover_path)
  await removeCoverFile(game.poster_path)
  await removeCoverFile(game.logo_path)
}

// ---------- Màu chủ đạo của ảnh game (tô nền trang chủ) ----------

const colorCache = new Map<string, string | null>()

// Màu "rực" nhất trung bình của ảnh: thu nhỏ ảnh rồi lấy trung bình các điểm ảnh
// có độ bão hoà cao, bỏ qua vùng quá tối/quá sáng. Trả về "r, g, b" hoặc null.
export function getArtColor(gameId: string): string | null {
  if (colorCache.has(gameId)) return colorCache.get(gameId)!
  const game = gameService.getGameById(gameId)
  const file = game?.cover_path ?? game?.poster_path
  let color: string | null = null

  if (file && SAFE_FILE_NAME.test(basename(file))) {
    const image = nativeImage.createFromPath(join(coversDir(), basename(file)))
    if (!image.isEmpty()) {
      const small = image.resize({ width: 32, height: 32, quality: 'good' })
      const bmp = small.toBitmap() // BGRA
      let r = 0
      let g = 0
      let b = 0
      let weight = 0
      for (let i = 0; i < bmp.length; i += 4) {
        const [pb, pg, pr] = [bmp[i], bmp[i + 1], bmp[i + 2]]
        const max = Math.max(pr, pg, pb)
        const min = Math.min(pr, pg, pb)
        if (max < 40 || min > 225) continue
        const w = (max - min) / 255 + 0.05 // Ưu tiên điểm ảnh nhiều màu
        r += pr * w
        g += pg * w
        b += pb * w
        weight += w
      }
      if (weight > 0) {
        color = [r, g, b].map((v) => Math.round(v / weight)).join(', ')
      }
    }
  }
  colorCache.set(gameId, color)
  return color
}
