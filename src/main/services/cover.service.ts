import { existsSync, mkdirSync } from 'fs'
import { copyFile, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { pathToFileURL } from 'url'
import { app, nativeImage, net, protocol } from 'electron'
import * as gameService from './game.service'
import type { Game } from './game.service'

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

// Icon lấy từ file exe của game (cache theo đường dẫn để không đọc lại mỗi lần render)
const iconCache = new Map<string, Buffer>()

async function exeIcon(gameId: string): Promise<Response> {
  const game = gameService.getGameById(gameId)
  const target = game?.exe_path.trim()
  if (!target || /^steam:\/\//i.test(target) || !existsSync(target)) return notFound()

  let png = iconCache.get(target)
  if (!png) {
    try {
      const icon = await app.getFileIcon(target, { size: 'large' })
      if (icon.isEmpty()) return notFound()
      png = icon.toPNG()
      iconCache.set(target, png)
    } catch {
      return notFound()
    }
  }
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } })
}

// game-media://cover/<tên file>: chỉ phục vụ file nằm trong thư mục covers
// game-media://icon/<gameId>: icon của file exe game
export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const url = new URL(request.url)
    const name = decodeURIComponent(url.pathname.replace(/^\//, ''))

    if (url.host === 'icon' && /^[\w-]+$/.test(name)) return exeIcon(name)
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

// Copy ảnh người dùng chọn vào thư mục covers (không trỏ tới file gốc vì có thể bị xoá/di chuyển)
export async function setCover(
  gameId: string,
  imagePath: string | null
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
      newPath = join(coversDir(), `${gameId}-${stamp}.jpg`)
      await writeFile(newPath, resized.toJPEG(88))
    } else if (ext === 'webp') {
      newPath = join(coversDir(), `${gameId}-${stamp}.webp`)
      await copyFile(imagePath, newPath)
    } else {
      throw new Error('Không đọc được file ảnh')
    }
  }

  await removeCoverFile(game.cover_path)
  return gameService.updateCoverPath(gameId, newPath)
}

export async function deleteCover(game: Game): Promise<void> {
  await removeCoverFile(game.cover_path)
}
