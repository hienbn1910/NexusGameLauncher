import { existsSync } from 'fs'
import { join } from 'path'
import { GAME_CATALOG } from './game-catalog'

// Ảnh dọc đóng gói sẵn cho danh mục game phổ biến: resources/catalog/<id>.webp (400x600).
// Có sẵn trong app để hộp thoại "Thêm game phổ biến" luôn có ảnh, kể cả khi mạng chặn Steam.
// Bản đóng gói: resources/ nằm ngoài asar (asarUnpack trong electron-builder.yml)
const CATALOG_ART_DIR = join(__dirname, '../../resources/catalog').replace(
  'app.asar',
  'app.asar.unpacked'
)

function catalogFile(id: string, file: string): string | null {
  if (!GAME_CATALOG.some((e) => e.id === id)) return null
  const path = join(CATALOG_ART_DIR, file)
  return existsSync(path) ? path : null
}

// Đường dẫn ảnh dọc của game trong danh mục; null nếu mã không hợp lệ hoặc chưa có ảnh
export const catalogArtPath = (id: string): string | null => catalogFile(id, `${id}.webp`)

// Ảnh nền banner (1600x516) và logo nền trong suốt, dùng cho banner trang chủ / trang chi tiết
export const catalogHeroPath = (id: string): string | null =>
  catalogFile(id, join('heroes', `${id}.webp`))
export const catalogLogoPath = (id: string): string | null =>
  catalogFile(id, join('logos', `${id}.png`))

// Icon đóng gói sẵn: resources/catalog/icons/<id>.png (256x256). Dùng khi chưa có exe game thật
// (game chưa cài, hoặc mở qua launcher chung như Riot Client / HoYoPlay, hoặc qua Steam)
export const catalogIconPath = (id: string): string | null =>
  catalogFile(id, join('icons', `${id}.png`))
